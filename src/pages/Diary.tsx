import { useState, lazy, Suspense, useMemo } from 'react'
const StatsContent = lazy(() => import('./Stats'))
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { dreamsApi, friendsApi } from '../lib/queries'
import { useAuthStore } from '../lib/store'
import { DreamForm } from '../components/dreams/DreamForm'
import { Modal } from '../components/ui/Modal'
import { AnuncioRewarded } from '../components/AnuncioRewarded'
import { ShareModal } from '../components/dreams/ShareModal'
import { DreamNotebook } from '../components/dreams/DreamNotebook'
import type { Dream, Visibility } from '../types'

const VIS_CYCLE: Visibility[] = ['private', 'friends', 'public']

// ── Streak badge ──────────────────────────────────────────────
function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return null
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, rgba(251,146,60,0.2) 0%, rgba(239,68,68,0.12) 100%)',
        border: '1px solid rgba(251,146,60,0.3)',
        boxShadow: '0 0 16px rgba(251,146,60,0.2)',
      }}
    >
      <span className="text-base leading-none" style={{ filter: 'drop-shadow(0 0 6px rgba(251,146,60,0.7))' }}>🔥</span>
      <div>
        <p className="text-sm font-bold text-orange-300 leading-none">{streak}</p>
        <p className="text-[9px] text-orange-300/50 leading-none">día{streak !== 1 ? 's' : ''}</p>
      </div>
    </div>
  )
}

