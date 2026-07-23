import { useState, useRef, useEffect } from 'react'
import type { Dream, Visibility } from '../../types'
import { CommentSection } from './CommentSection'

const SKINS = [
  { id: 'cosmic',     label: 'Cósmico',    src: '/notebook/cosmic.jpg',     accent: '120,160,220' },
  { id: 'leather',    label: 'Cuero',      src: '/notebook/leather.jpg',    accent: '160,140,100' },
  { id: 'glass',      label: 'Cristal',    src: '/notebook/glass.jpg',      accent: '60,210,200'  },
  { id: 'manuscript', label: 'Manuscrito', src: '/notebook/manuscript.jpg', accent: '180,150,80'  },
  { id: 'nebula',     label: 'Nebulosa',   src: '/notebook/nebula.jpg',     accent: '160,100,220' },
  { id: 'rose',       label: 'Rosa',       src: '/notebook/rose.jpg',       accent: '210,140,160' },
  { id: 'botanical',  label: 'Botánico',   src: '/notebook/botanical.jpg',  accent: '80,170,100'  },
  { id: 'velvet',     label: 'Terciopelo', src: '/notebook/velvet.jpg',     accent: '170,100,210' },
] as const
type SkinId = typeof SKINS[number]['id']

const VIS_META: Record<Visibility, { icon: string; label: string }> = {
  private: { icon: '🔒', label: 'Privado' },
  friends: { icon: '👥', label: 'Amigos'  },
  public:  { icon: '🌐', label: 'Público' },
}

const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function weekStart(offset: number) {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7)
  d.setHours(0,0,0,0)
  return d
}
function toISO(d: Date) { return d.toISOString().slice(0,10) }
function weekLabel(s: Date) {
  const e = new Date(s); e.setDate(s.getDate() + 6)
  if (s.getMonth() === e.getMonth())
    return `${s.getDate()}–${e.getDate()} ${MONTHS[s.getMonth()]}`
  return `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]}`
}

interface Props {
  dreams:     Dream[]
  onEdit:     (d: Dream) => void
  onDelete:   (id: string) => void
  onShare:    (d: Dream) => void
  onAnalyze:  (d: Dream) => void
  onCycleVis: (d: Dream) => void
  analyzing:  string | null
}

