import { useState, useEffect } from 'react'
import { usePushNotifications } from '../../hooks/usePushNotifications'

const DISMISSED_KEY = 'notif-banner-dismissed'

export function NotifBanner() {
  const { state, requestPermission } = usePushNotifications()
  const [dismissed, setDismissed] = useState(true)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  const isStandalone =
    typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    )

  useEffect(() => {
    try { if (localStorage.getItem(DISMISSED_KEY)) return } catch {}
    setDismissed(false)

    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler as EventListener)
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener)
  }, [])

  const hide = dismissed || state === 'granted' || state === 'denied' || state === 'loading' || state === 'unsupported'
  if (hide) return null

  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(DISMISSED_KEY, '1') } catch {}
  }

  async function handleAction() {
    if (isStandalone) {
      await requestPermission()
      dismiss()
      return
    }
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') dismiss()
    }
  }

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{
        background: 'rgba(139,92,246,0.08)',
        borderTop: '1px solid rgba(139,92,246,0.2)',
        borderBottom: '1px solid rgba(139,92,246,0.1)',
      }}
    >
      <span style={{ fontSize: 16 }}>🔔</span>
      <p className="flex-1 text-xs" style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
        {isStandalone
          ? 'Activa notificaciones para saber cuando alguien interactúa con tus sueños.'
          : isIOS
            ? 'Instala la app (Compartir → Añadir a pantalla de inicio) para recibir notificaciones.'
            : 'Instala la app para recibir notificaciones de sueños.'}
      </p>
      {(isStandalone || (!isIOS && deferredPrompt)) && (
        <button
          onClick={handleAction}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap"
          style={{
            background: 'rgba(139,92,246,0.25)',
            color: 'rgb(167,139,250)',
            border: '1px solid rgba(139,92,246,0.35)',
          }}
        >
          {isStandalone ? 'Activar' : 'Instalar'}
        </button>
      )}
      <button
        onClick={dismiss}
        className="text-white/30 hover:text-white/60 transition-colors"
        style={{ fontSize: 20, lineHeight: 1, padding: '0 2px' }}
      >
        ×
      </button>
    </div>
  )
}
