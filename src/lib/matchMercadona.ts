// Matching de ingredientes genéricos de la IA → productos reales del catálogo Mercadona

interface Producto { nombre: string; precio: number; precio_kg?: number | null }

// Palabras de preparación culinaria que no son el ingrediente en sí
const PREP = /\b(plancha|cocido|cocida|cocidos|cocidas|frito|frita|fritos|fritas|asado|asada|asados|asadas|hervido|hervida|gratinado|crudo|cruda|troceado|laminado|rallado|molido|picado|relleno|empanado|marinado|adobado|salteado|vapor|horno|guisado|estofado|brasa|barbacoa|rebozado|congelado|fresco|seco|natural|envasado|enlatado|en conserva)\b/gi
const STOPWORDS = new Set(['de','del','al','con','sin','para','en','a','la','el','los','las','un','una','y','e','o','u','lo','le','se','su','sus','por','que','como','sobre','bajo','muy','más','poco','mucho'])

// Sinónimos: normaliza términos de la IA a los nombres que usa Mercadona
// Primero los multi-palabra (para que no los rompa el singular)
const SINONIMOS_MULTI: [RegExp, string][] = [
  [/leche de coco/gi, 'bebida coco'],
  [/leche de almendras/gi, 'bebida almendras'],
  [/leche de avena/gi, 'bebida avena'],
  [/leche de soja/gi, 'bebida soja'],
  [/pimiento morron/gi, 'pimiento rojo'],
  [/caldo de pollo/gi, 'caldo pollo'],
  [/caldo de verduras/gi, 'caldo verduras'],
  [/caldo de pescado/gi, 'caldo pescado'],
  [/aceite de oliva/gi, 'aceite oliva'],
  [/aceite de girasol/gi, 'aceite girasol'],
  [/tomate natural/gi, 'tomate'],
  [/harina de trigo/gi, 'harina'],
  [/azucar morena/gi, 'azucar moreno'],
  [/jugo de limon/gi, 'zumo limon'],
  [/jugo de naranja/gi, 'zumo naranja'],
]
// Sinónimos de palabra única
const SINONIMOS_WORD: Record<string, string> = {
  'jugo': 'zumo',
  'nata': 'crema',
  'palta': 'aguacate',
  'chile': 'guindilla',
  'ternera': 'vacuno',    // Mercadona usa "vacuno" para la carne de ternera
  'res': 'vacuno',
  'vaca': 'vacuno',
  'cerdo': 'cerdo',
  'rape': 'rape',
}

function aplicarSinonimos(s: string): string {
  let out = s
  // Multi-palabra primero
  for (const [re, to] of SINONIMOS_MULTI) out = out.replace(re, to)
  // Palabra única
  for (const [from, to] of Object.entries(SINONIMOS_WORD)) {
    out = out.replace(new RegExp(`\\b${from}\\b`, 'gi'), to)
  }
  return out
}

function quitarAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function tokenizar(nombre: string): string[] {
  let s = nombre.toLowerCase()
  s = aplicarSinonimos(s)
  s = s.replace(PREP, ' ')
  s = quitarAcentos(s)
  s = s.replace(/[^a-z\s]/g, ' ')
  return s.split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w))
}

function score(queryTokens: string[], productoNombre: string): number {
  if (!queryTokens.length) return 0
  const pn = quitarAcentos(productoNombre.toLowerCase())
  const prodTokens = pn.split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w))
  let coincidencias = 0
  for (const tok of queryTokens) {
    if (pn.includes(tok)) coincidencias++
  }
  if (coincidencias === 0) return 0
  // Ratio de query cubierta
  const coverage = coincidencias / queryTokens.length
  // Penalizar si la query es pequeña fracción del producto
  // (e.g. "ternera" en "Paté gato adulto Delikuit con ternera" → 1/6 palabras del producto)
  const productCoverage = coincidencias / Math.max(prodTokens.length, 1)
  return (coverage * 0.6 + productCoverage * 0.4)
}

export interface MatchProducto { nombre: string; precio: number }

export function topMatchesMercadona(
  nombre: string,
  catalogo: Record<string, Producto[]>,
  limite = 6
): MatchProducto[] {
  const tokens = tokenizar(nombre)
  if (!tokens.length) return []

  const scored: { prod: Producto; s: number }[] = []
  const seen = new Set<string>()

  for (const productos of Object.values(catalogo)) {
    for (const prod of productos) {
      if (seen.has(prod.nombre)) continue
      seen.add(prod.nombre)
      const s = score(tokens, prod.nombre)
      if (s > 0) scored.push({ prod, s })
    }
  }

  return scored
    .sort((a, b) => b.s - a.s)
    .slice(0, limite)
    .map(({ prod }) => ({ nombre: prod.nombre, precio: prod.precio }))
}

export function matchMercadona(
  nombre: string,
  catalogo: Record<string, Producto[]>
): { nombre: string; precio?: number } {
  const top = topMatchesMercadona(nombre, catalogo, 1)
  return top.length ? top[0] : { nombre }
}
