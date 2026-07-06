// src/hooks/useComunidad.ts
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface Publicacion {
  id: string
  usuario_id: string
  tipo: 'receta_app' | 'receta_personal' | 'foto'
  receta_nombre?: string
  titulo: string
  descripcion?: string
  ingredientes?: { nombre: string; cantidad: number; unidad: string }[]
  pasos?: string[]
  fotos: string[]
  foto_portada?: string
  visibilidad: 'publico' | 'amigos' | 'privado'
  likes_count: number
  created_at: string
  autor?: { nombre_display?: string; avatar_emoji?: string; avatar_url?: string }
  yo_di_like?: boolean
}

export function useComunidad() {
  const { user } = useAuth()
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const PAGE = 12

  const cargar = useCallback(async (desde = 0) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('publicaciones')
        .select(`
          *,
          autor:usuarios!usuario_id(nombre_display, avatar_emoji, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .range(desde, desde + PAGE - 1)

      if (error) throw error
      const items = (data ?? []) as Publicacion[]

      // Marcar likes propios
      if (user && items.length > 0) {
        const ids = items.map(p => p.id)
        const { data: likes } = await supabase
          .from('publicaciones_likes')
          .select('publicacion_id')
          .eq('usuario_id', user.id)
          .in('publicacion_id', ids)
        const likeSet = new Set((likes ?? []).map((l: { publicacion_id: string }) => l.publicacion_id))
        items.forEach(p => { p.yo_di_like = likeSet.has(p.id) })
      }

      if (desde === 0) setPublicaciones(items)
      else setPublicaciones(prev => [...prev, ...items])
      setHasMore(items.length === PAGE)
    } finally {
      setLoading(false)
    }
  }, [user])

  async function toggleLike(pub: Publicacion) {
    if (!user) return
    const optimista = !pub.yo_di_like
    setPublicaciones(prev => prev.map(p =>
      p.id === pub.id
        ? { ...p, yo_di_like: optimista, likes_count: p.likes_count + (optimista ? 1 : -1) }
        : p
    ))
    if (optimista) {
      await supabase.from('publicaciones_likes').insert({ publicacion_id: pub.id, usuario_id: user.id })
    } else {
      await supabase.from('publicaciones_likes').delete()
        .eq('publicacion_id', pub.id).eq('usuario_id', user.id)
    }
  }

  async function crearPublicacion(datos: {
    tipo: Publicacion['tipo']
    titulo: string
    descripcion?: string
    receta_nombre?: string
    ingredientes?: Publicacion['ingredientes']
    pasos?: string[]
    fotos?: File[]
    visibilidad: Publicacion['visibilidad']
  }): Promise<{ error?: string }> {
    if (!user) return { error: 'No autenticado' }
    try {
      const fotosUrls: string[] = []
      for (const file of datos.fotos ?? []) {
        const ext = file.name.split('.').pop()
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('comunidad-fotos').upload(path, file)
        if (upErr) return { error: 'Error subiendo foto' }
        const { data: urlData } = supabase.storage.from('comunidad-fotos').getPublicUrl(path)
        fotosUrls.push(urlData.publicUrl)
      }
      const { error } = await supabase.from('publicaciones').insert({
        usuario_id: user.id,
        tipo: datos.tipo,
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        receta_nombre: datos.receta_nombre,
        ingredientes: datos.ingredientes ?? null,
        pasos: datos.pasos ?? null,
        fotos: fotosUrls,
        foto_portada: fotosUrls[0] ?? null,
        visibilidad: datos.visibilidad,
      })
      if (error) return { error: error.message }
      await cargar(0)
      return {}
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : 'Error desconocido' }
    }
  }

  async function eliminar(id: string): Promise<void> {
    await supabase.from('publicaciones').delete().eq('id', id)
    setPublicaciones(prev => prev.filter(p => p.id !== id))
  }

  return { publicaciones, loading, hasMore, cargar, toggleLike, crearPublicacion, eliminar }
}
