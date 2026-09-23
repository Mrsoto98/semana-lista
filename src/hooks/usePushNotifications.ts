import { useState, useEffect, useCallback } from 'react'
import { pushApi } from '../lib/queries'

export type PushState = 'unsupported' | 'denied' | 'granted' | 'ungranted' | 'loading'

const REMINDER_KEY = 'dream-reminder-time'
const VAPID_PUBLIC_KEY: string =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ??
  'BPapka5ECvX3gZF9l_LebBd6vkQkPxrXrtBCnBG9CW6cw8IcaQEeYt4OX-5K3vfpA4u-TLY_8sewzcM5_5HEJLY'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buf = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buf)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return buf
}

async function subscribeWebPush() {
  if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
    await pushApi.subscribe(sub.toJSON())
  } catch {}
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading')

  useEffect(() => {
    if (!('Notification' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    const granted = Notification.permission === 'granted'
    setState(granted ? 'granted' : 'ungranted')
    if (granted) subscribeWebPush()
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false
    setState('loading')
    try {
      const permission = await Notification.requestPermission()
      const granted = permission === 'granted'
      setState(granted ? 'granted' : permission === 'denied' ? 'denied' : 'ungranted')
      if (granted) subscribeWebPush()
      return granted
    } catch {
      setState('ungranted')
      return false
    }
  }, [])

  const getSavedTime = useCallback((): string | null => {
    try { return localStorage.getItem(REMINDER_KEY) } catch { return null }
  }, [])

  const setReminderTime = useCallback(async (time: string | null): Promise<boolean> => {
    if (!('Notification' in window)) return false
    if (Notification.permission !== 'granted') {
      const ok = await requestPermission()
      if (!ok) return false
    }
    try {
      if (time) {
        localStorage.setItem(REMINDER_KEY, time)
        scheduleLocalReminder(time)
      } else {
        localStorage.removeItem(REMINDER_KEY)
        clearScheduledReminder()
      }
      return true
    } catch { return false }
  }, [requestPermission])

  return { state, requestPermission, getSavedTime, setReminderTime }
}

let reminderTimer: ReturnType<typeof setTimeout> | null = null

function clearScheduledReminder() {
  if (reminderTimer) { clearTimeout(reminderTimer); reminderTimer = null }
}

function scheduleLocalReminder(time: string) {
  clearScheduledReminder()
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  function fireNext() {
    const now = new Date()
    const [h, m] = time.split(':').map(Number)
    const next = new Date(now)
    next.setHours(h, m, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    const ms = next.getTime() - now.getTime()
    reminderTimer = setTimeout(() => {
      new Notification('myDreams ☽', {
        body: '¿Qué soñaste anoche? Anota tu sueño antes de que se desvanezca.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'dream-reminder',
      })
      fireNext()
    }, ms)
  }

  fireNext()
}

export function initReminder() {
  try {
    const time = localStorage.getItem('dream-reminder-time')
    if (time && 'Notification' in window && Notification.permission === 'granted') {
      scheduleLocalReminder(time)
    }
  } catch {}
}