export function DreamNotebook({ dreams, onEdit, onDelete, onShare, onAnalyze, onCycleVis, analyzing }: Props) {
  const [skin, setSkin]             = useState<SkinId>(() => (localStorage.getItem('nb-skin') as SkinId) ?? 'cosmic')
  const [weekOffset, setWeekOffset] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [anim, setAnim]             = useState('')
  const pending                     = useRef(0)
  const touchX                      = useRef(0)

  const S = SKINS.find(s => s.id === skin)!

  // Re-read skin from localStorage when component re-renders (Settings changed it)
  useEffect(() => {
    const onStorage = () => setSkin((localStorage.getItem('nb-skin') as SkinId) ?? 'cosmic')
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function go(dir: 'prev'|'next') {
    if (dir === 'next' && weekOffset >= 0) return
    pending.current = weekOffset + (dir === 'prev' ? -1 : 1)
    setAnim(dir === 'prev' ? 'slide-out-left' : 'slide-out-right')
  }

  useEffect(() => {
    if (!anim.startsWith('slide-out')) return
    const t = setTimeout(() => {
      setWeekOffset(pending.current)
      setExpandedId(null)
      setAnim(anim.includes('left') ? 'slide-in-right' : 'slide-in-left')
    }, 220)
    return () => clearTimeout(t)
  }, [anim])

  useEffect(() => {
    if (!anim.startsWith('slide-in')) return
    const t = setTimeout(() => setAnim(''), 260)
    return () => clearTimeout(t)
  }, [anim])

  const start   = weekStart(weekOffset)
  const end     = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999)
  const today   = toISO(new Date())
  const weekDreams = dreams
    .filter(d => d.dream_date >= toISO(start) && d.dream_date <= toISO(end))
    .sort((a,b) => b.dream_date.localeCompare(a.dream_date))

  return (
    <div>

      {/* Week nav */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => go('prev')}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90"
          style={{ background: `rgba(${S.accent},0.18)`, border: `1px solid rgba(${S.accent},0.35)` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.7">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div className="flex-1 text-center">
          <p className="text-xs font-bold" style={{ color: `rgba(${S.accent},1)` }}>
            {weekOffset === 0 ? 'Esta semana' : weekOffset === -1 ? 'Semana pasada' : `Hace ${Math.abs(weekOffset)} semanas`}
          </p>
          <p className="text-[11px] text-white/35">{weekLabel(start)}</p>
        </div>
        <button onClick={() => go('next')} disabled={weekOffset >= 0}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-20"
          style={{ background: `rgba(${S.accent},0.18)`, border: `1px solid rgba(${S.accent},0.35)` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.7">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* Dream cards */}
      <div className={`flex flex-col gap-3 ${anim}`}
        onTouchStart={e => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - touchX.current
          if (Math.abs(dx) > 50) go(dx < 0 ? 'prev' : 'next')
        }}>
        {weekDreams.length === 0 ? (
          <div className="rounded-2xl overflow-hidden"
            style={{ backgroundImage: `url(${S.src})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className="flex flex-col items-center justify-center py-14"
              style={{ background: 'rgba(0,0,0,0.55)' }}>
              <span className="text-4xl mb-3">🌙</span>
              <p className="text-sm text-white/60">Sin sueños esta semana</p>
              <p className="text-xs text-white/30 mt-1">← desliza para ver otras semanas</p>
            </div>
          </div>
        ) : weekDreams.map(dream => {
          const isExpanded = expandedId === dream.id
          const vis = VIS_META[dream.visibility]
          const isToday = dream.dream_date === today

          return (
            <div key={dream.id} className="rounded-2xl overflow-hidden"
              style={{
                backgroundImage: `url(${S.src})`,
                backgroundSize: 'cover',
                backgroundPosition: `center ${dream.is_lucid ? '30%' : '60%'}`,
                boxShadow: `0 4px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.08)`,
              }}>
              {/* Dark overlay */}
              <div style={{ background: 'rgba(0,0,0,0.52)' }}>

                {/* Card content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      {dream.title && (
                        <h3 className="font-semibold text-white text-sm leading-snug">{dream.title}</h3>
                      )}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px]" style={{ color: `rgba(${S.accent},0.9)` }}>
                          {isToday ? 'Hoy' : new Date(dream.dream_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                        {dream.is_lucid && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `rgba(${S.accent},0.25)`, border: `1px solid rgba(${S.accent},0.5)`, color: `rgba(${S.accent},1)` }}>
                            ✦ Lúcido
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => onCycleVis(dream)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all active:scale-95 text-white/60"
                        style={{ background: 'rgba(255,255,255,0.1)' }}>
                        {vis.icon} {vis.label}
                      </button>
                      <button onClick={() => onAnalyze(dream)} disabled={analyzing === dream.id}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] text-white/60 transition-all active:scale-95 disabled:opacity-40"
                        style={{ background: 'rgba(255,255,255,0.1)' }}>
                        {analyzing === dream.id
                          ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin"/>
                          : '✦'}
                      </button>
                      <button onClick={() => onShare(dream)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95"
                        style={{ background: 'rgba(255,255,255,0.1)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6">
                          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                      </button>
                      <button onClick={() => onEdit(dream)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] text-white/60 transition-all active:scale-95"
                        style={{ background: 'rgba(255,255,255,0.1)' }}>✎</button>
                      <button onClick={() => { if (confirm('¿Borrar este sueño?')) onDelete(dream.id) }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] text-red-400/50 hover:text-red-400 transition-all active:scale-95"
                        style={{ background: 'rgba(255,255,255,0.07)' }}>✕</button>
                    </div>
                  </div>

                  <p className={`text-white/70 text-sm leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
                    {dream.body}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center gap-3 mt-3 pt-2.5"
                    style={{ borderTop: `1px solid rgba(${S.accent},0.15)` }}>
                    <span className="flex items-center gap-1.5 text-xs text-white/40">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      {dream.like_count ?? 0}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-white/40">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      {dream.comment_count ?? 0}
                    </span>
                    <button onClick={() => setExpandedId(isExpanded ? null : dream.id)}
                      className="ml-auto flex items-center gap-1 text-xs font-medium transition-all px-2.5 py-1 rounded-lg"
                      style={{ color: `rgba(${S.accent},0.8)`, background: `rgba(${S.accent},0.1)` }}>
                      {isExpanded ? 'Esconder' : 'Ver más'}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 flex flex-col gap-2.5 animate-fade-in">
                      {(dream.emotions.length > 0 || dream.tags.length > 0) && (
                        <div className="flex flex-wrap gap-1.5">
                          {dream.emotions.slice(0,3).map(e => (
                            <span key={e} className="text-[10px] px-2 py-0.5 rounded-full text-white/50 bg-white/10">{e}</span>
                          ))}
                          {dream.tags.slice(0,4).map(t => (
                            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{ background: `rgba(${S.accent},0.18)`, border: `1px solid rgba(${S.accent},0.3)`, color: `rgba(${S.accent},1)` }}>
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                      {dream.summary && (
                        <div className="px-3 py-2.5 rounded-xl"
                          style={{ background: `rgba(${S.accent},0.08)`, border: `1px solid rgba(${S.accent},0.18)` }}>
                          <p className="text-[10px] font-bold mb-1" style={{ color: `rgba(${S.accent},0.7)` }}>✦ ANÁLISIS IA</p>
                          <p className="text-xs text-white/55 italic leading-relaxed">{dream.summary}</p>
                        </div>
                      )}
                      <CommentSection dreamId={dream.id} allowComments={dream.allow_comments} forceOpen />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-center text-[10px] text-white/15 mt-3">← desliza para cambiar de semana →</p>

      <style>{`
        .slide-out-left  { animation: soL .22s ease-in  forwards }
        .slide-out-right { animation: soR .22s ease-in  forwards }
        .slide-in-left   { animation: siL .26s ease-out forwards }
        .slide-in-right  { animation: siR .26s ease-out forwards }
        @keyframes soL { to { transform: translateX(-40px) scale(.96); opacity:0 } }
        @keyframes soR { to { transform: translateX( 40px) scale(.96); opacity:0 } }
        @keyframes siL { from { transform: translateX( 40px) scale(.96); opacity:0 } to { transform:none; opacity:1 } }
        @keyframes siR { from { transform: translateX(-40px) scale(.96); opacity:0 } to { transform:none; opacity:1 } }
      `}</style>
    </div>
  )
}

