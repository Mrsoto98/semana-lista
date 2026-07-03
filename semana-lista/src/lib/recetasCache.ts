import { supabase } from './supabase'
import type { Receta } from '../types'

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt'

export function fotoUrlPollinations(nombre: string): string {
  const prompt = encodeURIComponent(`${nombre}, plato de comida servido en mesa, vista desde arriba, fotografía gastronómica profesional, plato completo visible, encuadre amplio`)
  return `${POLLINATIONS_BASE}/${prompt}?width=600&height=300&nologo=true&seed=${nombre.length}`
}

// Cache en memoria para esta sesión (evita queries repetidas a Supabase)
const memoriaImagenes: Record<string, string> = {}

export async function obtenerImagenReceta(nombre: string): Promise<string> {
  if (memoriaImagenes[nombre]) return memoriaImagenes[nombre]

  const { data } = await supabase
    .from('recetas_cache')
    .select('imagen_url')
    .eq('nombre', nombre)
    .maybeSingle()

  if (data?.imagen_url) {
    memoriaImagenes[nombre] = data.imagen_url
    return data.imagen_url
  }

  // No está en caché → devolver URL de Pollinations y guardarla en background
  const url = fotoUrlPollinations(nombre)
  memoriaImagenes[nombre] = url

  // Guardar en caché de forma asíncrona
  supabase.from('recetas_cache').upsert(
    { nombre, imagen_url: url, updated_at: new Date().toISOString() },
    { onConflict: 'nombre', ignoreDuplicates: false }
  ).then(({ error }) => { if (error) console.warn('cache imagen:', error.message) })

  return url
}

export async function guardarRecetasEnCache(recetas: Receta[]): Promise<void> {
  if (!recetas.length) return

  const filas = recetas.map(r => ({
    nombre: r.nombre,
    descripcion_corta: r.descripcion_corta,
    tags: r.tags,
    kcal: r.calorias_aprox,
    tiempo_min: r.tiempo_prep,
    dificultad: r.dificultad,
    ingredientes: r.ingredientes,
    imagen_url: memoriaImagenes[r.nombre] ?? fotoUrlPollinations(r.nombre),
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('recetas_cache').upsert(filas, {
    onConflict: 'nombre',
    ignoreDuplicates: false,
  })

  if (error) console.warn('guardar recetas cache:', error.message)
  else {
    // Incrementar contador de veces_generada
    await Promise.all(recetas.map(r =>
      supabase.rpc('incrementar_veces_generada', { p_nombre: r.nombre }).then(() => {}, () => {})
    ))
  }
}
