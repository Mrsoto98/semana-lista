import { supabase } from './supabase'
import type { MatchProducto } from './matchMercadona'

// Normaliza el nombre del ingrediente para usar como clave en la BD
export function normalizarIngrediente(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

// Obtiene las opciones aprendidas por la comunidad para un ingrediente
export async function fetchLearnedOptions(ingrediente: string): Promise<(MatchProducto & { votos: number })[]> {
  const key = normalizarIngrediente(ingrediente)
  const { data } = await supabase
    .from('aprendizaje_picker')
    .select('producto_nombre, producto_precio, producto_foto, votos')
    .eq('ingrediente', key)
    .order('votos', { ascending: false })
    .limit(8)

  if (!data) return []
  return data.map(row => ({
    nombre: row.producto_nombre,
    precio: row.producto_precio ?? 0,
    foto: row.producto_foto ?? null,
    votos: row.votos,
  }))
}

// Registra la elección del usuario (upsert con incremento de votos)
export async function saveLearnedOption(ingrediente: string, producto: MatchProducto): Promise<void> {
  const key = normalizarIngrediente(ingrediente)
  // Intentar incrementar si ya existe, o insertar nuevo
  const { error: upsertError } = await supabase.rpc('incrementar_voto_picker', {
    p_ingrediente: key,
    p_nombre: producto.nombre,
    p_precio: producto.precio || null,
    p_foto: producto.foto || null,
  })
  if (upsertError) {
    // Fallback: insert directo (si la función RPC no existe aún)
    await supabase.from('aprendizaje_picker').upsert(
      {
        ingrediente: key,
        producto_nombre: producto.nombre,
        producto_precio: producto.precio || null,
        producto_foto: producto.foto || null,
        votos: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'ingrediente,producto_nombre', ignoreDuplicates: false }
    )
  }
}

// Carga en batch las asociaciones aprendidas para varios ingredientes.
// Devuelve Map<ingredienteNorm, Set<productoNombre>>
export async function fetchAllLearnedAssocs(ingredientes: string[]): Promise<Map<string, Set<string>>> {
  if (!ingredientes.length) return new Map()
  const keys = ingredientes.map(normalizarIngrediente)
  const { data } = await supabase
    .from('aprendizaje_picker')
    .select('ingrediente, producto_nombre')
    .in('ingrediente', keys)
  const map = new Map<string, Set<string>>()
  if (!data) return map
  for (const row of data) {
    if (!map.has(row.ingrediente)) map.set(row.ingrediente, new Set())
    map.get(row.ingrediente)!.add(row.producto_nombre)
  }
  return map
}

// Fusiona opciones IA con opciones aprendidas.
// Orden: coincidencia exacta de nombre → aprendidas por votos → resto IA
export function mergePickerOptions(
  ai: MatchProducto[],
  learned: (MatchProducto & { votos: number })[],
  etiqueta: string,
): MatchProducto[] {
  const etiqLower = etiqueta.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  // Exact: opciones IA cuyo nombre contiene la etiqueta completa
  const exact = ai.filter(op =>
    op.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(etiqLower)
  )
  const seen = new Set(exact.map(op => op.nombre))

  // Aprendidas que no estén ya en exact
  const learnedNew = learned.filter(op => !seen.has(op.nombre))
  learnedNew.forEach(op => seen.add(op.nombre))

  // Resto de IA
  const rest = ai.filter(op => !seen.has(op.nombre))

  return [...exact, ...learnedNew, ...rest]
}
