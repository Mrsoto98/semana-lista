// supabase/functions/precios-mercadona/index.ts
import { createClient } from 'npm:@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MERCADONA_BASE = 'https://tienda.mercadona.es/api'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h

// ─── Normalization ────────────────────────────────────────────────────────────
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Stable interface — only this function touches Mercadona ─────────────────
interface ProductoMercadona {
  id: string
  nombre: string
  precio: number         // € por envase
  tamaño: number         // cantidad por envase
  unidad: string         // unidad del envase (g, ml, ud...)
  precio_por_unidad: number // € por unidad base
}

async function buscarProducto(
  termino: string,
  codigoPostal: string,
): Promise<ProductoMercadona | null> {
  const terminoNorm = normalizar(termino)

  // Layer 1: known mappings in mapa_ingredientes
  const { data: mapa } = await supabase
    .from('mapa_ingredientes')
    .select('mercadona_product_id')
    .eq('ingrediente_normalizado', terminoNorm)
    .maybeSingle()

  if (mapa?.mercadona_product_id) {
    const prod = await fetchProductById(mapa.mercadona_product_id, codigoPostal)
    if (prod) return prod
  }

  // Layer 2: catalog cache
  const { data: cache } = await supabase
    .from('catalogo_cache')
    .select('payload, actualizado_en')
    .eq('termino', terminoNorm)
    .maybeSingle()

  if (cache) {
    const age = Date.now() - new Date(cache.actualizado_en).getTime()
    if (age < CACHE_TTL_MS) {
      return cache.payload as ProductoMercadona | null
    }
  }

  // Layer 3: live Mercadona API
  const resultado = await buscarEnMercadona(terminoNorm, codigoPostal)

  // Cache the result (even null means "not found")
  await supabase
    .from('catalogo_cache')
    .upsert(
      { termino: terminoNorm, payload: resultado, actualizado_en: new Date().toISOString() },
      { onConflict: 'termino' },
    )

  return resultado
}

async function fetchProductById(
  id: string,
  codigoPostal: string,
): Promise<ProductoMercadona | null> {
  try {
    await fijarAlmacen(codigoPostal)
    const res = await fetch(`${MERCADONA_BASE}/products/${id}/`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json, text/plain, */*' },
    })
    if (!res.ok) return null
    const data = await res.json()
    return parsearProducto(data)
  } catch {
    return null
  }
}

async function fijarAlmacen(codigoPostal: string): Promise<void> {
  try {
    await fetch(`${MERCADONA_BASE}/postal-codes/actions/change-pc/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify({ new_postal_code: codigoPostal }),
    })
  } catch { /* non-critical — proceed with default warehouse */ }
}

async function buscarEnMercadona(
  terminoNorm: string,
  codigoPostal: string,
): Promise<ProductoMercadona | null> {
  try {
    await fijarAlmacen(codigoPostal)

    // Fetch all categories
    const catRes = await fetch(`${MERCADONA_BASE}/categories/`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json, text/plain, */*' },
    })
    if (!catRes.ok) return null
    const catData = await catRes.json()

    const categorias: { id: number }[] = catData.results ?? []
    const palabras = terminoNorm.split(' ')

    let mejorMatch: ProductoMercadona | null = null
    let mejorPuntuacion = 0

    // Search through categories looking for matching products
    for (const cat of categorias) {
      const subRes = await fetch(`${MERCADONA_BASE}/categories/${cat.id}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json, text/plain, */*' },
      })
      if (!subRes.ok) continue
      const subData = await subRes.json()

      const subcategorias = subData.categories ?? []
      for (const sub of subcategorias) {
        const productos = sub.products ?? []
        for (const prod of productos) {
          const nombreNorm = normalizar(prod.display_name ?? '')
          const palabrasMatch = palabras.filter((p: string) => nombreNorm.includes(p)).length
          const puntuacion = palabrasMatch / palabras.length

          if (puntuacion > mejorPuntuacion) {
            mejorPuntuacion = puntuacion
            mejorMatch = parsearProducto(prod)
          }
        }
      }

      if (mejorPuntuacion >= 0.8) break // good enough match, stop searching
    }

    return mejorPuntuacion >= 0.5 ? mejorMatch : null
  } catch {
    return null
  }
}

function parsearProducto(raw: Record<string, unknown>): ProductoMercadona | null {
  try {
    const pi = raw.price_instructions as Record<string, unknown> | undefined
    if (!pi) return null

    const precio = Number(pi.unit_price ?? pi.bulk_price ?? 0)
    const skuQty = Number(pi.sku_quantity ?? 1)
    const approxSize = skuQty > 0 ? skuQty : 1

    // Try to detect unit from product name or reference_format
    const refFormat = String(raw.format ?? raw.reference_format ?? '')
    const unidadMatch = refFormat.match(/(\d+)\s*(g|kg|ml|l|ud)/i)
    const tamaño = unidadMatch ? Number(unidadMatch[1]) : approxSize
    const unidad = unidadMatch ? unidadMatch[2].toLowerCase() : 'ud'

    const precioPorUnidad = tamaño > 0 ? precio / tamaño : precio

    return {
      id: String(raw.id ?? ''),
      nombre: String(raw.display_name ?? ''),
      precio,
      tamaño,
      unidad,
      precio_por_unidad: precioPorUnidad,
    }
  } catch {
    return null
  }
}

// ─── Unit conversion helpers ──────────────────────────────────────────────────
// Convert ingredient quantity to same unit as the product for packaging math
function convertir(cantidad: number, unidadIngrediente: string, unidadProducto: string): number {
  // Normalize both units
  const uIng = unidadIngrediente.toLowerCase()
  const uProd = unidadProducto.toLowerCase()

  if (uIng === uProd) return cantidad

  // g ↔ kg
  if (uIng === 'g' && uProd === 'kg') return cantidad / 1000
  if (uIng === 'kg' && uProd === 'g') return cantidad * 1000

  // ml ↔ l
  if (uIng === 'ml' && uProd === 'l') return cantidad / 1000
  if (uIng === 'l' && uProd === 'ml') return cantidad * 1000

  // Fallback: assume 1:1
  return cantidad
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  try {
    const { ingredientes, codigo_postal = '28001' } = await req.json() as {
      ingredientes: Array<{ nombre: string; cantidad: number; unidad: string }>
      codigo_postal: string
    }

    const resultados = await Promise.all(
      ingredientes.map(async (ing) => {
        const producto = await buscarProducto(ing.nombre, codigo_postal)

        if (!producto) {
          return {
            ingrediente: ing.nombre,
            cantidad_necesaria: ing.cantidad,
            unidad: ing.unidad,
            sin_precio: true,
          }
        }

        const cantConvertida = convertir(ing.cantidad, ing.unidad, producto.unidad)
        const envases = Math.ceil(cantConvertida / producto.tamaño)
        const costeReal = envases * producto.precio
        const sobrante = envases * producto.tamaño - cantConvertida

        return {
          ingrediente: ing.nombre,
          cantidad_necesaria: ing.cantidad,
          unidad: ing.unidad,
          producto_mercadona: producto.nombre,
          precio_envase: producto.precio,
          tamaño_envase: producto.tamaño,
          unidad_envase: producto.unidad,
          envases_a_comprar: envases,
          coste_real: Math.round(costeReal * 100) / 100,
          sobrante: Math.round(sobrante * 10) / 10,
          sin_precio: false,
        }
      })
    )

    return new Response(
      JSON.stringify({ resultados }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: true, mensaje: err instanceof Error ? err.message : 'Error interno' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
