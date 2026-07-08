import { useEffect, useRef, useState } from 'react'

interface Props {
  onRewarded: () => void
  onClose: () => void
}

const AD_DURATION = 5 // seconds

export function AnuncioRewarded({ onRewarded, onClose }: Props) {
  const [phase, setPhase] = useState<'confirm' | 'watching' | 'done'>('confirm')
  const [remaining, setRemaining] = useState(AD_DURATION)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startAd() {
    setPhase('watching')
    setRemaining(AD_DURATION)
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current!)
          setPhase('done')
          return 0
        }
        return r - 1
      })
    }, 1000)
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4 pb-6 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="glass-card rounded-2xl p-6 w-full max-w-sm animate-scale-in">

        {phase === 'confirm' && (
          <>
            <div className="text-4xl text-center mb-3">✦</div>
            <h2 className="text-white font-bold text-center text-lg mb-1">Análisis con IA</h2>
            <p className="text-white/45 text-sm text-center leading-relaxed mb-5">
              Para desbloquear el análisis de tu sueño, ve un anuncio corto de {AD_DURATION} segundos.
              Es gratis para ti.
            </p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-sm text-white/40 bg-white/5 hover:bg-white/8 transition-all">
                Cancelar
              </button>
              <button onClick={startAd}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white glass-btn-primary transition-all active:scale-95">
                Ver anuncio
              </button>
            </div>
          </>
        )}

        {phase === 'watching' && (
          <>
            {/* Simulated ad placeholder */}
            <div className="h-36 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              <p className="text-white/30 text-xs">Cargando anuncio…</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-white/40 text-xs">No cierres esta pantalla</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[11px] font-bold text-white/60"
                  style={{ borderColor: 'rgba(var(--glow-color),0.5)', background: 'rgba(var(--glow-color),0.1)' }}>
                  {remaining}
                </div>
                <span className="text-white/30 text-xs">seg</span>
              </div>
            </div>
          </>
        )}

        {phase === 'done' && (
          <>
            <div className="text-5xl text-center mb-3">🎉</div>
            <h2 className="text-white font-bold text-center text-lg mb-1">¡Gracias!</h2>
            <p className="text-white/45 text-sm text-center mb-5">
              Tu análisis de IA se está generando ahora.
            </p>
            <button
              onClick={() => { onRewarded(); onClose() }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white glass-btn-primary transition-all active:scale-95"
            >
              Ver análisis ✦
            </button>
          </>
        )}
      </div>
    </div>
  )
}
