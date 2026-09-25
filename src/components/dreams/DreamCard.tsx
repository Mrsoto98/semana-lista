import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Dream } from '../../types'

interface Props {
  dream: Dream
  onClick: () => void
  onEdit?: () => void
  onDelete?: () => void
  onToggleLucid?: () => void
  onShare?: () => void
}

const VISIBILITY_ICON: Record<string, string> = {
  private: '🔒',
  friends: '👥',
  public:  '🌍',
}

const WEEKDAY = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const EMOTION_COLORS: Record<string, string> = {
  miedo:      '232, 88, 88',
  tristeza:   '100, 148, 212',
  'alegría':  '76, 200, 140',
  asombro:    '184, 164, 232',
  'confusión':'232, 200, 88',
  paz:        '100, 212, 184',
  amor:       '232, 140, 184',
  ansiedad:   '232, 140, 88',
  curiosidad: '130, 200, 232',
  'vergüenza':'212, 130, 100',
}

export function DreamCard({ dream, onClick, onEdit, onDelete, onToggleLucid, onShare }: Props) {
  const date    = new Date(dream.dream_date + 'T12:00:00')
  const weekday = WEEKDAY[date.getDay()]
  const day     = date.getDate()
  const month   = date.toLocaleString('es', { month: 'short' })
  const timeAgo = formatDistanceToNow(new Date(dream.created_at), { addSuffix: true, locale: es })

  const primaryEmotion = dream.emotions[0]?.toLowerCase()
  const emotionRgb     = EMOTION_COLORS[primaryEmotion ?? '']

  const [menuOpen, setMenuOpen] = useState(false)
  const [menuTop, setMenuTop]   = useState(0)
  const longTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)
  const cardRef     = useRef<HTMLDivElement>(null)

  const hasMenu = !!(onEdit || onDelete || onToggleLucid || onShare)

  function startLongPress(e: React.PointerEvent) {
    if (!hasMenu) return
    didLongPress.current = false
    longTimer.current = setTimeout(() => {
      didLongPress.current = true
      navigator.vibrate?.(14)
      const rect = cardRef.current?.getBoundingClientRect()
      if (rect) setMenuTop(Math.min(rect.bottom + 8, window.innerHeight - 240))
      setMenuOpen(true)
    }, 460)
  }

  function cancelLongPress() {
    if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null }
  }

  function handleClick() {
    if (didLongPress.current) { didLongPress.current = false; return }
    onClick()
  }

  const menuPortal = hasMenu && createPortal(
    <>
      {menuOpen && (
        <div className="fixed inset-0 z-[99]" onClick={() => setMenuOpen(false)} />
      )}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed z-[100] rounded-[22px] overflow-hidden"
            style={{
              top: menuTop, left: 16, right: 16,
              background: 'rgba(14, 14, 26, 0.97)',
              backdropFilter: 'blur(40px) saturate(2)',
              border: '1px solid rgba(255,255,255,0.13)',
              boxShadow: '0 28px 64px rgba(0,0,0,0.65), 0 4px 16px rgba(0,0,0,0.4)',
            }}
            initial={{ opacity: 0, scale: 0.94, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            transition={{ type: 'spring', stiffness: 520, damping: 32 }}
          >
            {/* Dream title header */}
            <div className="px-5 pt-4 pb-3 border-b border-white/6">
              <p className="text-[11px] text-white/30 uppercase tracking-wider mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </p>
              <p className="text-sm font-medium text-white/75 line-clamp-1" style={{ fontFamily: 'var(--font-serif)' }}>
                {dream.title || dream.body.slice(0, 48) + '…'}
              </p>
            </div>

            {onEdit && (
              <button
                onClick={() => { setMenuOpen(false); onEdit() }}
                className="w-full flex items-center gap-3.5 px-5 py-3.5 text-sm text-white/75 hover:bg-white/5 active:bg-white/8 transition-colors text-left border-b border-white/5"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Editar sueño
              </button>
            )}

            {onToggleLucid && (
              <button
                onClick={() => { setMenuOpen(false); onToggleLucid() }}
                className="w-full flex items-center gap-3.5 px-5 py-3.5 text-sm text-white/75 hover:bg-white/5 active:bg-white/8 transition-colors text-left border-b border-white/5"
              >
                <span className="text-base leading-none" style={{ marginTop: -1 }}>✨</span>
                {dream.is_lucid ? 'Quitar sueño lúcido' : 'Marcar como lúcido'}
              </button>
            )}

            {onShare && (
              <button
                onClick={() => { setMenuOpen(false); onShare() }}
                className="w-full flex items-center gap-3.5 px-5 py-3.5 text-sm text-white/75 hover:bg-white/5 active:bg-white/8 transition-colors text-left border-b border-white/5"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Compartir tarjeta
              </button>
            )}

            {onDelete && (
              <button
                onClick={() => { setMenuOpen(false); onDelete() }}
                className="w-full flex items-center gap-3.5 px-5 py-3.5 text-sm text-red-400/75 hover:bg-red-500/8 active:bg-red-500/12 transition-colors text-left"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
                Eliminar sueño
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  )

  return (
    <>
      {menuPortal}
      <motion.div
        ref={cardRef}
        whileHover={{ scale: 1.008, y: -1 }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={handleClick}
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerMove={cancelLongPress}
        onContextMenu={e => e.preventDefault()}
        className={`glass-card p-4 cursor-pointer select-none ${dream.is_lucid ? 'lucid-border' : ''}`}
        style={emotionRgb && !dream.is_lucid ? {
          borderColor: `rgba(${emotionRgb}, 0.28)`,
          boxShadow: `0 4px 28px rgba(${emotionRgb}, 0.10), -4px 0 16px rgba(${emotionRgb}, 0.07), inset 0 1px 0 rgba(255,255,255,0.08)`,
        } : undefined}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {/* Date block */}
            <div
              className="shrink-0 text-center px-2 py-1.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.05)', minWidth: 44 }}
            >
              <div className="text-[10px] font-medium text-white/40 uppercase">{weekday}</div>
              <div className="text-lg font-bold leading-none" style={{ fontFamily: 'var(--font-mono)' }}>{day}</div>
              <div className="text-[10px] text-white/40">{month}</div>
            </div>

            <div className="min-w-0">
              {dream.title ? (
                <h3 className="text-[15px] font-medium leading-snug line-clamp-1" style={{ fontFamily: 'var(--font-serif)' }}>
                  {dream.title}
                </h3>
              ) : (
                <p className="text-[15px] italic text-white/50 leading-snug" style={{ fontFamily: 'var(--font-serif)' }}>
                  Sin título
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-white/35">{timeAgo}</span>
                {dream.is_lucid && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="text-[11px] font-medium" style={{ color: '#64D4B8' }}>✨ Lúcido</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {dream.is_lucid && <div className="shrink-0 lucid-spark mt-1.5" />}
        </div>

        {/* Body excerpt */}
        <p className="text-[13px] text-white/55 leading-relaxed line-clamp-2 mb-3">
          {dream.body}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {dream.sleep_quality != null && (
              <span className="text-[11px] text-white/40">
                {'★'.repeat(dream.sleep_quality)}{'☆'.repeat(5 - dream.sleep_quality)}
              </span>
            )}
            <span
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}
            >
              {VISIBILITY_ICON[dream.visibility]}
            </span>
            {dream.emotions.slice(0, 3).map((e) => (
              <span
                key={e}
                className="text-[10px] px-2 py-0.5 rounded-full capitalize"
                style={{ background: 'rgba(var(--glow), 0.12)', color: 'rgba(255,255,255,0.55)' }}
              >
                {e}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2.5 text-white/30">
            {dream.comment_count != null && dream.comment_count > 0 && (
              <span className="text-[11px]">💬 {dream.comment_count}</span>
            )}
            {dream.like_count != null && dream.like_count > 0 && (
              <span className="text-[11px]">❤ {dream.like_count}</span>
            )}
            {dream.summary && (
              <span className="text-[11px] flex items-center gap-1">
                <span style={{ color: `hsl(var(--accent-h), var(--accent-s), 70%)` }}>◆</span>
                <span>IA</span>
              </span>
            )}
          </div>
        </div>

        {dream.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-2.5">
            {dream.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.45)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    </>
  )
}
