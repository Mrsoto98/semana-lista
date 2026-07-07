// src/hooks/usePerfil.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../types'
import { useAuth } from './useAuth'
import { resolverZona } from '../lib/zonas'

export function usePerfil() {
  const { user } = useAuth()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase
      .from('perfiles')
      .select('*')
      .eq('usuario_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setPerfil(data as Perfil | null)
        setLoading(false)
      })
  }, [user])

  async function guardarPerfil(p: Omit<Perfil, 'id' | 'usuario_id'>) {
    if (!user) return

    // Resolver zona logística a partir del código postal
    // Se hace aquí para capturarla tanto en onboarding como en ajustes
    const zona_id = p.codigo_postal
      ? await resolverZona(p.codigo_postal)
      : (perfil?.zona_id ?? 'barcelona')

    // Ensure usuarios row exists and generate codigo_usuario if missing
    // codigo_usuario se genera automáticamente en el servidor mediante trigger
    await supabase
      .from('usuarios')
      .upsert({ id: user.id, email: user.email }, { onConflict: 'id' })

    const { data } = await supabase
      .from('perfiles')
      .upsert({ ...p, zona_id, usuario_id: user.id }, { onConflict: 'usuario_id' })
      .select()
      .single()
    setPerfil(data as Perfil)
  }

  return { perfil, loading, guardarPerfil }
}
