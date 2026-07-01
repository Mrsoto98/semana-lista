import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface PreferenciaReceta {
  id: string
  receta_nombre: string
  tipo: 'like' | 'dislike'
  motivo?: string
  ingredientes_no_gustan: string[]
}

export function usePreferencias() {
  const { user } = useAuth()
  const [preferencias, setPreferencias] = useState<PreferenciaReceta[]>([])

  useEffect(() => {
    if (!user) return
    supabase
      .from('preferencias_receta')
      .select('*')
      .eq('usuario_id', user.id)
      .then(({ data }) => setPreferencias((data ?? []) as PreferenciaReceta[]))
  }, [user])

  const likes = new Set(preferencias.filter(p => p.tipo === 'like').map(p => p.receta_nombre))
  const dislikes = new Set(preferencias.filter(p => p.tipo === 'dislike').map(p => p.receta_nombre))

  // Lista única de ingredientes marcados como no gustados en todos los dislikes
  const ingredientesEvitar = [...new Set(preferencias.filter(p => p.tipo === 'dislike').flatMap(p => p.ingredientes_no_gustan))]

  const guardarPreferencia = useCallback(async (
    recetaNombre: string,
    tipo: 'like' | 'dislike',
    motivo?: string,
    ingredientesNoGustan?: string[],
  ) => {
    if (!user) return
    const { data } = await supabase
      .from('preferencias_receta')
      .upsert(
        { usuario_id: user.id, receta_nombre: recetaNombre, tipo, motivo: motivo ?? null, ingredientes_no_gustan: ingredientesNoGustan ?? [] },
        { onConflict: 'usuario_id,receta_nombre' },
      )
      .select()
      .single()
    if (data) {
      setPreferencias(prev => [...prev.filter(p => p.receta_nombre !== recetaNombre), data as PreferenciaReceta])
    }
  }, [user])

  const quitarPreferencia = useCallback(async (recetaNombre: string) => {
    if (!user) return
    await supabase.from('preferencias_receta').delete().eq('usuario_id', user.id).eq('receta_nombre', recetaNombre)
    setPreferencias(prev => prev.filter(p => p.receta_nombre !== recetaNombre))
  }, [user])

  return { preferencias, likes, dislikes, ingredientesEvitar, guardarPreferencia, quitarPreferencia }
}
