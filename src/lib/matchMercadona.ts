// Matching de ingredientes genéricos de la IA → productos reales del catálogo Mercadona

interface Producto { id?: string; nombre: string; precio: number; precio_kg?: number | null; foto?: string | null; tamaño?: number; unidad?: string }

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
  'boniato': 'batata',
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

function tokenizar(nombre: string, stripPrep = true): string[] {
  let s = nombre.toLowerCase()
  s = aplicarSinonimos(s)
  if (stripPrep) s = s.replace(PREP, ' ')
  s = quitarAcentos(s)
  s = s.replace(/[^a-z\s]/g, ' ')
  return s.split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w))
}

// coverage = fracción de tokens de la query encontrados en el producto (1.0 = todos)
function score(queryTokens: string[], productoNombre: string): { total: number; coverage: number; coincidencias: number } {
  if (!queryTokens.length) return { total: 0, coverage: 0, coincidencias: 0 }
  const pn = quitarAcentos(productoNombre.toLowerCase())
  const prodTokens = pn.split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w))
  let coincidencias = 0
  for (const tok of queryTokens) {
    if (pn.includes(tok)) coincidencias++
  }
  if (coincidencias === 0) return { total: 0, coverage: 0, coincidencias: 0 }
  // Ratio de query cubierta
  const coverage = coincidencias / queryTokens.length
  // Penalizar si la query es pequeña fracción del producto
  // (e.g. "ternera" en "Paté gato adulto Delikuit con ternera" → 1/6 palabras del producto)
  const productCoverage = coincidencias / Math.max(prodTokens.length, 1)
  // Bonus fuerte si el producto EMPIEZA por la palabra buscada: distingue el
  // producto en sí ("Aceite de oliva") de otro que solo lo menciona como
  // ingrediente secundario ("Atún EN aceite de oliva"). Usa includes en vez de
  // igualdad exacta para tolerar singular/plural ("cebolla" ~ "cebollas").
  const primerToken = prodTokens[0] ?? ''
  // Solo dar bonus si además coinciden ≥2 tokens, para que palabras genéricas
  // como "aceite" no eleven productos irrelevantes ("Aceite de Ricino" al buscar "aceite girasol")
  const empiezaConQuery = coincidencias >= 2 && primerToken.length > 0 && queryTokens.some(tok => primerToken.includes(tok) || tok.includes(primerToken))
  const total = coverage * 0.4 + productCoverage * 0.2 + (empiezaConQuery ? 0.4 : 0)
  return { total, coverage, coincidencias }
}

export interface MatchProducto { nombre: string; precio: number; foto?: string | null; precio_kg?: number | null; tamaño?: number; unidad?: string }

function buscarConTokens(tokens: string[], catalogo: Record<string, Producto[]>): { prod: Producto; total: number; coverage: number; coincidencias: number }[] {
  if (!tokens.length) return []
  const scored: { prod: Producto; total: number; coverage: number; coincidencias: number }[] = []
  const seen = new Set<string>()
  for (const productos of Object.values(catalogo)) {
    for (const prod of productos) {
      // Deduplicar por id cuando existe, si no por nombre+precio para conservar variantes de distinto tamaño
      const key = prod.id ?? `${prod.nombre}__${prod.precio}`
      if (seen.has(key)) continue
      seen.add(key)
      const { total, coverage, coincidencias } = score(tokens, prod.nombre)
      const minCoincidencias = tokens.length >= 3 ? 2 : 1
      if (total > 0 && coincidencias >= minCoincidencias) scored.push({ prod, total, coverage, coincidencias })
    }
  }
  return scored.sort((a, b) => b.total - a.total)
}

export function topMatchesMercadona(
  nombre: string,
  catalogo: Record<string, Producto[]>,
  limite = 6
): MatchProducto[] {
  // Primer intento: frase completa, sin quitar palabras de preparación
  // (necesario para productos cuyo nombre real incluye esa palabra, como "Tomate frito").
  const tokensCompletos = tokenizar(nombre, false)
  const resultadosCompletos = buscarConTokens(tokensCompletos, catalogo)

  // Si el mejor resultado cubre TODOS los tokens de la query, es un match fiable de la frase tal cual.
  let scored = resultadosCompletos
  if (!resultadosCompletos.length || resultadosCompletos[0].coverage < 1) {
    // Si no, probablemente "frito"/"asado"/etc. era una técnica de cocción, no parte
    // del nombre del producto (ej. "pollo frito" → buscar "pollo"). Reintentar sin esas palabras.
    const tokensSinPrep = tokenizar(nombre, true)
    const resultadosSinPrep = buscarConTokens(tokensSinPrep, catalogo)
    scored = resultadosSinPrep.length ? resultadosSinPrep : resultadosCompletos
  }

  return scored
    .slice(0, limite)
    .map(({ prod }) => ({ nombre: prod.nombre, precio: prod.precio, foto: prod.foto, precio_kg: prod.precio_kg, tamaño: prod.tamaño, unidad: prod.unidad }))
}

