import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Dream } from '../../types'

interface Props {
  dream: Dream
  authorName?: string
  onClose: () => void
}

const EMOTION_HEX: Record<string, string> = {
  miedo: '#E85858', tristeza: '#6494D4', 'alegría': '#4CAF82',
  asombro: '#B8A4E8', 'confusión': '#E8C858', paz: '#64D4B8',
  amor: '#E88CB8', ansiedad: '#E88C58', curiosidad: '#82C8E8',
}

function getAccent(emotions: string[]): string {
  return EMOTION_HEX[emotions[0]?.toLowerCase() ?? ''] ?? '#7C6FE8'
}

export function DreamShareCard({ dream, authorName, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [capturing, setCapturing] = useState(false)
  const accent = getAccent(dream.emotions)

  const bodyExcerpt = dream.body.length > 240 ? dream.body.slice(0, 240) + '…' : dream.body
  const dateStr = new Date(dream.dream_date + 'T12:00:00').toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  async function handleShare() {
    if (!cardRef.current) return
    setCapturing(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null, scale: 2.5, useCORS: true, logging: false,
      })
      const blob: Blob = await new Promise(r => canvas.toBlob(b => r(b!), 'image/png', 1))
      const file = new File([blob], 'sueno.png', { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: dream.title || 'Mi sueño — myDreams' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'sueno.png'; a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Share error:', err)
    } finally {
      setCapturing(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(16px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Capture target — rendered with explicit styles so html2canvas works */}
      <div
        ref={cardRef}
        style={{
          width: 340, padding: '32px 28px', borderRadius: 24,
          background: '#0D0D1A', position: 'relative', overflow: 'hidden',
          fontFamily: '"Inter", -apple-system, sans-serif',
        }}
      >
        {/* Aurora blob */}
        <div style={{
          position: 'absolute', top: -100, left: -100, width: 350, height: 350,
          borderRadius: '50%', filter: 'blur(70px)', pointerEvents: 'none',
          background: `radial-gradient(circle, ${accent}45 0%, transparent 70%)`,
        }} />
        <div style={{
          position: 'absolute', bottom: -60, right: -60, width: 250, height: 250,
          borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none',
          background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`,
        }} />

        {/* Accent bar */}
        <div style={{ width: 36, height: 3, borderRadius: 9999, background: accent, marginBottom: 20 }} />

        {/* Lucid badge */}
        {dream.is_lucid && (
          <div style={{
            display: 'inline-block', fontSize: 10, padding: '2px 10px', borderRadius: 9999,
            background: 'rgba(100,212,184,0.15)', border: '1px solid rgba(100,212,184,0.3)',
            color: '#64D4B8', marginBottom: 12, letterSpacing: '0.06em', fontWeight: 600,
          }}>✦ LÚCIDO</div>
        )}

        {/* Title */}
        {dream.title && (
          <p style={{
            fontFamily: '"Instrument Serif", Georgia, serif',
            fontSize: 22, fontWeight: 400, lineHeight: 1.2,
            color: 'rgba(255,255,255,0.92)', marginBottom: 12, marginTop: dream.is_lucid ? 0 : 0,
          }}>{dream.title}</p>
        )}

        {/* Body */}
        <p style={{
          fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.52)', marginBottom: 20,
        }}>{bodyExcerpt}</p>

        {/* Emotions */}
        {dream.emotions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
            {dream.emotions.slice(0, 4).map(e => {
              const c = EMOTION_HEX[e.toLowerCase()] ?? 'rgba(255,255,255,0.4)'
              return (
                <span key={e} style={{
                  fontSize: 10, padding: '3px 11px', borderRadius: 9999,
                  background: `${c}18`, border: `1px solid ${c}40`,
                  color: c, textTransform: 'capitalize',
                }}>{e}</span>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14, marginTop: 4,
        }}>
          <div>
            {authorName && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginBottom: 2 }}>{authorName}</p>}
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)' }}>{dateStr}</p>
          </div>
          <p style={{ fontSize: 11, color: `${accent}99`, letterSpacing: '0.1em', fontWeight: 600 }}>☽ myDreams</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 mt-5">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleShare}
          disabled={capturing}
          className="glass-btn-primary px-6 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2"
        >
          {capturing ? (
            <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Compartir
            </>
          )}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="glass-btn-secondary px-5 py-3 rounded-2xl text-sm font-medium"
        >
          Cerrar
        </motion.button>
      </div>
    </motion.div>
  )
}
