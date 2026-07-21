import { useState, useRef, useCallback } from 'react'
import type { Dream, Visibility } from '../../types'
import { CommentSection } from './CommentSection'

const VIS_CYCLE: Visibility[] = ['private', 'friends', 'public']
const VIS_META: Record<Visibility, { icon: string; label: string; color: string }> = {
  private: { icon: '🔒', label: 'Privado',  color: 'rgba(255,255,255,0.3)'  },
  friends: { icon: '👥', label: 'Amigos',   color: 'rgba(96,165,250,0.8)'   },
  public:  { icon: '🌐', label: 'Público',  color: 'rgba(52,211,153,0.8)'   },
}

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function getWeekRange(offset: number): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getDay()
  // Monday-based week
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function formatWeekLabel(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} – ${end.getDate()} de ${MONTHS_ES[start.getMonth()]} ${start.getFullYear()}`
  }
  return `${start.getDate()} ${MONTHS_ES[start.getMonth()]} – ${end.getDate()} ${MONTHS_ES[end.getMonth()]} ${start.getFullYear()}`
}

interface Props {
  dreams: Dream[]
  onEdit: (d: Dream) => void
  onDelete: (id: string) => void
  onShare: (d: Dream) => void
  onAnalyze: (d: Dream) => void
  onCycleVis: (d: Dream) => void
  analyzing: string | null
}

export function DreamNotebook({ dreams, onEdit, onDelete, onShare, onAnalyze, onCycleVis, analyzing }: Props) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null)
  const [animKey, setAnimKey] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const touchX = useRef(0)

  const { start, end } = getWeekRange(weekOffset)
  const today = new Date(); today.setHours(23,59,59,999)
  const isCurrentWeek = weekOffset === 0

  // Build 7 days for this week
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  }).filter(d => d <= today || !isCurrentWeek)

  // Map dreams to dates
  const dreamsByDate = dreams.reduce<Record<string, Dream[]>>((acc, dream) => {
    const k = dream.dream_date
    if (!acc[k]) acc[k] = []
    acc[k].push(dream)
    return acc
  }, {})

  // Filter to only days in this week
  const weekStart = toISODate(start)
  const weekEnd   = toISODate(end)
  const weekDreams = days.map(d => ({
    date: d,
    key: toISODate(d),
    dreams: (dreamsByDate[toISODate(d)] ?? []).sort((a,b) => a.created_at > b.created_at ? -1 : 1),
  }))

  // Count total dreams in week
  const weekDreamCount = weekDreams.reduce((s, d) => s + d.dreams.length, 0)

  function navigate(dir: 'prev' | 'next') {
    if (dir === 'next' && weekOffset >= 0) return
    setSlideDir(dir === 'next' ? 'left' : 'right')
    setAnimKey(k => k + 1)
    setWeekOffset(o => dir === 'next' ? o + 1 : o - 1)
    setExpandedId(null)
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) < 50) return
    if (dx < 0) navigate('prev')   // swipe left → older week
    else navigate('next')          // swipe right → newer week
  }, [weekOffset]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative select-none">

      {/* ── Week navigation header ── */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button onClick={() => navigate('prev')}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'rgba(var(--glow-color),0.1)', border: '1px solid rgba(var(--glow-color),0.2)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-white/60">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>

        <div className="text-center flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(var(--glow-color),0.7)' }}>
            {isCurrentWeek ? 'Esta semana' : weekOffset === -1 ? 'Semana pasada' : `Hace ${Math.abs(weekOffset)} semanas`}
          </p>
          <p className="text-[11px] text-white/35">
            {formatWeekLabel(start, end)}
          </p>
        </div>

        <button
          onClick={() => navigate('next')}
          disabled={weekOffset >= 0}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-20"
          style={{ background: 'rgba(var(--glow-color),0.1)', border: '1px solid rgba(var(--glow-color),0.2)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-white/60">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* ── Notebook page ── */}
      <div
        key={animKey}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="rounded-2xl overflow-hidden relative"
        style={{
          animation: slideDir
            ? `${slideDir === 'left' ? 'pageInLeft' : 'pageInRight'} 0.32s cubic-bezier(0.4,0,0.2,1) both`
            : undefined,
          background: 'linear-gradient(160deg, rgba(18,14,38,0.97) 0%, rgba(10,8,24,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.4), -1px 0 0 rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.35)',
        }}
      >
        {/* Horizontal ruled lines overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 52px, rgba(255,255,255,0.028) 52px, rgba(255,255,255,0.028) 53px)',
          backgroundPosition: '0 68px',
        }} />

        {/* Left binding strip */}
        <div className="absolute top-0 bottom-0 left-0 w-[42px] pointer-events-none"
          style={{ borderRight: '1.5px solid rgba(var(--glow-color),0.15)', background: 'rgba(var(--glow-color),0.025)' }}>
          {/* Binding holes */}
          {[20, 50, 80].map(pct => (
            <div key={pct} className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full"
              style={{ top: `${pct}%`, background: 'rgba(0,0,0,0.4)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)' }} />
          ))}
        </div>

        {/* Notebook header */}
        <div className="relative pl-[54px] pr-4 py-4 border-b" style={{ borderColor: 'rgba(var(--glow-color),0.15)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white/70 tracking-wide">📖 BITÁCORA DE SUEÑOS</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(var(--glow-color),0.6)' }}>
                {weekDreamCount === 0 ? 'Sin registros' : `${weekDreamCount} sueño${weekDreamCount !== 1 ? 's' : ''} registrado${weekDreamCount !== 1 ? 's' : ''}`}
              </p>
            </div>
            {weekDreamCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
                style={{ background: 'rgba(var(--glow-color),0.12)', border: '1px solid rgba(var(--glow-color),0.2)', color: 'rgba(var(--glow-color),0.9)' }}>
                🌙 {weekDreams.filter(d => d.dreams.some(dr => dr.is_lucid)).length > 0 ?
                  `${weekDreams.reduce((s,d) => s + d.dreams.filter(dr => dr.is_lucid).length, 0)} lúcidos` :
                  'ninguno lúcido'}
              </div>
            )}
          </div>
        </div>

        {/* Days */}
        <div className="relative pb-2">
          {weekDreams.length === 0 ? (
            <div className="pl-[54px] pr-4 py-10 text-center">
              <p className="text-4xl mb-3" style={{ filter: 'grayscale(0.5)' }}>🌙</p>
              <p className="text-sm text-white/35">No hay registros esta semana</p>
            </div>
          ) : (
            weekDreams.map(({ date, key, dreams: dayDreams }, dayIdx) => {
              const isToday = key === toISODate(new Date())
              const hasLucid = dayDreams.some(d => d.is_lucid)

              return (
                <div key={key} className={dayIdx < weekDreams.length - 1 ? 'border-b' : ''}
                  style={{ borderColor: 'rgba(255,255,255,0.045)' }}>
                  <div className="flex">
                    {/* Day label in left margin */}
                    <div className="w-[42px] shrink-0 flex flex-col items-center justify-start pt-3.5 pb-2 gap-0.5">
                      <span className="text-[9px] font-bold uppercase" style={{ color: isToday ? 'rgba(var(--glow-color),0.9)' : 'rgba(255,255,255,0.25)' }}>
                        {DAYS_ES[date.getDay()]}
                      </span>
                      <span className={`text-sm font-bold leading-none ${isToday ? 'text-white' : 'text-white/35'}`}>
                        {date.getDate()}
                      </span>
                      {hasLucid && (
                        <span className="text-[8px] mt-0.5" style={{ color: 'rgba(var(--glow-color),0.8)' }}>✦</span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 py-2.5 pr-3">
                      {dayDreams.length === 0 ? (
                        <div className="flex items-center h-full py-1.5">
                          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {dayDreams.map((dream) => {
                            const isExpanded = expandedId === dream.id
                            const vis = VIS_META[dream.visibility]
                            return (
                              <div key={dream.id}
                                className="rounded-xl overflow-hidden transition-all"
                                style={{ background: isExpanded ? 'rgba(var(--glow-color),0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isExpanded ? 'rgba(var(--glow-color),0.2)' : 'rgba(255,255,255,0.06)'}` }}>

                                {/* Dream header — always visible */}
                                <button className="w-full text-left px-3 pt-2.5 pb-2" onClick={() => setExpandedId(isExpanded ? null : dream.id)}>
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {dream.title && (
                                          <span className="text-xs font-semibold text-white/85 leading-snug">{dream.title}</span>
                                        )}
                                        {dream.is_lucid && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                                            style={{ background: 'rgba(var(--glow-color),0.2)', color: 'rgba(var(--glow-color),1)', border: '1px solid rgba(var(--glow-color),0.35)' }}>
                                            ✦ lúcido
                                          </span>
                                        )}
                                      </div>
                                      <p className={`text-[11px] text-white/45 leading-relaxed mt-0.5 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                        {dream.body}
                                      </p>
                                    </div>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                                      className={`shrink-0 mt-1 text-white/20 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                      <path d="M6 9l6 6 6-6"/>
                                    </svg>
                                  </div>
                                </button>

                                {/* Expanded content */}
                                {isExpanded && (
                                  <div className="px-3 pb-3 pt-0 flex flex-col gap-2.5 animate-fade-in">
                                    {/* Tags / emotions */}
                                    {(dream.tags.length > 0 || dream.emotions.length > 0) && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {dream.emotions.slice(0,3).map(e => (
                                          <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/45">{e}</span>
                                        ))}
                                        {dream.tags.slice(0,4).map(t => (
                                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full accent-text"
                                            style={{ background: 'rgba(var(--glow-color),0.1)', border: '1px solid rgba(var(--glow-color),0.2)' }}>#{t}</span>
                                        ))}
                                      </div>
                                    )}

                                    {/* AI summary */}
                                    {dream.summary && (
                                      <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(var(--glow-color),0.06)', border: '1px solid rgba(var(--glow-color),0.12)' }}>
                                        <p className="text-[10px] font-bold mb-1" style={{ color: 'rgba(var(--glow-color),0.6)' }}>✦ ANÁLISIS IA</p>
                                        <p className="text-[11px] text-white/55 italic leading-relaxed">{dream.summary}</p>
                                      </div>
                                    )}

                                    {/* Action bar */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <button onClick={() => onCycleVis(dream)}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all active:scale-95"
                                        style={{ background: 'rgba(255,255,255,0.06)', color: vis.color }}>
                                        <span>{VIS_META[dream.visibility].icon}</span>
                                        <span>{vis.label}</span>
                                      </button>

                                      <button onClick={() => onAnalyze(dream)}
                                        disabled={analyzing === dream.id}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-white/50 transition-all active:scale-95 disabled:opacity-40"
                                        style={{ background: 'rgba(255,255,255,0.06)' }}>
                                        {analyzing === dream.id
                                          ? <div className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />
                                          : <span>✦</span>}
                                        <span>IA</span>
                                      </button>

                                      <button onClick={() => onShare(dream)}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-white/50 transition-all active:scale-95"
                                        style={{ background: 'rgba(255,255,255,0.06)' }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                                        </svg>
                                        <span>Compartir</span>
                                      </button>

                                      <button onClick={() => onEdit(dream)}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-white/50 transition-all active:scale-95"
                                        style={{ background: 'rgba(255,255,255,0.06)' }}>
                                        <span>✎</span><span>Editar</span>
                                      </button>

                                      <button onClick={() => { if (confirm('¿Borrar este sueño?')) onDelete(dream.id) }}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-red-400/50 hover:text-red-400 transition-all active:scale-95"
                                        style={{ background: 'rgba(255,255,255,0.04)' }}>
                                        <span>✕</span><span>Borrar</span>
                                      </button>
                                    </div>

                                    {/* Comments */}
                                    <CommentSection dreamId={dream.id} allowComments={dream.allow_comments} forceOpen />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Page footer */}
        <div className="relative flex items-center justify-between px-[54px] py-2.5 border-t" style={{ borderColor: 'rgba(var(--glow-color),0.1)' }}>
          <span className="text-[10px] text-white/20 italic">Bitácora del Sueño</span>
          <span className="text-[10px] text-white/20">
            {weekOffset === 0 ? 'Pág. actual' : `${Math.abs(weekOffset)} sem. atrás`}
          </span>
        </div>
      </div>

      {/* Swipe hint — only on first load */}
      <p className="text-center text-[10px] text-white/18 mt-2">
        ← desliza para ver semanas anteriores →
      </p>

      <style>{`
        @keyframes pageInLeft {
          from { opacity: 0; transform: translateX(40px) }
          to   { opacity: 1; transform: translateX(0) }
        }
        @keyframes pageInRight {
          from { opacity: 0; transform: translateX(-40px) }
          to   { opacity: 1; transform: translateX(0) }
        }
      `}</style>
    </div>
  )
}
