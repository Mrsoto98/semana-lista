import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface UsuarioPerfil {
  id: string
  email: string
  nombre_display?: string
  username?: string
  avatar_emoji?: string
  avatar_url?: string
}

export function useUsuario() {
  const { user } = useAuth()
  const [usuario, setUsuario] = useState<UsuarioPerfil | null>(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('usuarios')
      .select('id, email, nombre_display, username, avatar_emoji, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
    setUsuario(data as UsuarioPerfil | null)
    setLoading(false)
  }, [user])

  useEffect(() => { cargar() }, [cargar])

  async function guardarUsuario(campos: Partial<Pick<UsuarioPerfil, 'nombre_display' | 'username' | 'avatar_emoji' | 'avatar_url'>>) {
    if (!user) return { error: 'No autenticado' }
    // Asegurar que existe el registro
    await supabase.from('usuarios').upsert({ id: user.id, email: user.email }, { onConflict: 'id' })
    const { error } = await supabase
      .from('usuarios')
      .update(campos)
      .eq('id', user.id)
    if (!error) setUsuario(prev => prev ? { ...prev, ...campos } : prev)
    if (error?.message?.includes('username_format')) return { error: 'El nombre de usuario solo puede tener letras, números y _ (3–20 caracteres).' }
    if (error?.message?.includes('unique')) return { error: 'Ese nombre de usuario ya está en uso. Elige otro.' }
    return { error: error?.message }
  }

  return { usuario, loading, guardarUsuario, recargar: cargar }
}
