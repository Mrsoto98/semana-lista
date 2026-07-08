import { useState, useEffect } from 'react'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone() {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
    || window.matchMedia('(display-mode: standalone)').matches
}

export function IOSInstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [animOut, setAnimOut] = useState(false)

  useEffect(() => {
    if (!isIOS() || isStandalone()) return
    const dismissed = localStorage.getItem('ios-install-dismissed')
    if (dismissed) return
    // Show after a short delay so the app renders first
    const t = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(t)
  }, [])

  function dismiss() {
    setAnimOut(true)
    setTimeout(() => {
      setVisible(false)
      setAnimOut(false)
      localStorage.setItem('ios-install-dismissed', '1')
    }, 350)
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

          {/* Header */}
          <div className="px-6 pt-3 pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{
                    background: 'rgba(var(--glow-color),0.15)',
                    border: '1px solid rgba(var(--glow-color),0.3)',
                  }}
                >
                  🌙
                </div>
                <div>
                  <p className="font-bold text-white text-base leading-tight">Añadir a inicio</p>
                  <p className="text-xs text-white/40 mt-0.5">Acceso rápido como app nativa</p>
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

            {/* Steps */}
            <div className="flex flex-col gap-3">
              {/* Step 1 */}
              <div className="flex items-center gap-4 rounded-2xl px-4 py-3"
                style={{ background: 'rgba(var(--glow-color),0.06)', border: '1px solid rgba(var(--glow-color),0.12)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(var(--glow-color),0.15)' }}>
                  <ShareIcon />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">Toca el botón compartir</p>
                  <p className="text-xs text-white/45 mt-0.5">El icono <span className="text-white/70">□↑</span> en la barra inferior de Safari</p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/20">
                  <path d="M12 5v14M5 12l7 7 7-7"/>
                </svg>
              </div>

              {/* Step 2 */}
              <div className="flex items-center gap-4 rounded-2xl px-4 py-3"
                style={{ background: 'rgba(var(--glow-color),0.06)', border: '1px solid rgba(var(--glow-color),0.12)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(var(--glow-color),0.15)' }}>
                  <span className="text-base">＋</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">«Añadir a pantalla de inicio»</p>
                  <p className="text-xs text-white/45 mt-0.5">Desplázate hacia abajo en el menú</p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/20">
                  <path d="M12 5v14M5 12l7 7 7-7"/>
                </svg>
              </div>

              {/* Step 3 */}
              <div className="flex items-center gap-4 rounded-2xl px-4 py-3"
                style={{ background: 'rgba(var(--glow-color),0.06)', border: '1px solid rgba(var(--glow-color),0.12)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(var(--glow-color),0.15)' }}>
                  <span className="text-base">✓</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">Pulsa «Añadir»</p>
                  <p className="text-xs text-white/45 mt-0.5">La app aparecerá en tu pantalla de inicio</p>
                </div>
              </div>
            </div>

            {/* Dismiss */}
            <button
              onClick={dismiss}
              className="w-full mt-4 py-3 rounded-2xl text-sm text-white/40 hover:text-white/60 transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)' }}
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

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  )
}