export function matchMercadona(
  nombre: string,
  catalogo: Record<string, Producto[]>
): { nombre: string; precio?: number } {
  const top = topMatchesMercadona(nombre, catalogo, 1)
  return top.length ? top[0] : { nombre }
}

// ── Agrupación de variantes del mismo ingrediente base ──────────────────────
// Usado por "Del menú esta semana" (Lista.tsx y ListaCompartida.tsx) para
// fusionar en un solo botón las distintas variantes que pidan las recetas
// (ej. "Aceite de oliva 0" y "Aceite de oliva virgen" → "Aceite de oliva").

// Clave de agrupación: primeras 2 palabras significativas del nombre (sin
// acentos, sin preposiciones ni números/grados).
export function baseKeyIngrediente(nombre: string): string {
  const s = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const tokens = s.split(/[^a-z]+/).filter(w => w.length > 2)
  return tokens.slice(0, 2).join(' ')
}

export function etiquetaGrupo(nombres: string[]): string {
  const [a, b] = baseKeyIngrediente(nombres[0]).split(' ')
  if (!a) return nombres[0]
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)
  return b ? `${cap(a)} de ${b}` : cap(a)
}

export interface GrupoIngrediente { key: string; items: string[]; etiqueta: string }

export function agruparIngredientes(items: string[]): GrupoIngrediente[] {
  const grupos = new Map<string, string[]>()
  for (const item of items) {
    const key = baseKeyIngrediente(item)
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key)!.push(item)
  }
  return Array.from(grupos.entries()).map(([key, grupoItems]) => ({
    key,
    items: grupoItems,
    etiqueta: grupoItems.length > 1 ? etiquetaGrupo(grupoItems) : grupoItems[0],
  }))
}

// Un ingrediente del menú (nombre genérico, ej. "Aceite de oliva 0") cuenta
// como resuelto contra un Set de nombres reales (en casa o comprar) si su
// nombre está directamente en el Set, o si el producto real que mejor le
// corresponde (el mismo que resolvería el picker) ya está en ese Set.
export function resolverContraSet(
  items: string[],
  set: Set<string>,
  catalogo: Record<string, Producto[]> | undefined
): Set<string> {
  const resueltos = new Set<string>()
  for (const item of items) {
    if (set.has(item)) { resueltos.add(item); continue }
    if (catalogo) {
      // Comprobar top 6 matches para cubrir todas las variantes del mismo producto
      // (Botella, Garrafa, etc.) independientemente de cuál añadió el usuario
      const tops = topMatchesMercadona(item, catalogo, 6)
      if (tops.some(m => set.has(m.nombre))) resueltos.add(item)
    }
  }
  return resueltos
}

// Nombre bajo el que un ingrediente del menú está realmente guardado en un
// Set: el genérico si coincide tal cual, si no el producto real resuelto.
export function nombreGuardadoComo(
  item: string,
  set: Set<string>,
  catalogo: Record<string, Producto[]> | undefined
): string {
  if (set.has(item)) return item
  if (catalogo) {
    // Buscar entre top 6 el que esté en el set (puede ser cualquier variante)
    const tops = topMatchesMercadona(item, catalogo, 6)
    const enSet = tops.find(m => set.has(m.nombre))
    if (enSet) return enSet.nombre
    return tops[0]?.nombre ?? item
  }
  return item
}

// Expande "Aceite, especias y salsas" en tres subcategorías independientes
const ACEITE_RE = /\baceite\b/i
const VINAGRE_RE = /\bvinagre\b/i

export function expandirCatalogo(catalogo: Record<string, Producto[]>): Record<string, Producto[]> {
  const CAT_ORIGEN = 'Aceite, especias y salsas'
  if (!catalogo[CAT_ORIGEN]) return catalogo
  const prods = catalogo[CAT_ORIGEN]
  const aceites: Producto[] = []
  const resto: Producto[] = []
  for (const p of prods) {
    if (ACEITE_RE.test(p.nombre) || VINAGRE_RE.test(p.nombre)) aceites.push(p)
    else resto.push(p)
  }
  const result = { ...catalogo }
  delete result[CAT_ORIGEN]
  if (aceites.length) result['Aceites y vinagres'] = aceites
  if (resto.length) result['Especias, salsas y aderezos'] = resto
  return result
}
