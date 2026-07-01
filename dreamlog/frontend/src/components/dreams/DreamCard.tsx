import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Dream, FeedDream } from '../../types'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { formatDateShort, VISIBILITY_LABELS, emotionColor } from '../../lib/utils'

interface DreamCardProps {
  dream: Dream | FeedDream
  showAuthor?: boolean
  actions?: React.ReactNode
}

export function DreamCard({ dream, showAuthor, actions }: DreamCardProps) {
  const [expanded, setExpanded] = useState(false)
  const vis = VISIBILITY_LABELS[dream.visibility]
  const author = 'author_name' in dream ? dream : null

  const preview = dream.body.slice(0, 200)
  const needsExpand = dream.body.length > 200

  return (
    <Card className="hover:border-white/20 transition-colors animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {showAuthor && author && (
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-full bg-dream-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {author.author_name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm text-slate-400">{author.author_name}</span>
            </div>
          )}
          {dream.title && (
            <h3 className="font-semibold text-white leading-snug mb-0.5">{dream.title}</h3>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{formatDateShort(dream.dream_date)}</span>
            {dream.is_lucid && (
              <Badge variant="dream" className="text-xs">✦ Lúcido</Badge>
            )}
            {!showAuthor && (
              <span className={vis.color}>{vis.icon} {vis.label}</span>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>

      {/* Body */}
      <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
        {expanded ? dream.body : preview}
        {needsExpand && !expanded && '…'}
      </p>
      {needsExpand && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-dream-400 hover:text-dream-300 mt-1 transition-colors"
        >
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}

      {/* AI Summary */}
      {dream.summary && (
        <div className="mt-3 p-3 bg-dream-950/60 border border-dream-800/40 rounded-lg">
          <p className="text-xs text-dream-300 italic">{dream.summary}</p>
        </div>
      )}

      {/* Tags & Emotions */}
      {(dream.emotions.length > 0 || dream.tags.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {dream.emotions.map((e) => (
            <span key={e} className={`inline-flex px-2 py-0.5 rounded-full text-xs ${emotionColor(e)}`}>
              {e}
            </span>
          ))}
          {dream.tags.map((t) => (
            <Badge key={t}>#{t}</Badge>
          ))}
        </div>
      )}

      {/* Sleep quality */}
      {dream.sleep_quality && (
        <div className="mt-2 flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={`text-xs ${i < dream.sleep_quality! ? 'text-yellow-400' : 'text-slate-700'}`}>★</span>
          ))}
          <span className="text-xs text-slate-500 ml-1">calidad del sueño</span>
        </div>
      )}
    </Card>
  )
}
