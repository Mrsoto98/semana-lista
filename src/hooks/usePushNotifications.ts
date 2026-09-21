import { useState, useEffect, useCallback } from 'react'

export type PushState = 'unsupported' | 'denied' | 'granted' | 'ungranted' | 'loading'

const REMINDER_KEY = 'dream-reminder-time'

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
    setState(Notification.permission === 'granted' ? 'granted' : 'ungranted')
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) return false
    setState('loading')
    try {
      const permission = await Notification.requestPermission()
      const granted = permission === 'granted'
      setState(granted ? 'granted' : permission === 'denied' ? 'denied' : 'ungranted')
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
      new Notification('Bitácora del Sueño ☽', {
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
