import { useState, useRef, useCallback, useEffect } from 'react'
import type { Dream, Visibility } from '../../types'
import { CommentSection } from './CommentSection'

// ── Skins ────────────────────────────────────────────────────
const SKINS = [
  { id: 'cosmic',     label: 'Pergamino cósmico',   src: '/notebook/cosmic.jpg',     accent: '120,140,200' },
  { id: 'leather',    label: 'Cuero lunar',          src: '/notebook/leather.jpg',    accent: '140,130,100' },
  { id: 'glass',      label: 'Cristal líquido',      src: '/notebook/glass.jpg',      accent: '80,210,200'  },
  { id: 'manuscript', label: 'Manuscrito antiguo',   src: '/notebook/manuscript.jpg', accent: '160,140,80'  },
  { id: 'nebula',     label: 'Nebulosa profunda',    src: '/notebook/nebula.jpg',     accent: '140,100,200' },
  { id: 'rose',       label: 'Polvo de luna rosa',   src: '/notebook/rose.jpg',       accent: '190,130,140' },
  { id: 'botanical',  label: 'Jardín de medianoche', src: '/notebook/botanical.jpg',  accent: '80,150,100'  },
  { id: 'velvet',     label: 'Terciopelo lila',      src: '/notebook/velvet.jpg',     accent: '160,100,190' },
] as const

type SkinId = typeof SKINS[number]['id']
const LS_SKIN = 'notebook-skin'

// ── Helpers ──────────────────────────────────────────────────
const VIS_CYCLE: Visibility[] = ['private', 'friends', 'public']
const VIS_META: Record<Visibility, { icon: string; label: string; color: string }> = {
  private: { icon: '🔒', label: 'Privado', color: 'rgba(255,255,255,0.4)' },
  friends: { icon: '👥', label: 'Amigos',  color: 'rgba(96,165,250,0.9)'  },
  public:  { icon: '🌐', label: 'Público', color: 'rgba(52,211,153,0.9)'  },
}

