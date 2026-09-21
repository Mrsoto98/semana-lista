import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Dream } from '../../types'

interface Props {
  dream: Dream
  onClick: () => void
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

export function DreamCard({ dream, onClick }: Props) {
  const date = new Date(dream.dream_date + 'T12:00:00')
  const weekday = WEEKDAY[date.getDay()]
  const day = date.getDate()
  const month = date.toLocaleString('es', { month: 'short' })
  const timeAgo = formatDistanceToNow(new Date(dream.created_at), { addSuffix: true, locale: es })

  const primaryEmotion = dream.emotions[0]?.toLowerCase()
  const emotionRgb = EMOTION_COLORS[primaryEmotion ?? '']

  return (
    <motion.div
      whileHover={{ scale: 1.008, y: -1 }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onClick={onClick}
      className={`glass-card p-4 cursor-pointer ${dream.is_lucid ? 'lucid-border' : ''}`}
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
              <h3
                className="text-[15px] font-medium leading-snug line-clamp-1"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {dream.title}
              </h3>
            ) : (
              <p
                className="text-[15px] italic text-white/50 leading-snug"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
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

        {/* Lucid indicator */}
        {dream.is_lucid && (
          <div className="shrink-0 lucid-spark mt-1.5" />
        )}
      </div>

      {/* Body excerpt */}
      <p className="text-[13px] text-white/55 leading-relaxed line-clamp-2 mb-3">
        {dream.body}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Quality stars */}
          {dream.sleep_quality != null && (
            <span className="text-[11px] text-white/40">
              {'★'.repeat(dream.sleep_quality)}{'☆'.repeat(5 - dream.sleep_quality)}
            </span>
          )}

          {/* Visibility */}
          <span
            className="text-[11px] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}
          >
            {VISIBILITY_ICON[dream.visibility]}
          </span>

          {/* Emotion chips */}
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

        {/* Engagement */}
        <div className="flex items-center gap-2.5 text-white/30">
          {dream.comment_count != null && dream.comment_count > 0 && (
            <span className="text-[11px]">💬 {dream.comment_count}</span>
          )}
          {dream.like_count != null && dream.like_count > 0 && (
            <span className="text-[11px]">❤ {dream.like_count}</span>
          )}
          {(dream.summary) && (
            <span className="text-[11px] flex items-center gap-1">
              <span style={{ color: `hsl(var(--accent-h), var(--accent-s), 70%)` }}>◆</span>
              <span>IA</span>
            </span>
          )}
        </div>
      </div>

      {/* Tag chips */}
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
  )
}
