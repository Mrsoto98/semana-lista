import { useState, useRef, useEffect } from 'react'
import type { Dream } from '../../types'

interface ShareModalProps {
  dream: Dream
  authorName: string
  onClose: () => void
}

export function ShareModal({ dream, authorName, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const shareText = [
    dream.title ? `"${dream.title}"` : '✨ Mi sueño',
    '',
    dream.body.slice(0, 280) + (dream.body.length > 280 ? '…' : ''),
    '',
    dream.is_lucid ? '✦ Sueño lúcido' : '',
    '',
    '— Bitácora del Sueño',
  ].filter(l => l !== undefined).join('\n')

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: dream.title || 'Mi sueño — Bitácora del Sueño',
          text: shareText,
        })
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') copyFallback()
      }
    } else {
      copyFallback()
    }
  }

  function copyFallback() {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const dateStr = new Date(dream.dream_date).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm animate-scale-in flex flex-col gap-4">

        {/* Preview card */}
        <div
          ref={cardRef}
          className="relative overflow-hidden rounded-3xl p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(var(--glass-tint),0.25) 0%, rgba(var(--bg-deep),0.95) 100%)',
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: '0 24px 80px rgba(var(--glow-color),0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          {/* Background glow */}
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(var(--glow-color),0.25) 0%, transparent 70%)', filter: 'blur(30px)' }} />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(var(--glass-tint),0.2) 0%, transparent 70%)', filter: 'blur(24px)' }} />

          {/* Header */}
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-lg animate-float inline-block">🌙</span>
              <div>
                <p className="text-[11px] font-bold text-white/70 tracking-wide">BITÁCORA DEL SUEÑO</p>
                <p className="text-[9px] text-white/30">{authorName}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {dream.is_lucid && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, rgba(var(--glow-color),0.3), rgba(var(--glass-tint),0.2))',
                    border: '1px solid rgba(var(--glow-color),0.4)',
                    color: `rgb(var(--glow-color))`,
                    boxShadow: '0 0 10px rgba(var(--glow-color),0.3)',
                  }}>
                  ✦ LÚCIDO
                </span>
              )}
            </div>
          </div>

          {/* Dream content */}
          <div className="relative z-10">
            {dream.title && (
              <h3 className="text-white font-bold text-base leading-snug mb-2">{dream.title}</h3>
            )}
            <p className="text-white/65 text-sm leading-relaxed line-clamp-5">{dream.body}</p>
          </div>

          {/* Tags */}
          {dream.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 relative z-10">
              {dream.tags.slice(0, 4).map(t => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full accent-text"
                  style={{ background: 'rgba(var(--glow-color),0.12)', border: '1px solid rgba(var(--glow-color),0.2)' }}>
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/8 relative z-10">
            <span className="text-[10px] text-white/25">{dateStr}</span>
            <span className="text-[9px] text-white/20 italic">bitacora-del-sueño.app</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-sm text-white/40 bg-white/6 hover:bg-white/10 border border-white/8 transition-all active:scale-95"
          >
            Cerrar
          </button>
          <button
            onClick={handleShare}
            className="flex-1 glass-btn-primary py-3 rounded-2xl text-sm font-semibold text-white transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {shared ? (
              <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> ¡Compartido!</>
            ) : copied ? (
              <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copiado</>
            ) : (
              <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg> Compartir</>
            )}
          </button>
        </div>

        <p className="text-center text-[10px] text-white/20">
          Comparte en WhatsApp, Instagram Stories o donde quieras
        </p>
      </div>
    </div>
  )
}
