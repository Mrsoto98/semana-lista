// src/hooks/usePerfil.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../types'
import { useAuth } from './useAuth'

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
    // Ensure usuarios row exists and generate codigo_usuario if missing
    const { data: usuarioExistente } = await supabase
      .from('usuarios')
      .select('codigo_usuario')
      .eq('id', user.id)
      .maybeSingle()
    const codigoNuevo = usuarioExistente?.codigo_usuario
      ? undefined
      : String(Math.floor(100 + Math.random() * 900)).padStart(3, '0') + '-' + String(Math.floor(Math.random() * 1000)).padStart(3, '0')
    await supabase
      .from('usuarios')
      .upsert({ id: user.id, email: user.email, ...(codigoNuevo ? { codigo_usuario: codigoNuevo } : {}) }, { onConflict: 'id' })
    const { data } = await supabase
      .from('perfiles')
      .upsert({ ...p, usuario_id: user.id }, { onConflict: 'usuario_id' })
      .select()
      .single()
    setPerfil(data as Perfil)
  }

  return { perfil, loading, guardarPerfil }
}
