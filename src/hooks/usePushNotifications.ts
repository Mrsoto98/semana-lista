import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const VAPID_PUBLIC_KEY = 'BHkpfOOW1eqr9T8Imz8Jjm7Gh9uTXFU6A3dVR4fQA5F9Hbb4qOEAWSsBuPhnB7mXGBmeO4p4QN1Bb_nQKnr5CZU'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export type EstadoNotificacion = 'no-soportado' | 'no-pedido' | 'concedido' | 'denegado' | 'cargando'

export const DIAS_SEMANA = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
]

export const HORAS_DISPONIBLES = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00', '22:00',
]

export function usePushNotifications() {
  const { user } = useAuth()
  const [estado, setEstado] = useState<EstadoNotificacion>('cargando')
  const [notifDia, setNotifDia] = useState(0)       // 0 = domingo
  const [notifHora, setNotifHora] = useState('20:00')

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setEstado('no-soportado')
      return
    }
    const perm = Notification.permission
    if (perm === 'granted') setEstado('concedido')
    else if (perm === 'denied') setEstado('denegado')
    else setEstado('no-pedido')
  }, [])

  // Cargar preferencia guardada
  useEffect(() => {
    if (!user || estado !== 'concedido') return
    supabase.from('push_subscriptions')
      .select('notif_dia, notif_hora')
      .eq('usuario_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setNotifDia((data as { notif_dia: number }).notif_dia ?? 0)
          setNotifHora((data as { notif_hora: string }).notif_hora ?? '20:00')
        }
      })
  }, [user, estado])

  async function activar(dia = notifDia, hora = notifHora): Promise<boolean> {
    if (!user) return false
    try {
      setEstado('cargando')
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setEstado('denegado'); return false }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const key = sub.getKey('p256dh')
      const auth = sub.getKey('auth')
      if (!key || !auth) { setEstado('no-pedido'); return false }

      const { error } = await supabase.from('push_subscriptions').upsert({
        usuario_id: user.id,
        endpoint: sub.endpoint,
        p256dh: btoa(String.fromCharCode(...new Uint8Array(key))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
        auth: btoa(String.fromCharCode(...new Uint8Array(auth))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
        notif_dia: dia,
        notif_hora: hora,
      }, { onConflict: 'endpoint' })

      if (error) { console.error('push subscribe:', error.message); setEstado('no-pedido'); return false }
      setNotifDia(dia); setNotifHora(hora)
      setEstado('concedido')
      return true
    } catch (e) {
      console.error('push activar:', e)
      setEstado('no-pedido')
      return false
    }
  }

  async function actualizarHorario(dia: number, hora: string): Promise<void> {
    if (!user) return
    setNotifDia(dia); setNotifHora(hora)
    await supabase.from('push_subscriptions')
      .update({ notif_dia: dia, notif_hora: hora })
      .eq('usuario_id', user.id)
  }

  async function desactivar(): Promise<void> {
    if (!user) return
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          await sub.unsubscribe()
        }
      }
      setEstado('no-pedido')
    } catch (e) {
      console.error('push desactivar:', e)
    }
  }

  return { estado, activar, desactivar, actualizarHorario, notifDia, notifHora }
}
