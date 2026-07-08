import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { feedApi, likesApi } from '../lib/queries'
import { CommentSection } from '../components/dreams/CommentSection'
import { useAuthStore } from '../lib/store'
import type { FeedDream, Visibility } from '../types'

type Tab  = 'friends' | 'public'
type Sort = 'recent' | 'popular'

const VIS_BADGE: Record<Visibility, { icon: string; color: string }> = {
  private: { icon: '🔒', color: 'text-white/30' },
  friends: { icon: '👥', color: 'text-blue-400/60' },
  public:  { icon: '🌐', color: 'text-emerald-400/60' },
}

// ── Like button ───────────────────────────────────────────────
function LikeButton({ dream, queryKey }: { dream: FeedDream; queryKey: unknown[] }) {
  const qc = useQueryClient()
  const [pending, setPending] = useState(false)
  // local optimistic state that overrides server state while pending
  const [localLiked, setLocalLiked] = useState<boolean | null>(null)
  const [localCount, setLocalCount] = useState<number | null>(null)

  const liked = localLiked  ?? dream.user_liked
  const count = localCount  ?? dream.like_count

  const mutation = useMutation({
    mutationFn: () => liked ? likesApi.unlike(dream.id) : likesApi.like(dream.id),
    onMutate: () => {
      setPending(true)
      setLocalLiked(!liked)
      setLocalCount(count + (liked ? -1 : 1))
    },
    onSuccess: (res) => {
      const d = res.data as { like_count: number; user_liked: boolean }
      setLocalLiked(d.user_liked)
      setLocalCount(d.like_count)
      // sync server state
      qc.invalidateQueries({ queryKey })
    },
    onError: () => {
      // revert
      setLocalLiked(null)
      setLocalCount(null)
    },
    onSettled: () => setPending(false),
  })

  return (
    <button
      onClick={() => { if (!pending) mutation.mutate() }}
      className={`flex items-center gap-1.5 text-sm transition-all active:scale-90 select-none ${
        liked ? 'text-pink-400' : 'text-white/30 hover:text-white/55'
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={`transition-transform ${liked ? 'scale-110' : 'scale-100'}`}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      <span className="text-xs">{count > 0 ? count : ''}</span>
    </button>
  )
}

// ── Chevron icon ──────────────────────────────────────────────
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

// ── Main Feed ─────────────────────────────────────────────────
export default function Feed() {
  const [tab,  setTab]    = useState<Tab>('friends')
  const [sort, setSort]   = useState<Sort>('recent')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const feedQueryKey = ['feed', tab, sort]

  const { data: dreams = [], isLoading } = useQuery({
    queryKey: feedQueryKey,
    queryFn: () =>
      tab === 'friends'
        ? feedApi.friends({ limit: 30, sort }).then(r => r.data)
        : feedApi.public({ limit: 30, sort }).then(r => r.data),
  })

  function toggleExpand(id: string) {
    setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div className="animate-fade-in">

      {/* Tabs */}
      <div className="flex gap-2 mb-4 p-1 glass rounded-2xl">
        {(['friends', 'public'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === t ? 'glass-nav-active text-white' : 'text-white/40 hover:text-white/60'
            }`}>
            {t === 'friends' ? '👥 Amigos' : '🌐 Social'}
          </button>
        ))}
      </div>

      {/* Sort toggle */}
      <div className="flex gap-2 mb-5">
        {(['recent', 'popular'] as Sort[]).map(s => (
          <button key={s} onClick={() => setSort(s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
              sort === s
                ? 'border-white/20 bg-white/8 text-white'
                : 'border-white/8 text-white/30 hover:text-white/50'
            }`}>
            {s === 'recent'
              ? <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Recientes</>
              : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Populares</>
            }
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => <div key={i} className="glass-card rounded-2xl h-40 shimmer" />)}
        </div>
      ) : dreams.length === 0 ? (
        <div className="text-center py-16 animate-scale-in">
          <div className="text-6xl mb-4 animate-float inline-block">
            {tab === 'friends' ? '👥' : '🌐'}
          </div>
          <p className="text-white/50 font-medium">
            {tab === 'friends' ? 'Aún no hay sueños de tus amigos' : 'No hay sueños públicos todavía'}
          </p>
          <p className="text-white/25 text-sm mt-1">
            {tab === 'friends' ? 'Agrega amigos para ver sus sueños aquí.' : 'Sé el primero en compartir el tuyo.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {(dreams as FeedDream[]).map((dream, i) => {
            const vis = VIS_BADGE[dream.visibility]
            const isExpanded = expanded.has(dream.id)
            return (
              <div key={dream.id} style={{ animationDelay: `${i * 35}ms` }}
                className="animate-fade-in glass-card rounded-2xl p-4">

                {/* Author row */}
                <div className="flex items-center gap-3 mb-3">
                  <button onClick={() => navigate(`/profile/${dream.author_id}`)} className="shrink-0">
                    {dream.author_avatar ? (
                      <img src={dream.author_avatar} className="w-9 h-9 rounded-full object-cover ring-1 ring-white/15" alt="" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ring-1 ring-white/15"
                        style={{ background: 'linear-gradient(135deg, rgba(var(--glow-color),0.7), rgba(var(--glass-tint),0.8))' }}>
                        {dream.author_name?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <button onClick={() => navigate(`/profile/${dream.author_id}`)}
                      className="text-sm font-semibold text-white/80 hover:text-white transition-colors">
                      {dream.author_id === user?.id ? 'Tú' : dream.author_name}
                    </button>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-white/30">
                        {new Date(dream.dream_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className={`text-[11px] ${vis.color}`}>{vis.icon}</span>
                      {dream.is_lucid && (
                        <span className="text-[10px] glass-pill px-1.5 py-0.5 rounded-full accent-text">✦ Lúcido</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Title + body always visible */}
                {dream.title && (
                  <h3 className="font-semibold text-white text-sm mb-1.5">{dream.title}</h3>
                )}
                <p className="text-white/55 text-sm leading-relaxed line-clamp-3">{dream.body}</p>

                {/* Always-visible action bar */}
                <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-white/6">
                  <LikeButton dream={dream} queryKey={feedQueryKey} />

                  {/* Comment count */}
                  <span className="flex items-center gap-1.5 text-xs text-white/30">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {dream.comment_count > 0 ? dream.comment_count : ''}
                  </span>

                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(dream.id)}
                    className={`ml-auto flex items-center gap-1.5 text-xs font-medium transition-all px-2.5 py-1 rounded-lg ${
                      isExpanded
                        ? 'text-white/60 bg-white/8'
                        : 'text-white/30 hover:text-white/55 hover:bg-white/5'
                    }`}
                  >
                    {isExpanded ? 'Esconder' : 'Ver más'}
                    <Chevron open={isExpanded} />
                  </button>
                </div>

                {/* Expandable: AI summary + tags + comments */}
                {isExpanded && (
                  <div className="mt-3 flex flex-col gap-3 animate-fade-in">
                    {dream.summary && (
                      <div className="px-3 py-2 rounded-xl border border-white/8 bg-white/3">
                        <p className="text-[10px] text-white/35 mb-1 uppercase tracking-wider font-medium">✦ Análisis IA</p>
                        <p className="text-xs text-white/55 italic leading-relaxed">{dream.summary}</p>
                      </div>
                    )}

                    {(dream.emotions.length > 0 || dream.tags.length > 0) && (
                      <div className="flex flex-wrap gap-1.5">
                        {dream.emotions.slice(0,3).map(e => (
                          <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/50">{e}</span>
                        ))}
                        {dream.tags.slice(0,3).map(t => (
                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full glass-pill accent-text">#{t}</span>
                        ))}
                      </div>
                    )}

                    <CommentSection
                      dreamId={dream.id}
                      allowComments={dream.allow_comments ?? true}
                      forceOpen
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
