// Lógica de resolución de zona logística Mercadona por código postal
// Regla: el catálogo maestro (mercadona.json / productos_mercadona) no se toca.
// Solo se usa para obtener la zona correcta del usuario.

import { supabase } from './supabase'

// ── Mapeo provincia (2 primeros dígitos del CP) → zona objetivo ───────────────
// Cuando la zona objetivo no tenga datos, el fallback busca la más cercana activa.
const PROVINCIA_ZONA: Record<string, string> = {
  '01': 'norte',      // Álava
  '02': 'levante',    // Albacete
  '03': 'levante',    // Alicante
  '04': 'andalucia',  // Almería
  '05': 'madrid',     // Ávila
  '06': 'andalucia',  // Badajoz
  '07': 'barcelona',  // Baleares
  '08': 'barcelona',  // Barcelona
  '09': 'norte',      // Burgos
  '10': 'madrid',     // Cáceres
  '11': 'andalucia',  // Cádiz
  '12': 'levante',    // Castellón
  '13': 'madrid',     // Ciudad Real
  '14': 'andalucia',  // Córdoba
  '15': 'norte',      // A Coruña
  '16': 'levante',    // Cuenca
  '17': 'barcelona',  // Girona
  '18': 'andalucia',  // Granada
  '19': 'madrid',     // Guadalajara
  '20': 'norte',      // Gipuzkoa
  '21': 'andalucia',  // Huelva
  '22': 'barcelona',  // Huesca
  '23': 'andalucia',  // Jaén
  '24': 'norte',      // León
  '25': 'barcelona',  // Lleida
  '26': 'norte',      // La Rioja
  '27': 'norte',      // Lugo
  '28': 'madrid',     // Madrid
  '29': 'andalucia',  // Málaga
  '30': 'levante',    // Murcia
  '31': 'norte',      // Navarra
  '32': 'norte',      // Ourense
  '33': 'norte',      // Asturias
  '34': 'norte',      // Palencia
  '35': 'canarias',   // Las Palmas (Gran Canaria)
  '36': 'norte',      // Pontevedra
  '37': 'madrid',     // Salamanca
  '38': 'canarias',   // Santa Cruz de Tenerife
  '39': 'norte',      // Cantabria
  '40': 'madrid',     // Segovia
  '41': 'andalucia',  // Sevilla
  '42': 'madrid',     // Soria
  '43': 'barcelona',  // Tarragona
  '44': 'levante',    // Teruel
  '45': 'madrid',     // Toledo
  '46': 'levante',    // Valencia
  '47': 'norte',      // Valladolid
  '48': 'norte',      // Bizkaia
  '49': 'madrid',     // Zamora
  '50': 'barcelona',  // Zaragoza
  '51': 'andalucia',  // Ceuta
  '52': 'andalucia',  // Melilla
}

// Fallback ordenado: si la zona objetivo no está activa, probamos en este orden
const FALLBACK_ZONA: Record<string, string[]> = {
  'madrid':    ['barcelona', 'norte', 'levante', 'andalucia'],
  'norte':     ['barcelona', 'madrid', 'levante', 'andalucia'],
  'levante':   ['barcelona', 'madrid', 'andalucia', 'norte'],
  'andalucia': ['barcelona', 'levante', 'madrid', 'norte'],
  'canarias':  ['barcelona', 'levante', 'andalucia', 'madrid'],
  'barcelona': [], // si barcelona no está activa algo muy malo pasó
}

// Zonas activas — se cachea en memoria para no hacer N queries
let _zonasActivasCache: Set<string> | null = null
let _cacheTs = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 minutos

async function getZonasActivas(): Promise<Set<string>> {
  if (_zonasActivasCache && Date.now() - _cacheTs < CACHE_TTL) {
    return _zonasActivasCache
  }
  try {
    const { data } = await supabase
      .from('zonas_mercadona')
      .select('id')
      .eq('activa', true)
    _zonasActivasCache = new Set((data ?? []).map((r: { id: string }) => r.id))
    _cacheTs = Date.now()
  } catch {
    // Si falla la red, al menos asumimos barcelona
    _zonasActivasCache = new Set(['barcelona'])
  }
  return _zonasActivasCache!
}

/**
 * Resuelve la zona logística a partir de un código postal español.
 * Si la zona ideal no tiene datos, usa la más cercana geográficamente que sí tenga.
 * Garantía: siempre devuelve 'barcelona' como último recurso.
 */
export async function resolverZona(codigoPostal: string): Promise<string> {
  const cp = codigoPostal.trim().replace(/\s/g, '')
  if (cp.length < 2) return 'barcelona'

  const prov = cp.slice(0, 2)
  const zonaIdeal = PROVINCIA_ZONA[prov] ?? 'barcelona'

  const activas = await getZonasActivas()

  // Zona ideal disponible → usarla directamente
  if (activas.has(zonaIdeal)) return zonaIdeal

  // Buscar fallback más cercano con datos
  for (const fallback of (FALLBACK_ZONA[zonaIdeal] ?? [])) {
    if (activas.has(fallback)) return fallback
  }

  return 'barcelona'
}

/**
 * Dado el zona_id del usuario, devuelve el CP de referencia para la API de Mercadona.
 * Útil para el edge function de precios.
 */
export const ZONA_CP_REF: Record<string, string> = {
  barcelona: '08720',
  madrid:    '28001',
  levante:   '46001',
  andalucia: '41001',
  norte:     '48001',
  canarias:  '35001',
}

/**
 * Invalida el caché de zonas activas (llamar tras sincronizar una zona nueva).
 */
export function invalidarCacheZonas() {
  _zonasActivasCache = null
}
