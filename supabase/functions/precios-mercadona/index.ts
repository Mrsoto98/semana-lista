// supabase/functions/precios-mercadona/index.ts
import { createClient } from 'npm:@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://semana-lista.vercel.app'

const ALLOWED_ORIGINS = new Set([
  ALLOWED_ORIGIN,
  'http://localhost:5173',
  'http://localhost:4173',
])

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : ALLOWED_ORIGIN
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

async function verificarJWT(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
  return !error && !!user
}

const MERCADONA_BASE = 'https://tienda.mercadona.es/api'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function baseHeaders(cookie?: string): Record<string, string> {
  return {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Referer': 'https://tienda.mercadona.es/',
    'Origin': 'https://tienda.mercadona.es',
    ...(cookie ? { 'Cookie': cookie } : {}),
  }
}

function parsearProducto(raw: Record<string, unknown>): { id: string; nombre: string; precio: number; tamaño: number; unidad: string } | null {
  try {
    const pi = raw.price_instructions as Record<string, unknown> | undefined
    if (!pi) return null
    const precio = Number(pi.unit_price ?? pi.bulk_price ?? 0)
    if (!precio) return null
    const refFormat = String(raw.format ?? raw.reference_format ?? raw.display_name ?? '')
    const m = refFormat.match(/([\d,.]+)\s*(g|kg|ml|l|ud|cl)/i)
    const tamaño = m ? parseFloat(m[1].replace(',', '.')) : Number(pi.sku_quantity ?? 1)
    const unidad = m ? m[2].toLowerCase() : 'ud'
    return { id: String(raw.id ?? ''), nombre: String(raw.display_name ?? ''), precio, tamaño, unidad }
  } catch { return null }
}

// Fija almacén y devuelve la cookie de sesión
async function obtenerSesion(codigoPostal: string): Promise<string> {
  try {
    const res = await fetch(`${MERCADONA_BASE}/postal-codes/actions/change-pc/`, {
      method: 'PUT',
      headers: { ...baseHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_postal_code: codigoPostal }),
    })
    // Capturar cookie de sesión para incluirla en peticiones siguientes
    const setCookie = res.headers.get('set-cookie') ?? ''
    // Extraer solo el valor de la cookie (sin los atributos)
    const cookieValue = setCookie.split(';')[0]
    return cookieValue
  } catch { return '' }
}

async function fetchMercadona(url: string, cookie: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: baseHeaders(cookie) })
  if (!res.ok) throw new Error(`Mercadona ${res.status}: ${url}`)
  return await res.json()
}

// ─── Handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

  // Verificar JWT — endpoint solo para usuarios autenticados
  const autenticado = await verificarJWT(req)
  if (!autenticado) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const { action, codigo_postal = '28001' } = body

    const session = await obtenerSesion(codigo_postal)

    // Categorías top-level de Mercadona
    if (action === 'categorias') {
      const data = await fetchMercadona(`${MERCADONA_BASE}/categories/?lang=es`, session)
      const categorias = (data.results as Record<string, unknown>[] ?? []).map(c => ({
        id: c.id,
        nombre: String(c.name ?? c.slug ?? c.id),
      }))
      return new Response(JSON.stringify({ categorias }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Productos de una categoría
    if (action === 'productos') {
      const { categoria_id } = body as { categoria_id: number }
      const data = await fetchMercadona(`${MERCADONA_BASE}/categories/${categoria_id}/?lang=es`, session)
      const productos: ReturnType<typeof parsearProducto>[] = []
      for (const sub of (data.categories as Record<string, unknown>[] ?? [])) {
        for (const prod of (sub.products as Record<string, unknown>[] ?? [])) {
          const p = parsearProducto(prod)
          if (p) productos.push(p)
        }
      }
      return new Response(
        JSON.stringify({ productos, nombre: String(data.name ?? categoria_id) }),
        { headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    // Precios para lista de ingredientes (modo original)
    if (!action) {
      const { ingredientes } = body as { ingredientes: Array<{ nombre: string; cantidad: number; unidad: string }> }
      if (!ingredientes?.length) return new Response(JSON.stringify({ resultados: [] }), { headers: { ...cors, 'Content-Type': 'application/json' } })

      // Cargar catálogo cacheado o fresco
      let catalogo: Record<string, { productos: ReturnType<typeof parsearProducto>[] }> = {}
      try {
        const { data: cache } = await supabase.from('catalogo_cache').select('payload, actualizado_en').eq('termino', '__catalogo_v2__').maybeSingle()
        if (cache) {
          const age = Date.now() - new Date(cache.actualizado_en as string).getTime()
          if (age < CACHE_TTL_MS) catalogo = cache.payload as typeof catalogo
        }
      } catch { /* no cache */ }

      const resultados = await Promise.all(ingredientes.map(async (ing) => {
        const normIng = ing.nombre.toLowerCase()
        // Buscar en catálogo cacheado
        for (const sub of Object.values(catalogo)) {
          for (const p of sub.productos) {
            if (p && p.nombre.toLowerCase().includes(normIng)) {
              return { ingrediente: ing.nombre, producto_mercadona: p.nombre, precio_envase: p.precio, sin_precio: false }
            }
          }
        }
        return { ingrediente: ing.nombre, sin_precio: true }
      }))
      return new Response(JSON.stringify({ resultados }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: true, mensaje: 'Acción desconocida' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

  } catch (err: unknown) {
    const mensaje = err instanceof Error ? err.message : 'Error interno'
    console.error('precios-mercadona error:', mensaje)
    return new Response(
      JSON.stringify({ error: true, mensaje }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
})
