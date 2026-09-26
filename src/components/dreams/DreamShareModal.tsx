import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { overlayVariants, scaleInVariants } from '../../lib/motion'
import type { FeedDream } from '../../types'

interface Props {
  dream: FeedDream
  onClose: () => void
}

const STYLES = [
  {
    id: 'cosmico' as const,
    label: 'Cósmico',
    bg: 'linear-gradient(135deg, #080810 0%, #1a1040 50%, #0d0d1a 100%)',
    textColor: '#e8e0ff',
    accent: '#7C6FE8',
  },
  {
    id: 'sereno' as const,
    label: 'Sereno',
    bg: 'linear-gradient(135deg, #0a1628 0%, #112240 50%, #0d1d35 100%)',
    textColor: '#c8dff5',
    accent: '#64D4B8',
  },
  {
    id: 'neblina' as const,
    label: 'Neblina',
    bg: 'linear-gradient(135deg, #15102a 0%, #281d45 50%, #1a1535 100%)',
    textColor: '#e0d8f0',
    accent: '#B8A4E8',
  },
  {
    id: 'minimalista' as const,
    label: 'Minimalista',
    bg: '#0a0a0f',
    textColor: 'rgba(255,255,255,0.85)',
    accent: 'rgba(255,255,255,0.35)',
  },
]

type StyleId = typeof STYLES[number]['id']

export function DreamShareModal({ dream, onClose }: Props) {
  const [style, setStyle] = useState<StyleId>('cosmico')
  const [format, setFormat] = useState<'story' | 'post'>('story')
  const [generating, setGenerating] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const currentStyle = STYLES.find(s => s.id === style)!
  const isStory = format === 'story'

  const bodyLen = dream.body.length
  // Larger base sizes, scales down for very long dreams
  const cardFontSize = bodyLen < 300 ? 58 : bodyLen < 600 ? 46 : bodyLen < 1000 ? 36 : 28

  async function handleDownload() {
    if (!cardRef.current) return
    setGenerating(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      // Use the card's actual rendered height so long dreams aren't clipped
      const actualHeight = cardRef.current.scrollHeight
      const canvas = await html2canvas(cardRef.current, {
        width: 1080,
        height: actualHeight,
        scale: 1,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      })
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `sueno-${dream.id.slice(0, 8)}.png`
      a.click()
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <motion.div
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-[70]"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      <motion.div
        variants={scaleInVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[71] glass rounded-[24px] p-5 max-h-[90svh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
            Compartir sueño
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Format tabs */}
        <div className="flex gap-2 mb-4">
          {([{ id: 'story', label: 'Story (9:16)' }, { id: 'post', label: 'Post (1:1)' }] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFormat(id)}
              className="flex-1 py-2 text-xs font-medium rounded-xl transition-all"
              style={{
                background: format === id ? 'rgba(var(--glow),0.2)' : 'rgba(255,255,255,0.05)',
                color: format === id ? `hsl(var(--accent-h),var(--accent-s),80%)` : 'rgba(255,255,255,0.4)',
                border: `1px solid ${format === id ? 'rgba(var(--glow),0.25)' : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Style picker */}
        <div className="flex gap-2 mb-5">
          {STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className="flex-1 py-2 text-[10px] font-medium rounded-xl transition-all"
              style={{
                background: s.bg,
                border: `1.5px solid ${style === s.id ? s.accent : 'rgba(255,255,255,0.08)'}`,
                color: s.textColor,
                opacity: style === s.id ? 1 : 0.6,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Hidden full-res card for html2canvas */}
        <div style={{ position: 'absolute', left: -9999, top: 0, pointerEvents: 'none' }}>
          <div
            ref={cardRef}
            style={{
              width: 1080,
              minHeight: isStory ? 1920 : 1080,
              background: currentStyle.bg,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 80,
              paddingLeft: 80,
              paddingRight: 80,
              paddingBottom: 150,
              position: 'relative',
              fontFamily: '"Instrument Serif", Georgia, serif',
            }}
          >
            <div style={{ fontSize: 120, color: currentStyle.accent, opacity: 0.15, lineHeight: 1, marginBottom: -20 }}>"</div>

            {dream.title && (
              <p style={{
                fontSize: 40,
                color: currentStyle.accent,
                textAlign: 'center',
                fontStyle: 'italic',
                marginBottom: 28,
                maxWidth: 900,
              }}>
                {dream.title}
              </p>
            )}

            <p style={{
              fontSize: cardFontSize,
              lineHeight: 1.6,
              color: currentStyle.textColor,
              textAlign: 'center',
              fontStyle: 'italic',
              maxWidth: 900,
            }}>
              {dream.body}
            </p>

            {dream.emotions.length > 0 && (
              <div style={{ display: 'flex', gap: 16, marginTop: 48, flexWrap: 'wrap', justifyContent: 'center' }}>
                {dream.emotions.map(e => (
                  <span key={e} style={{
                    fontSize: 28,
                    padding: '8px 24px',
                    borderRadius: 100,
                    background: `${currentStyle.accent}25`,
                    border: `1px solid ${currentStyle.accent}40`,
                    color: currentStyle.accent,
                    textTransform: 'capitalize',
                  }}>
                    {e}
                  </span>
                ))}
              </div>
            )}

            <div style={{
              position: 'absolute',
              bottom: 60,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}>
              <p style={{ fontSize: 24, color: `${currentStyle.textColor}60`, fontFamily: 'Inter, sans-serif', fontWeight: 400 }}>
                {dream.author_name}
              </p>
              <p style={{
                fontSize: 22,
                color: `${currentStyle.textColor}35`,
                letterSpacing: 6,
                textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 300,
              }}>
                myDreams
              </p>
            </div>
          </div>
        </div>

        {/* Scaled preview — auto height, shows full text */}
        <div
          className="rounded-xl overflow-y-auto mx-auto mb-5"
          style={{
            width: '100%',
            maxWidth: 200,
            maxHeight: '52vh',
            background: currentStyle.bg,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px 14px 20px',
          }}
        >
          <div style={{ fontSize: 24, color: currentStyle.accent, opacity: 0.2, marginBottom: -4 }}>"</div>
          {dream.title && (
            <p style={{ fontSize: 8, color: currentStyle.accent, fontFamily: 'var(--font-serif)', fontStyle: 'italic', textAlign: 'center', marginBottom: 4 }}>
              {dream.title}
            </p>
          )}
          <p style={{
            fontSize: 9,
            lineHeight: 1.65,
            color: currentStyle.textColor,
            textAlign: 'center',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
          }}>
            {dream.body}
          </p>
          {dream.emotions.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {dream.emotions.map(e => (
                <span key={e} style={{
                  fontSize: 6,
                  padding: '2px 6px',
                  borderRadius: 100,
                  background: `${currentStyle.accent}20`,
                  color: currentStyle.accent,
                  textTransform: 'capitalize',
                }}>{e}</span>
              ))}
            </div>
          )}
          <p style={{ fontSize: 6.5, color: `${currentStyle.textColor}50`, marginTop: 10, letterSpacing: 1.5 }}>
            {dream.author_name}
          </p>
          <p style={{ fontSize: 5.5, color: `${currentStyle.textColor}35`, marginTop: 2, letterSpacing: 2 }}>
            myDreams
          </p>
        </div>

        {/* Download button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleDownload}
          disabled={generating}
          className="glass-btn-primary w-full py-3 text-sm font-semibold"
        >
          {generating ? 'Generando imagen...' : '↓ Descargar imagen'}
        </motion.button>
      </motion.div>
    </>
  )
}
