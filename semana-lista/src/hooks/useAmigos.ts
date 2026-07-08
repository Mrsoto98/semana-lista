import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface UsuarioPublico {
  id: string
  nombre_display?: string
  username?: string
  avatar_emoji?: string
  avatar_url?: string
  codigo_usuario?: string
}

export interface Amistad {
  id: string
  solicitante_id: string
  receptor_id: string
  estado: 'pendiente' | 'aceptada'
  created_at: string
  otro?: UsuarioPublico
}

export function useAmigos() {
  const { user } = useAuth()
  const [amigos, setAmigos] = useState<Amistad[]>([])
  const [pendientesRecibidas, setPendientesRecibidas] = useState<Amistad[]>([])
  const [pendientesEnviadas, setPendientesEnviadas] = useState<Amistad[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data } = await supabase
      .from('amistades')
      .select('*')
      .or(`solicitante_id.eq.${user.id},receptor_id.eq.${user.id}`)

    if (!data) { setLoading(false); return }

    // Obtener perfiles de los "otros" usuarios
    const otrosIds = [...new Set(data.map(a =>
      a.solicitante_id === user.id ? a.receptor_id : a.solicitante_id
    ))]

    let perfiles: UsuarioPublico[] = []
    if (otrosIds.length) {
      const { data: p } = await supabase
        .from('usuarios')
        .select('id, nombre_display, username, avatar_emoji, avatar_url, codigo_usuario')
        .in('id', otrosIds)
      perfiles = (p ?? []) as UsuarioPublico[]
    }

    const mapaPerfiles: Record<string, UsuarioPublico> = {}
    perfiles.forEach(p => { mapaPerfiles[p.id] = p })

    const enriquecidas: Amistad[] = data.map(a => ({
      ...a,
      otro: mapaPerfiles[a.solicitante_id === user.id ? a.receptor_id : a.solicitante_id],
    }))

    setAmigos(enriquecidas.filter(a => a.estado === 'aceptada'))
    setPendientesRecibidas(enriquecidas.filter(a => a.estado === 'pendiente' && a.receptor_id === user.id))
    setPendientesEnviadas(enriquecidas.filter(a => a.estado === 'pendiente' && a.solicitante_id === user.id))
    setLoading(false)
  }, [user])

  useEffect(() => { cargar() }, [cargar])

  // Realtime
  useEffect(() => {
    if (!user) return
    const canal = supabase
      .channel('amistades-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'amistades' }, () => cargar())
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [user, cargar])

  async function buscarUsuario(query: string): Promise<UsuarioPublico[]> {
    if (!query.trim() || query.length < 2) return []
    const q = query.trim()
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre_display, username, avatar_emoji, avatar_url, codigo_usuario')
      .ilike('codigo_usuario', `%${q}%`)
      .neq('id', user?.id ?? '')
      .limit(5)
    return (data ?? []) as UsuarioPublico[]
  }

  async function enviarSolicitud(receptorId: string): Promise<{ error?: string }> {
    if (!user) return { error: 'No autenticado' }
    await supabase.from('usuarios').upsert({ id: user.id, email: user.email }, { onConflict: 'id' })
    const { error } = await supabase.from('amistades').insert({
      solicitante_id: user.id, receptor_id: receptorId,
    })
    if (error?.message?.includes('unique')) return { error: 'Ya existe una solicitud con este usuario.' }
    if (error) return { error: error.message }
    await cargar()
    return {}
  }

  async function aceptarSolicitud(amistadId: string): Promise<void> {
    await supabase.from('amistades').update({ estado: 'aceptada' }).eq('id', amistadId)
    await cargar()
  }

  async function rechazarOEliminar(amistadId: string): Promise<void> {
    await supabase.from('amistades').delete().eq('id', amistadId)
    await cargar()
  }

  async function invitarALista(listaId: string, amigoId: string): Promise<{ error?: string }> {
    // No hacemos upsert aquí: el usuario ya existe en la tabla (lo creó al registrarse)
    const { error } = await supabase
      .from('lista_compartida_miembros')
      .insert({ lista_id: listaId, usuario_id: amigoId, rol: 'miembro' })
    if (error?.message?.includes('unique')) return { error: 'Este amigo ya es miembro.' }
    if (error) return { error: error.message }
    return {}
  }

  const totalPendientes = pendientesRecibidas.length

  return { amigos, pendientesRecibidas, pendientesEnviadas, totalPendientes, loading, buscarUsuario, enviarSolicitud, aceptarSolicitud, rechazarOEliminar, invitarALista, recargar: cargar }
}
