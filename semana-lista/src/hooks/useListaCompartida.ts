import { useState, useEffect, useCallback, useContext, createContext } from 'react'
import React from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface ItemCompartido {
  id: string
  lista_id: string
  nombre: string
  cantidad?: number
  unidad?: string
  precio?: number
  comprado: boolean
  en_casa: boolean
  added_by?: string
  created_at: string
}

export interface ListaCompartida {
  id: string
  nombre: string
  codigo: string
  creado_por: string
  created_at: string
  presupuesto?: number | null
}

export interface MiembroLista {
  lista_id: string
  usuario_id: string
  rol: 'admin' | 'miembro'
  joined_at: string
}

export function useListaCompartida(listaId: string | null) {
  const { user } = useAuth()
  const [lista, setLista] = useState<ListaCompartida | null>(null)
  const [items, setItems] = useState<ItemCompartido[]>([])
  const [miembros, setMiembros] = useState<MiembroLista[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    if (!listaId || !user) { setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const [{ data: l }, { data: it }, { data: m }] = await Promise.all([
        supabase.from('listas_compartidas').select('*').eq('id', listaId).single(),
        supabase.from('lista_compartida_items').select('*').eq('lista_id', listaId).order('created_at'),
        supabase.from('lista_compartida_miembros').select('*').eq('lista_id', listaId),
      ])
      if (l) setLista(l as ListaCompartida)
      setItems((it ?? []) as ItemCompartido[])
      setMiembros((m ?? []) as MiembroLista[])
    } catch {
      setError('No se pudo cargar la lista')
    }
    setLoading(false)
  }, [listaId, user])

  useEffect(() => { cargar() }, [cargar])

  // Suscripción realtime a cambios en items
  useEffect(() => {
    if (!listaId) return
    const canal = supabase
      .channel(`lista-${listaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lista_compartida_items', filter: `lista_id=eq.${listaId}` },
        payload => {
          if (payload.eventType === 'INSERT') {
            setItems(prev => [
              ...prev.filter(i => !(i.id.startsWith('temp-') && i.nombre === (payload.new as ItemCompartido).nombre)),
              payload.new as ItemCompartido,
            ])
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(i => i.id === payload.new.id ? payload.new as ItemCompartido : i))
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== payload.old.id))
          }
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lista_compartida_miembros', filter: `lista_id=eq.${listaId}` },
        () => { cargar() }
      )
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [listaId, cargar])

  async function añadirItem(nombre: string, extra?: Partial<Pick<ItemCompartido, 'cantidad' | 'unidad' | 'precio'>>, enCasa = false) {
    if (!listaId || !user) return
    const tempId = `temp-${crypto.randomUUID()}`
    setItems(prev => [...prev, {
      id: tempId, lista_id: listaId!, nombre, added_by: user.id,
      comprado: false, en_casa: enCasa, created_at: new Date().toISOString(), ...extra,
    }])
    await supabase.from('lista_compartida_items').insert({
      lista_id: listaId, nombre, added_by: user.id, comprado: false, en_casa: enCasa, ...extra,
    })
  }

  async function toggleComprado(id: string, valor: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, comprado: valor } : i))
    await supabase.from('lista_compartida_items').update({ comprado: valor }).eq('id', id)
  }

  async function toggleEnCasa(id: string, valor: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, en_casa: valor, comprado: false } : i))
    await supabase.from('lista_compartida_items').update({ en_casa: valor, comprado: false }).eq('id', id)
  }

  async function actualizarPrecio(id: string, precio: number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, precio } : i))
    await supabase.from('lista_compartida_items').update({ precio }).eq('id', id)
  }

  async function actualizarCantidad(id: string, cantidad: number) {
    if (cantidad <= 0) {
      setItems(prev => prev.filter(i => i.id !== id))
      await supabase.from('lista_compartida_items').delete().eq('id', id)
    } else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, cantidad } : i))
      await supabase.from('lista_compartida_items').update({ cantidad }).eq('id', id)
    }
  }

  async function actualizarUnidadYCantidad(id: string, unidad: string, cantidad: number, precio: number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, unidad, cantidad, precio } : i))
    await supabase.from('lista_compartida_items').update({ unidad, cantidad, precio }).eq('id', id)
  }

  async function eliminarItem(id: string) {
    const snapshot = items
    setItems(prev => prev.filter(i => i.id !== id))
    const { error } = await supabase.from('lista_compartida_items').delete().eq('id', id)
    if (error) setItems(snapshot) // rollback si falla
  }

  async function renombrarLista(nombre: string) {
    if (!listaId) return
    await supabase.from('listas_compartidas').update({ nombre }).eq('id', listaId)
    setLista(prev => prev ? { ...prev, nombre } : prev)
  }

  async function actualizarPresupuesto(presupuesto: number | null) {
    if (!listaId) return
    await supabase.from('listas_compartidas').update({ presupuesto }).eq('id', listaId)
    setLista(prev => prev ? { ...prev, presupuesto } : prev)
  }

  const esAdmin = miembros.find(m => m.usuario_id === user?.id)?.rol === 'admin'

  return { lista, items, miembros, loading, error, esAdmin, añadirItem, toggleComprado, toggleEnCasa, actualizarPrecio, actualizarCantidad, actualizarUnidadYCantidad, eliminarItem, renombrarLista, actualizarPresupuesto, recargar: cargar }
}

// ── Contexto singleton para evitar múltiples canales realtime ─────────────────
type ListasCtx = ReturnType<typeof _useListasCompartidasInternal>
const ListasCompartidasContext = createContext<ListasCtx | null>(null)

export function ListasCompartidasProvider({ children }: { children: React.ReactNode }) {
  const value = _useListasCompartidasInternal()
  return React.createElement(ListasCompartidasContext.Provider, { value }, children)
}

export function useListasCompartidas(): ListasCtx {
  const ctx = useContext(ListasCompartidasContext)
  if (!ctx) throw new Error('useListasCompartidas debe usarse dentro de ListasCompartidasProvider')
  return ctx
}

function _useListasCompartidasInternal() {
  const { user } = useAuth()
  const [listas, setListas] = useState<ListaCompartida[]>([])
  const [loading, setLoading] = useState(true)
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0)

  const cargar = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('lista_compartida_miembros')
      .select('lista_id, rol, listas_compartidas(*)')
      .eq('usuario_id', user.id)
    const resultado = (data ?? [])
      .map((r: { listas_compartidas: unknown }) => r.listas_compartidas)
      .filter(Boolean) as ListaCompartida[]
    setListas(resultado)

    // Contar solicitudes pendientes en listas donde soy admin
    const misListasAdmin = (data ?? [])
      .filter((r: { rol: string }) => r.rol === 'admin')
      .map((r: { lista_id: string }) => r.lista_id)
    if (misListasAdmin.length > 0) {
      const { count } = await supabase
        .from('solicitudes_lista')
        .select('*', { count: 'exact', head: true })
        .in('lista_id', misListasAdmin)
      setSolicitudesPendientes(count ?? 0)
    } else {
      setSolicitudesPendientes(0)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { cargar() }, [cargar])

  // Realtime: recargar listas y solicitudes cuando cambien las membresías o solicitudes
  useEffect(() => {
    if (!user) return
    const canal = supabase.channel('listas-usuario-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lista_compartida_miembros' }, cargar)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_lista' }, cargar)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [user, cargar])

  async function crearLista(nombre: string): Promise<{ lista: ListaCompartida | null; error?: string }> {
    if (!user) return { lista: null, error: 'No autenticado' }
    if (listas.length >= 2) return { lista: null, error: 'Máximo 2 listas compartidas por cuenta.' }
    // Usar función SECURITY DEFINER para evitar problemas de RLS
    const { data, error } = await supabase.rpc('crear_lista_compartida', { p_nombre: nombre })
    if (error || !data) return { lista: null, error: error?.message ?? 'No se pudo crear la lista' }
    const lista: ListaCompartida = {
      id: data.id, nombre: data.nombre, codigo: data.codigo,
      creado_por: data.creado_por, created_at: new Date().toISOString(),
    }
    await cargar()
    return { lista }
  }

  async function unirseConCodigo(codigo: string): Promise<{ ok: boolean; pendiente?: boolean; error?: string; lista?: ListaCompartida }> {
    if (!user) return { ok: false, error: 'No autenticado' }
    const { data: lista } = await supabase
      .from('listas_compartidas')
      .select('*')
      .eq('codigo', codigo.toUpperCase().trim())
      .single()
    if (!lista) return { ok: false, error: 'Código incorrecto. Comprueba el código e inténtalo de nuevo.' }
    const yaMiembro = listas.some(l => l.id === lista.id)
    if (yaMiembro) return { ok: false, error: 'Ya eres miembro de esta lista.' }
    if (listas.length >= 2) return { ok: false, error: 'Máximo 2 listas compartidas por cuenta.' }
    // Insertar solicitud en vez de unirse directamente
    const { error } = await supabase
      .from('solicitudes_lista')
      .insert({ lista_id: lista.id, usuario_id: user.id })
    if (error?.message?.includes('unique')) return { ok: false, error: 'Ya tienes una solicitud pendiente para esta lista.' }
    if (error) return { ok: false, error: error.message }
    return { ok: true, pendiente: true, lista: lista as ListaCompartida }
  }

  async function abandonarLista(listaId: string) {
    if (!user) return
    await supabase.from('lista_compartida_miembros').delete().eq('lista_id', listaId).eq('usuario_id', user.id)
    setListas(prev => prev.filter(l => l.id !== listaId))
  }

  return { listas, loading, solicitudesPendientes, crearLista, unirseConCodigo, abandonarLista, recargar: cargar }
}