const DAYS_ES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function getWeekRange(offset: number) {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function toISO(d: Date) { return d.toISOString().slice(0, 10) }

function weekLabel(start: Date, end: Date) {
  if (start.getMonth() === end.getMonth())
    return `${start.getDate()} – ${end.getDate()} de ${MONTHS_ES[start.getMonth()]} ${start.getFullYear()}`
  return `${start.getDate()} ${MONTHS_ES[start.getMonth()]} – ${end.getDate()} ${MONTHS_ES[end.getMonth()]} ${start.getFullYear()}`
}

// ── Props ─────────────────────────────────────────────────────
interface Props {
  dreams:     Dream[]
  onEdit:     (d: Dream) => void
  onDelete:   (id: string) => void
  onShare:    (d: Dream) => void
  onAnalyze:  (d: Dream) => void
  onCycleVis: (d: Dream) => void
  analyzing:  string | null
}

// ── Component ─────────────────────────────────────────────────
export function DreamNotebook({ dreams, onEdit, onDelete, onShare, onAnalyze, onCycleVis, analyzing }: Props) {
  const [skin, setSkin]             = useState<SkinId>(() => (localStorage.getItem(LS_SKIN) as SkinId) ?? 'cosmic')
  const [showSkins, setShowSkins]   = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Page-flip animation
  const [phase, setPhase]     = useState<'idle' | 'out' | 'in'>('idle')
  const [flipDir, setFlipDir] = useState<'left' | 'right'>('left')
  const pendingOffset         = useRef<number>(0)
  const touchX                = useRef(0)

  const currentSkin = SKINS.find(s => s.id === skin) ?? SKINS[0]

  function changeSkin(id: SkinId) {
    setSkin(id)
    localStorage.setItem(LS_SKIN, id)
    setShowSkins(false)
  }

  function navigate(dir: 'prev' | 'next') {
    if (dir === 'next' && weekOffset >= 0) return
    pendingOffset.current = weekOffset + (dir === 'prev' ? -1 : 1)
    setFlipDir(dir === 'prev' ? 'left' : 'right')
    setPhase('out')
  }

  useEffect(() => {
    if (phase !== 'out') return
    const t = setTimeout(() => {
      setWeekOffset(pendingOffset.current)
      setExpandedId(null)
      setPhase('in')
    }, 280)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'in') return
    const t = setTimeout(() => setPhase('idle'), 340)
    return () => clearTimeout(t)
  }, [phase])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) < 50) return
    navigate(dx < 0 ? 'prev' : 'next')
  }, [weekOffset]) // eslint-disable-line react-hooks/exhaustive-deps

  const { start, end } = getWeekRange(weekOffset)
  const today = new Date(); today.setHours(23, 59, 59, 999)
  const isCurrentWeek = weekOffset === 0

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return d
  }).filter(d => d <= today || !isCurrentWeek)

  const byDate = dreams.reduce<Record<string, Dream[]>>((acc, dr) => {
    if (!acc[dr.dream_date]) acc[dr.dream_date] = []
    acc[dr.dream_date].push(dr)
    return acc
  }, {})

  const weekDays = days.map(d => ({
    date: d, key: toISO(d),
    dreams: (byDate[toISO(d)] ?? []).sort((a, b) => a.created_at > b.created_at ? -1 : 1),
  }))

  const totalDreams = weekDays.reduce((s, d) => s + d.dreams.length, 0)
  const lucidDreams = weekDays.reduce((s, d) => s + d.dreams.filter(dr => dr.is_lucid).length, 0)
  const A = currentSkin.accent

  const pageClass = phase === 'out'
    ? (flipDir === 'left'  ? 'nb-out-left'  : 'nb-out-right')
    : phase === 'in'
    ? (flipDir === 'left'  ? 'nb-in-left'   : 'nb-in-right')
    : ''

  return (
    <div className="relative">

      {/* ── Skin picker ── */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <button onClick={() => setShowSkins(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] text-white/50 transition-all active:scale-95"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <span>🎨</span>
          <span>{currentSkin.label}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className={`transition-transform duration-200 ${showSkins ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
      </div>

      {showSkins && (
        <div className="mb-3 p-3 rounded-2xl animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="grid grid-cols-4 gap-2">
            {SKINS.map(s => (
              <button key={s.id} onClick={() => changeSkin(s.id)} className="flex flex-col items-center gap-1.5 group">
                <div className="w-full aspect-[3/4] rounded-xl overflow-hidden relative transition-all duration-200 group-active:scale-95"
                  style={{
                    backgroundImage: `url(${s.src})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: skin === s.id
                      ? `2px solid rgba(${s.accent},0.9)`
                      : '2px solid rgba(255,255,255,0.1)',
                    boxShadow: skin === s.id ? `0 0 14px rgba(${s.accent},0.45)` : 'none',
                  }}>
                  {skin === s.id && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: `rgba(${s.accent},0.18)` }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: `rgba(${s.accent},0.8)` }}>✓</div>
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-white/35 text-center leading-tight line-clamp-2 px-0.5">
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Week navigation ── */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <button onClick={() => navigate('prev')}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: `rgba(${A},0.15)`, border: `1px solid rgba(${A},0.3)` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-white/60">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>

        <div className="text-center flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: `rgba(${A},0.9)` }}>
            {isCurrentWeek ? 'Esta semana' : weekOffset === -1 ? 'Semana pasada' : `Hace ${Math.abs(weekOffset)} semanas`}
          </p>
          <p className="text-[11px] text-white/35">{weekLabel(start, end)}</p>
        </div>

        <button onClick={() => navigate('next')} disabled={weekOffset >= 0}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-20"
          style={{ background: `rgba(${A},0.15)`, border: `1px solid rgba(${A},0.3)` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-white/60">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* ── Notebook page ── */}
      <div
        className={`rounded-2xl overflow-hidden relative ${pageClass}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          backgroundImage: `url(${currentSkin.src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          boxShadow: `0 8px 48px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,255,255,0.07)`,
        }}
      >
        {/* Readability overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(0,0,0,0.40)' }} />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b"
            style={{ borderColor: `rgba(${A},0.2)`, background: 'rgba(0,0,0,0.28)' }}>
            <div>
              <p className="text-xs font-bold tracking-widest text-white/80">📖 BITÁCORA DE SUEÑOS</p>
              <p className="text-[10px] mt-0.5" style={{ color: `rgba(${A},0.85)` }}>
                {totalDreams === 0
                  ? 'Sin registros esta semana'
                  : `${totalDreams} sueño${totalDreams !== 1 ? 's' : ''}${lucidDreams > 0 ? ` · ${lucidDreams} lúcido${lucidDreams !== 1 ? 's' : ''}` : ''}`}
              </p>
            </div>
            {lucidDreams > 0 && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full"
                style={{ background: `rgba(${A},0.2)`, border: `1px solid rgba(${A},0.35)`, color: `rgba(${A},1)` }}>
                ✦ {lucidDreams} lúcido{lucidDreams !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Days */}
          {weekDays.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-4xl mb-3">🌙</p>
              <p className="text-sm text-white/35">Sin registros esta semana</p>
            </div>
          ) : weekDays.map(({ date, key, dreams: dayDreams }, idx) => {
            const isToday = key === toISO(new Date())
            return (
              <div key={key}
                className={idx < weekDays.length - 1 ? 'border-b' : ''}
                style={{ borderColor: `rgba(${A},0.1)` }}>
                <div className="flex">
                  {/* Day margin */}
                  <div className="w-12 shrink-0 flex flex-col items-center justify-start pt-3 pb-2 border-r"
                    style={{ borderColor: `rgba(${A},0.2)`, background: 'rgba(0,0,0,0.22)' }}>
                    <span className="text-[9px] font-bold uppercase leading-none"
                      style={{ color: isToday ? `rgba(${A},1)` : 'rgba(255,255,255,0.3)' }}>
                      {DAYS_ES[date.getDay()]}
                    </span>
                    <span className={`text-base font-bold leading-tight mt-0.5 ${isToday ? 'text-white' : 'text-white/35'}`}>
                      {date.getDate()}
                    </span>
                    {dayDreams.some(d => d.is_lucid) && (
                      <span className="text-[9px] mt-1" style={{ color: `rgba(${A},0.9)` }}>✦</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 py-2.5 pr-3 pl-2.5">
                    {dayDreams.length === 0 ? (
                      <div className="flex items-center h-8">
                        <div className="flex-1 h-px" style={{ background: `rgba(${A},0.07)` }} />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {dayDreams.map(dream => {
                          const isExpanded = expandedId === dream.id
                          const vis = VIS_META[dream.visibility]
                          return (
                            <div key={dream.id}
                              className="rounded-xl overflow-hidden transition-all duration-200"
                              style={{
                                background: isExpanded ? 'rgba(0,0,0,0.52)' : 'rgba(0,0,0,0.32)',
                                border: `1px solid ${isExpanded ? `rgba(${A},0.32)` : 'rgba(255,255,255,0.08)'}`,
                                backdropFilter: 'blur(6px)',
                              }}>

                              <button className="w-full text-left px-3 pt-2.5 pb-2"
                                onClick={() => setExpandedId(isExpanded ? null : dream.id)}>
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {dream.title && (
                                        <span className="text-xs font-semibold text-white/90 leading-snug">{dream.title}</span>
                                      )}
                                      {dream.is_lucid && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                                          style={{ background: `rgba(${A},0.25)`, color: `rgba(${A},1)`, border: `1px solid rgba(${A},0.4)` }}>
                                          ✦ lúcido
                                        </span>
                                      )}
                                    </div>
                                    <p className={`text-[11px] text-white/50 leading-relaxed mt-0.5 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                      {dream.body}
                                    </p>
                                  </div>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                                    className={`shrink-0 mt-1 text-white/22 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                    <path d="M6 9l6 6 6-6"/>
                                  </svg>
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="px-3 pb-3 flex flex-col gap-2.5 animate-fade-in">
                                  {(dream.tags.length > 0 || dream.emotions.length > 0) && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {dream.emotions.slice(0, 3).map(e => (
                                        <span key={e} className="text-[10px] px-2 py-0.5 rounded-full text-white/45 bg-white/8">{e}</span>
                                      ))}
                                      {dream.tags.slice(0, 4).map(t => (
                                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full"
                                          style={{ background: `rgba(${A},0.15)`, border: `1px solid rgba(${A},0.25)`, color: `rgba(${A},1)` }}>
                                          #{t}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {dream.summary && (
                                    <div className="px-3 py-2 rounded-lg"
                                      style={{ background: `rgba(${A},0.08)`, border: `1px solid rgba(${A},0.15)` }}>
                                      <p className="text-[10px] font-bold mb-1" style={{ color: `rgba(${A},0.7)` }}>✦ ANÁLISIS IA</p>
                                      <p className="text-[11px] text-white/55 italic leading-relaxed">{dream.summary}</p>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <button onClick={() => onCycleVis(dream)}
                                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all active:scale-95"
                                      style={{ background: 'rgba(255,255,255,0.07)', color: vis.color }}>
                                      <span>{vis.icon}</span><span>{vis.label}</span>
                                    </button>
                                    <button onClick={() => onAnalyze(dream)} disabled={analyzing === dream.id}
                                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-white/50 transition-all active:scale-95 disabled:opacity-40"
                                      style={{ background: 'rgba(255,255,255,0.07)' }}>
                                      {analyzing === dream.id
                                        ? <div className="w-2.5 h-2.5 border border-white/40 border-t-white rounded-full animate-spin" />
                                        : <span>✦</span>}
                                      <span>IA</span>
                                    </button>
                                    <button onClick={() => onShare(dream)}
                                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-white/50 transition-all active:scale-95"
                                      style={{ background: 'rgba(255,255,255,0.07)' }}>
                                      <span>⬆</span><span>Compartir</span>
                                    </button>
                                    <button onClick={() => onEdit(dream)}
                                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-white/50 transition-all active:scale-95"
                                      style={{ background: 'rgba(255,255,255,0.07)' }}>
                                      <span>✎</span><span>Editar</span>
                                    </button>
                                    <button onClick={() => { if (confirm('¿Borrar este sueño?')) onDelete(dream.id) }}
                                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-red-400/50 hover:text-red-400 transition-all active:scale-95"
                                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                                      <span>✕</span><span>Borrar</span>
                                    </button>
                                  </div>

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
          })}

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t"
            style={{ borderColor: `rgba(${A},0.15)`, background: 'rgba(0,0,0,0.28)' }}>
            <span className="text-[10px] text-white/25 italic">Bitácora del Sueño</span>
            <span className="text-[10px] text-white/25">
              {weekOffset === 0 ? 'Semana actual' : `${Math.abs(weekOffset)} sem. atrás`}
            </span>
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] text-white/15 mt-2">← desliza para cambiar de semana →</p>

      <style>{`
        .nb-out-left {
          animation: nbOutLeft 0.28s cubic-bezier(0.4,0,1,1) forwards;
          transform-origin: left center;
        }
        .nb-out-right {
          animation: nbOutRight 0.28s cubic-bezier(0.4,0,1,1) forwards;
          transform-origin: right center;
        }
        .nb-in-left {
          animation: nbInLeft 0.32s cubic-bezier(0,0,0.2,1) forwards;
          transform-origin: right center;
        }
        .nb-in-right {
          animation: nbInRight 0.32s cubic-bezier(0,0,0.2,1) forwards;
          transform-origin: left center;
        }
        @keyframes nbOutLeft {
          0%   { transform: perspective(900px) rotateY(0deg) scaleX(1);    opacity: 1; }
          100% { transform: perspective(900px) rotateY(-30deg) scaleX(0.86); opacity: 0; }
        }
        @keyframes nbOutRight {
          0%   { transform: perspective(900px) rotateY(0deg) scaleX(1);   opacity: 1; }
          100% { transform: perspective(900px) rotateY(30deg) scaleX(0.86); opacity: 0; }
        }
        @keyframes nbInLeft {
          0%   { transform: perspective(900px) rotateY(24deg) scaleX(0.88); opacity: 0; }
          100% { transform: perspective(900px) rotateY(0deg) scaleX(1);    opacity: 1; }
        }
        @keyframes nbInRight {
          0%   { transform: perspective(900px) rotateY(-24deg) scaleX(0.88); opacity: 0; }
          100% { transform: perspective(900px) rotateY(0deg) scaleX(1);     opacity: 1; }
        }
      `}</style>
    </div>
  )
}
