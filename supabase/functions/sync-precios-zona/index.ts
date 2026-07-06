// supabase/functions/sync-precios-zona/index.ts
//
// Sincroniza los precios de una zona logística Mercadona → tabla precios_zona.
// NUNCA modifica productos_mercadona ni catalogo_cache (catálogo maestro intocable).
//
// Llamada (solo desde scripts admin / cron, no desde el cliente):
//   POST /sync-precios-zona
//   Body: { zona_id: "madrid", codigo_postal: "28001" }
//   Header: Authorization: Bearer <SERVICE_ROLE_KEY>

import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MERCADONA_BASE           = 'https://tienda.mercadona.es/api'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function baseHeaders(cookie?: string): Record<string, string> {
  return {
    'User-Agent':      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    'Accept':          'application/json, text/plain, */*',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Referer':         'https://tienda.mercadona.es/',
    'Origin':          'https://tienda.mercadona.es',
    ...(cookie ? { 'Cookie': cookie } : {}),
  }
}

async function obtenerSesion(codigoPostal: string): Promise<string> {
  try {
    const res = await fetch(`${MERCADONA_BASE}/postal-codes/actions/change-pc/`, {
      method: 'PUT',
      headers: { ...baseHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_postal_code: codigoPostal }),
    })
    return res.headers.get('set-cookie')?.split(';')[0] ?? ''
  } catch { return '' }
}

async function fetchJson(url: string, cookie: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: baseHeaders(cookie) })
  if (!res.ok) throw new Error(`Mercadona ${res.status}: ${url}`)
  return res.json()
}

interface PrecioRow {
  producto_id: string
  zona_id: string
  precio: number
  precio_ref: string | null
  disponible: boolean
  updated_at: string
}

// ── Obtiene todos los IDs del catálogo maestro para filtrar ───────────────────
// Usamos catalogo_cache (__catalogo_v2__) como fuente de IDs válidos,
// ya que esa es la copia del catálogo de Barcelona que el usuario mantiene.
async function obtenerIdsValidos(): Promise<Set<string>> {
  const { data } = await supabase
    .from('catalogo_cache')
    .select('payload')
    .eq('termino', '__catalogo_v2__')
    .maybeSingle()

  if (!data?.payload) return new Set()

  const payload = data.payload as Record<string, { productos?: Array<{ id: string }> }>
  const ids = new Set<string>()
  for (const sub of Object.values(payload)) {
    for (const p of sub.productos ?? []) {
      if (p.id) ids.add(String(p.id))
    }
  }
  return ids
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  // Solo acepta service_role — no exponer al cliente
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) {
    return new Response(JSON.stringify({ error: 'Solo para uso interno' }), { status: 403 })
  }

  try {
    const { zona_id, codigo_postal } = await req.json() as { zona_id: string; codigo_postal: string }
    if (!zona_id || !codigo_postal) {
      return new Response(JSON.stringify({ error: 'Faltan zona_id o codigo_postal' }), { status: 400 })
    }

    console.log(`[sync-precios-zona] Iniciando zona=${zona_id} CP=${codigo_postal}`)

    // 1. IDs válidos del catálogo maestro
    const idsValidos = await obtenerIdsValidos()
    console.log(`[sync-precios-zona] IDs en catálogo maestro: ${idsValidos.size}`)

    // 2. Sesión Mercadona para esta zona
    const cookie = await obtenerSesion(codigo_postal)

    // 3. Recorrer categorías de Mercadona y acumular precios
    const preciosNuevos: PrecioRow[] = []
    const now = new Date().toISOString()

    const catData = await fetchJson(`${MERCADONA_BASE}/categories/?lang=es`, cookie)
    const categorias = (catData.results as Record<string, unknown>[] ?? [])

    for (const cat of categorias) {
      let subCats: Record<string, unknown>[] = []
      try {
        const subData = await fetchJson(`${MERCADONA_BASE}/categories/${cat.id}/?lang=es`, cookie)
        subCats = subData.categories as Record<string, unknown>[] ?? []
      } catch { continue }

      for (const sub of subCats) {
        for (const prod of (sub.products as Record<string, unknown>[] ?? [])) {
          const id = String(prod.id ?? '')
          if (!id || !idsValidos.has(id)) continue  // solo productos del catálogo maestro

          const pi = prod.price_instructions as Record<string, unknown> | undefined
          const precio = Number(pi?.unit_price ?? pi?.bulk_price ?? 0)
          if (!precio) continue

          const precioRef = (pi?.reference_price as string) ?? null

          preciosNuevos.push({ producto_id: id, zona_id, precio, precio_ref: precioRef, disponible: true, updated_at: now })
        }
      }

      // Pausa pequeña para no saturar la API de Mercadona
      await new Promise(r => setTimeout(r, 120))
    }

    console.log(`[sync-precios-zona] Productos encontrados para zona: ${preciosNuevos.length}`)

    // 4. Marcar como no disponibles los que ya no aparecen en la zona
    const idsEnZona = new Set(preciosNuevos.map(p => p.producto_id))
    const { data: prevActivos } = await supabase
      .from('precios_zona')
      .select('producto_id')
      .eq('zona_id', zona_id)
      .eq('disponible', true)

    const aDesactivar = (prevActivos ?? [])
      .map((p: { producto_id: string }) => p.producto_id)
      .filter((pid: string) => !idsEnZona.has(pid))

    if (aDesactivar.length) {
      await supabase
        .from('precios_zona')
        .update({ disponible: false, updated_at: now })
        .eq('zona_id', zona_id)
        .in('producto_id', aDesactivar)
      console.log(`[sync-precios-zona] Desactivados: ${aDesactivar.length}`)
    }

    // 5. Upsert en lotes de 500 (límite de Supabase por request)
    const LOTE = 500
    for (let i = 0; i < preciosNuevos.length; i += LOTE) {
      const lote = preciosNuevos.slice(i, i + LOTE)
      const { error } = await supabase
        .from('precios_zona')
        .upsert(lote, { onConflict: 'producto_id,zona_id' })
      if (error) throw new Error(`Upsert error: ${error.message}`)
    }

    // 6. Marcar la zona como activa
    await supabase
      .from('zonas_mercadona')
      .update({ activa: true })
      .eq('id', zona_id)

    const resultado = {
      ok: true,
      zona_id,
      productos_actualizados: preciosNuevos.length,
      productos_desactivados: aDesactivar.length,
      timestamp: now,
    }
    console.log(`[sync-precios-zona] Finalizado:`, resultado)

    return new Response(JSON.stringify(resultado), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sync-precios-zona] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
