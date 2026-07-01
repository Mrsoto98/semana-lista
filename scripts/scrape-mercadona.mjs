/**
 * Extrae el catálogo completo de Mercadona con precios.
 * Uso: node scripts/scrape-mercadona.mjs
 *
 * Estructura de la API:
 *   /categories/          → categorías top-level con sus subcategorías listadas
 *   /categories/{subId}/  → subcategoría con sub-subcategorías que tienen productos inline
 *
 * Guarda el resultado en src/data/mercadona.json
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_FILE = join(__dirname, '..', 'src', 'data', 'mercadona.json')
const BASE = 'https://tienda.mercadona.es/api'
const DELAY_MS = 400

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  'Accept': 'application/json',
  'Accept-Language': 'es-ES,es;q=0.9',
  'Referer': 'https://tienda.mercadona.es/',
  'Origin': 'https://tienda.mercadona.es',
}

function parsearProducto(raw) {
  try {
    const pi = raw.price_instructions
    if (!pi) return null
    const precio = parseFloat(pi.unit_price ?? pi.bulk_price ?? 0)
    if (!precio) return null

    const texto = raw.format ?? raw.reference_format ?? raw.packaging ?? raw.display_name ?? ''
    const m = texto.match(/([\d,.]+)\s*(g|kg|ml|l|cl|ud)/i)
    const tamaño = m ? parseFloat(m[1].replace(',', '.')) : parseFloat(pi.sku_quantity ?? 1)
    const unidad = m ? m[2].toLowerCase() : 'ud'

    // Precio de referencia por kg (el que Mercadona muestra en la etiqueta para comparar).
    // Aplica a productos envasados y sueltos. reference_format: "1 kg" o "100 g"
    const refPrice = pi.reference_price != null ? parseFloat(pi.reference_price) : null
    const refFormat = String(pi.reference_format ?? '')
    let precioKg = null
    if (refPrice && refPrice > 0) {
      if (/\bkg\b/i.test(refFormat)) {
        precioKg = Math.round(refPrice * 100) / 100
      } else if (/100\s*g/i.test(refFormat)) {
        precioKg = Math.round(refPrice * 10 * 100) / 100
      }
    }

    return {
      id: String(raw.id ?? ''),
      nombre: String(raw.display_name ?? ''),
      precio: Math.round(precio * 100) / 100,
      tamaño,
      unidad,
      foto: raw.thumbnail ?? null,
      precio_kg: precioKg,
    }
  } catch { return null }
}

async function main() {
  console.log('\n🔴 Extrayendo catálogo de Mercadona...\n')

  // 1. Categorías top-level (ya incluyen los IDs de subcategorías)
  console.log('📂 Cargando categorías principales...')
  const r1 = await fetch(`${BASE}/categories/?lang=es`, { headers: HEADERS })
  if (!r1.ok) throw new Error(`Error ${r1.status} al cargar categorías`)

  const data1 = await r1.json()
  const topcats = data1.results ?? (Array.isArray(data1) ? data1 : [])
  console.log(`   → ${topcats.length} categorías top-level\n`)

  // 2. Para cada top-cat, iterar sus subcategorías y pedir sus productos
  const catalogo = {}
  let totalProductos = 0
  let catOk = 0
  let catErr = 0

  for (const topcat of topcats) {
    const nombreCat = String(topcat.name ?? topcat.id)
    const subcats = topcat.categories ?? []

    if (subcats.length === 0) continue

    const productosDeCategoria = []

    for (const sub of subcats) {
      await sleep(DELAY_MS)

      try {
        const r2 = await fetch(`${BASE}/categories/${sub.id}/?lang=es`, { headers: HEADERS })
        if (!r2.ok) {
          process.stdout.write(`⚠️  `)
          continue
        }

        const data2 = await r2.json()
        // Los productos están en sub-subcategorías embebidas en este nivel
        const subSubcats = data2.categories ?? []

        for (const ssc of subSubcats) {
          for (const prod of (ssc.products ?? [])) {
            const p = parsearProducto(prod)
            if (p) productosDeCategoria.push(p)
          }
        }
      } catch (e) {
        process.stdout.write(`❌ `)
      }
    }

    if (productosDeCategoria.length > 0) {
      catalogo[nombreCat] = productosDeCategoria
      totalProductos += productosDeCategoria.length
      catOk++
      console.log(`✅ ${nombreCat}: ${productosDeCategoria.length} productos`)
    } else {
      catErr++
      console.log(`⚪ ${nombreCat}: sin productos`)
    }
  }

  // 3. Guardar
  const output = {
    actualizado: new Date().toISOString(),
    total_productos: totalProductos,
    categorias: catalogo,
  }

  mkdirSync(dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf-8')

  const conPrecioKg = Object.values(catalogo).flat().filter(p => p.precio_kg != null).length
  console.log(`\n✅ LISTO`)
  console.log(`   Categorías con productos: ${catOk}`)
  console.log(`   Productos totales: ${totalProductos}`)
  console.log(`   Con precio/kg: ${conPrecioKg}`)
  console.log(`   Guardado en: src/data/mercadona.json`)
  console.log('\n💡 Para actualizar precios: node scripts/scrape-mercadona.mjs\n')
}

main().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1) })
