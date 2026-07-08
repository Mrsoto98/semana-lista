import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function AndroidInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [animOut, setAnimOut] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      const dismissed = localStorage.getItem('android-install-dismissed')
      if (!dismissed) setVisible(true)
    }

    const installedHandler = () => dismiss()

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  function dismiss() {
    setAnimOut(true)
    setTimeout(() => {
      setVisible(false)
      setAnimOut(false)
      localStorage.setItem('android-install-dismissed', '1')
    }, 350)
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    setInstalling(true)
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      dismiss()
    } else {
      setInstalling(false)
    }
  }

  if (!visible) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"
        style={{
          animation: animOut
            ? 'fadeOutBackdrop 0.35s ease forwards'
            : 'fadeInBackdrop 0.3s ease both',
        }}
        onClick={dismiss}
      />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[91] px-4 pb-8 pt-2"
        style={{
          animation: animOut
            ? 'slideSheetOut 0.35s cubic-bezier(0.4,0,1,1) forwards'
            : 'slideSheetIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <div
          className="max-w-lg mx-auto rounded-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(18,14,40,0.97) 0%, rgba(10,8,24,0.98) 100%)',
            border: '1px solid rgba(var(--glow-color),0.25)',
            boxShadow: '0 -8px 60px rgba(var(--glow-color),0.18), 0 8px 40px rgba(0,0,0,0.6)',
          }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <div className="px-6 pt-3 pb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{
                    background: 'rgba(var(--glow-color),0.15)',
                    border: '1px solid rgba(var(--glow-color),0.3)',
                    boxShadow: '0 0 20px rgba(var(--glow-color),0.2)',
                  }}
                >
                  🌙
                </div>
                <div>
                  <p className="font-bold text-white text-base leading-tight">Bitácora del Sueño</p>
                  <p className="text-xs text-white/40 mt-0.5">Instalar como app</p>
                </div>
              </div>
              <button
                onClick={dismiss}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Benefits */}
            <div className="flex flex-col gap-2 mb-5">
              {[
                { icon: '⚡', text: 'Acceso instantáneo desde tu pantalla de inicio' },
                { icon: '🔔', text: 'Notificaciones matutinas para recordar tus sueños' },
                { icon: '📴', text: 'Funciona sin conexión — tus sueños siempre disponibles' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(var(--glow-color),0.06)', border: '1px solid rgba(var(--glow-color),0.1)' }}>
                  <span className="text-base shrink-0">{icon}</span>
                  <span className="text-xs text-white/60 leading-snug">{text}</span>
                </div>
              ))}
            </div>

            {/* Install button */}
            <button
              onClick={handleInstall}
              disabled={installing}
              className="w-full py-4 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.97] flex items-center justify-center gap-2.5 glass-btn-primary disabled:opacity-60"
            >
              {installing ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Instalando…
                </>
              ) : (
                <>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v13M5 9l7 7 7-7"/><path d="M3 18h18v2H3z"/>
                  </svg>
                  Instalar app
                </>
              )}
            </button>

            <button
              onClick={dismiss}
              className="w-full mt-2.5 py-2.5 rounded-2xl text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInBackdrop  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fadeOutBackdrop { from { opacity: 1 } to { opacity: 0 } }
        @keyframes slideSheetIn  { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes slideSheetOut { from { transform: translateY(0) }    to { transform: translateY(110%) } }
      `}</style>
    </>
  )
}