export default function Diary() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Dream | null>(null)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [adDreamId, setAdDreamId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [shareTarget, setShareTarget] = useState<Dream | null>(null)

  const { data: dreams = [], isLoading } = useQuery({
    queryKey: ['dreams'],
    queryFn: () => dreamsApi.list({ limit: 100 }).then(r => r.data),
  })

  // Calculate streak from loaded dreams
  const streak = useMemo(() => {
    if (!dreams.length) return 0
    const dates = [...new Set(dreams.map(d => d.dream_date))].sort().reverse()
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    if (dates[0] !== today && dates[0] !== yesterday) return 0
    let count = 0
    let prev = new Date(dates[0])
    for (const d of dates) {
      const curr = new Date(d)
      const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000)
      if (diff > 1) break
      count++
      prev = curr
    }
    return count
  }, [dreams])

  const deleteMutation = useMutation({
    mutationFn: dreamsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dreams'] }),
  })

  const analyzeMutation = useMutation({
    mutationFn: (id: string) => dreamsApi.analyze(id).then(r => r.data),
    onMutate: (id) => setAnalyzing(id),
    onSettled: () => { setAnalyzing(null); qc.invalidateQueries({ queryKey: ['dreams'] }) },
  })

  const updateVisMutation = useMutation({
    mutationFn: ({ id, visibility }: { id: string; visibility: Visibility }) =>
      dreamsApi.update(id, { visibility }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dreams'] }),
  })

  function cycleVisibility(dream: Dream) {
    const idx = VIS_CYCLE.indexOf(dream.visibility)
    const next = VIS_CYCLE[(idx + 1) % VIS_CYCLE.length]
    updateVisMutation.mutate({ id: dream.id, visibility: next })
  }

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.list().then(r => r.data),
  })
  const friendCount = friends.filter(f => f.status === 'accepted').length
  const lucidCount  = dreams.filter(d => d.is_lucid).length

  return (
    <div className="animate-fade-in">

      {/* ── Profile header ── */}
      <div className="glass rounded-3xl p-5 mb-5 relative overflow-hidden">
        <div
          className="absolute -top-8 -left-8 w-40 h-40 rounded-full opacity-30 pointer-events-none"
          style={{ background: `radial-gradient(circle, rgba(var(--glow-color),0.6) 0%, transparent 70%)`, filter: 'blur(24px)' }}
        />

        <div className="flex items-start gap-4 relative z-10">
          {/* Avatar */}
          <button onClick={() => user?.avatar_url && setLightbox(true)} className="shrink-0">
            {user?.avatar_url ? (
              <img src={user.avatar_url}
                className="w-20 h-20 rounded-full object-cover ring-2 ring-white/15 hover:ring-white/30 transition-all"
                alt={user.name} />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-white ring-2 ring-white/15 text-3xl"
                style={{ background: 'linear-gradient(135deg, rgba(var(--glow-color),0.8), rgba(var(--glass-tint),0.9))' }}>
                {user?.avatar_emoji ?? user?.name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </button>

          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-lg font-bold text-white leading-tight truncate">{user?.name}</h2>
            {user?.bio && (
              <p className="text-sm text-white/50 mt-1 leading-snug line-clamp-2">{user.bio}</p>
            )}
            {user?.birth_date && user?.birth_visibility !== 'none' && (
              <p className="text-xs text-white/35 mt-1">
                {'🎂 '}{user.birth_visibility === 'age'
                  ? `${Math.floor((Date.now() - new Date(user.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} años`
                  : new Date(user.birth_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                }
              </p>
            )}
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={() => navigate('/settings')}
                className="px-3 py-1 glass-btn-secondary rounded-full text-[11px] text-white/60 font-medium"
              >
                Editar perfil
              </button>
              <StreakBadge streak={streak} />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-around mt-5 pt-4 border-t border-white/8">
          <div className="text-center">
            <p className="text-xl font-bold text-white">{dreams.length}</p>
            <p className="text-[11px] text-white/35 mt-0.5">sueños</p>
          </div>
          <div className="w-px h-8 bg-white/8" />
          <div className="text-center">
            <p className="text-xl font-bold text-white">{lucidCount}</p>
            <p className="text-[11px] text-white/35 mt-0.5">lúcidos</p>
          </div>
          <div className="w-px h-8 bg-white/8" />
          <div className="text-center">
            <p className="text-xl font-bold text-white">{friendCount}</p>
            <p className="text-[11px] text-white/35 mt-0.5">amigos</p>
          </div>
        </div>
      </div>

      {/* ── Statistics collapsible ── */}
      <button
        onClick={() => setShowStats(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 glass-card rounded-2xl mb-3 transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="text-sm font-medium text-white/70">Mis estadísticas</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className={`text-white/30 transition-transform duration-300 ${showStats ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {showStats && (
        <div className="mb-4 animate-fade-in">
          <Suspense fallback={<div className="glass-card rounded-2xl h-32 shimmer" />}>
            <StatsContent />
          </Suspense>
        </div>
      )}

      {/* ── New dream button ── */}
      <button
        onClick={() => { setEditing(null); setFormOpen(true) }}
        className="glass-btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold text-white mb-5 transition-all active:scale-[0.98]"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Registrar sueño
      </button>

      {/* ── Dreams notebook ── */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3].map(i => <div key={i} className="glass-card rounded-2xl h-20 shimmer" />)}
        </div>
      ) : dreams.length === 0 ? (
        <div className="text-center py-14 animate-scale-in">
          <div className="text-6xl mb-4 animate-float inline-block">🌙</div>
          <p className="text-white/50 font-medium">Sin sueños registrados aún</p>
          <p className="text-white/25 text-sm mt-1">Los sueños se olvidan en minutos — anótalos ahora.</p>
        </div>
      ) : (
        <DreamNotebook
          dreams={dreams}
          onEdit={d => { setEditing(d); setFormOpen(true) }}
          onDelete={id => deleteMutation.mutate(id)}
          onShare={d => setShareTarget(d)}
          onAnalyze={d => d.summary ? analyzeMutation.mutate(d.id) : setAdDreamId(d.id)}
          onCycleVis={cycleVisibility}
          analyzing={analyzing}
        />
      )}

      {dreams.some(d => d.summary) && (
        <p className="text-[10px] text-white/20 text-center mt-6 leading-relaxed">
          ✦ Los análisis son reflexivos, no diagnósticos psicológicos.
        </p>
      )}

      {/* Lightbox */}
      {lightbox && user?.avatar_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightbox(false)}>
          <img src={user.avatar_url}
            className="max-w-[88vw] max-h-[88vh] rounded-3xl shadow-2xl object-contain animate-scale-in"
            alt={user.name} />
        </div>
      )}

      <Modal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null) }}
        title={editing ? 'Editar sueño' : 'Nuevo sueño'} className="max-w-2xl">
        <DreamForm dream={editing ?? undefined} onClose={() => { setFormOpen(false); setEditing(null) }} />
      </Modal>

      {adDreamId && (
        <AnuncioRewarded
          onRewarded={() => analyzeMutation.mutate(adDreamId)}
          onClose={() => setAdDreamId(null)}
        />
      )}

      {shareTarget && (
        <ShareModal
          dream={shareTarget}
          authorName={user?.name ?? 'Soñador'}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  )
}
