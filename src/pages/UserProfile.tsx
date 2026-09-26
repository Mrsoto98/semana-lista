import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { formatUserNumber } from '../lib/formatUserNumber'
import { useAuthStore } from '../lib/store'
import type { Dream } from '../types'

interface PublicProfile {
  id: string; name: string; avatar_url: string | null; avatar_emoji: string | null; bio: string | null
  user_number: number | null; followers_count: number; following_count: number; dream_count: number
  instagram_username: string | null; show_public_stats: boolean
  birth_date: string | null; birth_visibility: 'date' | 'age' | 'none'
  location: string | null; country: string | null
  residence_city: string | null; residence_country: string | null
  location_visibility: 'birth' | 'residence' | 'both' | 'none'
}
interface ProfileResponse {
  profile: PublicProfile
  dreams: Dream[]
  isSelf: boolean
  isFollowing: boolean
}

const GRADIENTS = [
  'linear-gradient(160deg, #0f3460 0%, #533483 100%)',
  'linear-gradient(160deg, #16213e 0%, #3d0f72 100%)',
  'linear-gradient(160deg, #2c3e50 0%, #4a6fa5 100%)',
  'linear-gradient(160deg, #0d0d2b 0%, #164778 100%)',
  'linear-gradient(160deg, #130f40 0%, #1a6b4b 100%)',
  'linear-gradient(160deg, #1a1a2e 0%, #5c1a2e 100%)',
  'linear-gradient(160deg, #1a2a4a 0%, #6b3a5c 100%)',
  'linear-gradient(160deg, #0a1628 0%, #2d5a3d 100%)',
]

function getGradient(id: string) {
  const hash = id.replace(/-/g, '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return GRADIENTS[hash % GRADIENTS.length]
}

type Tab = 'diario' | 'cuadricula' | 'stats'

export default function UserProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const { user }  = useAuthStore()
  const [lightbox, setLightbox] = useState(false)
  const [tab, setTab] = useState<Tab>('cuadricula')

  const { data, isLoading } = useQuery({
    queryKey: ['profile', id],
    queryFn: async (): Promise<ProfileResponse> => {
      const [profileRes, dreamsRes, followRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id!).single(),
        supabase.from('dreams').select('*').eq('user_id', id!).eq('visibility', 'public')
          .order('dream_date', { ascending: false }).limit(30),
        user
          ? supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', id!).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      const p = profileRes.data
      return {
        profile: {
          id: p?.id ?? id!, name: p?.name ?? 'Usuario',
          avatar_url: p?.avatar_url ?? null, avatar_emoji: p?.avatar_emoji ?? null,
          bio: p?.bio ?? null, user_number: p?.user_number ?? null,
          followers_count: p?.followers_count ?? 0,
          following_count: p?.following_count ?? 0,
          dream_count: dreamsRes.data?.length ?? 0,
          instagram_username: p?.instagram_username ?? null,
          show_public_stats: p?.show_public_stats !== false,
          birth_date: p?.birth_date ?? null,
          birth_visibility: p?.birth_visibility ?? 'none',
          location: p?.location ?? null,
          country: p?.country ?? null,
          residence_city: p?.residence_city ?? null,
          residence_country: p?.residence_country ?? null,
          location_visibility: (p?.location_visibility as 'birth' | 'residence' | 'both' | 'none') ?? 'birth',
        },
        dreams: (dreamsRes.data ?? []) as Dream[],
        isSelf: user?.id === id,
        isFollowing: !!(followRes as any).data,
      }
    },
    enabled: !!id,
  })

  const followMutation = useMutation({
    mutationFn: async ({ currentlyFollowing }: { currentlyFollowing: boolean }) => {
      if (currentlyFollowing) {
        await supabase.from('follows').delete().eq('follower_id', user!.id).eq('following_id', id!)
      } else {
        await supabase.from('follows').insert({ follower_id: user!.id, following_id: id! })
      }
    },
    onMutate: async ({ currentlyFollowing }) => {
      await qc.cancelQueries({ queryKey: ['profile', id] })
      const previous = qc.getQueryData(['profile', id])
      qc.setQueryData<ProfileResponse>(['profile', id], (old) => old ? {
        ...old,
        isFollowing: !currentlyFollowing,
        profile: {
          ...old.profile,
          followers_count: old.profile.followers_count + (currentlyFollowing ? -1 : 1),
        },
      } : old)
      return { previous }
    },
    onError: (_, __, ctx: any) => ctx && qc.setQueryData(['profile', id], ctx.previous),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['profile', id] })
      qc.invalidateQueries({ queryKey: ['my-follow-stats', user?.id] })
      qc.invalidateQueries({ queryKey: ['following', user?.id] })
    },
  })

  const messageMutation = useMutation({
    mutationFn: async () => id!,
    onSuccess: (userId) => navigate(`/mensajes/nuevo/${userId}`),
  })

  if (isLoading) return (
    <div className="animate-fade-in">
      <div className="px-4">
        <div className="w-8 h-4 rounded shimmer mb-5" />
        <div className="flex flex-col items-center mb-4">
          <div className="w-24 h-24 rounded-full shimmer mb-3" />
          <div className="h-4 w-32 rounded shimmer mb-1" />
          <div className="h-3 w-20 rounded shimmer" />
        </div>
        <div className="h-16 rounded-2xl shimmer mb-4" />
        <div className="h-10 rounded-xl shimmer mb-4" />
      </div>
      <div className="h-px bg-white/8 mb-px" />
      <div className="grid grid-cols-3 gap-px bg-white/5">
        {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square shimmer" />)}
      </div>
    </div>
  )

  if (!data) return (
    <div className="text-center py-20 text-white/40">Usuario no encontrado</div>
  )

  const { profile, dreams, isSelf, isFollowing } = data

  // Compute stats
  const emotionCounts: Record<string, number> = {}
  const tagCounts: Record<string, number> = {}
  let lucidCount = 0
  const monthCounts: Record<string, number> = {}

  dreams.forEach(d => {
    if (d.is_lucid) lucidCount++
    d.emotions?.forEach((e: string) => { emotionCounts[e] = (emotionCounts[e] ?? 0) + 1 })
    d.tags?.forEach((t: string) => { tagCounts[t] = (tagCounts[t] ?? 0) + 1 })
    const mo = d.dream_date?.slice(0, 7)
    if (mo) monthCounts[mo] = (monthCounts[mo] ?? 0) + 1
  })

  const topEmotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const lucidPct = dreams.length ? Math.round((lucidCount / dreams.length) * 100) : 0

  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    return d.toISOString().slice(0, 7)
  })
  const maxMonth = Math.max(1, ...last6Months.map(m => monthCounts[m] ?? 0))

  return (
    <div className="animate-fade-in">

      {/* ── Top nav bar ── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button onClick={() => navigate(-1)}
          className="flex items-center justify-center rounded-full transition-all active:scale-90 shrink-0"
          style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="text-[15px] font-semibold text-white/90 truncate">{profile.name}</span>
      </div>

      {/* ── Avatar + action buttons ── */}
      <div className="px-4">
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          {/* Avatar */}
          <button onClick={() => profile.avatar_url && setLightbox(true)} style={{ flexShrink: 0 }}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.name}
                style={{ width: 78, height: 78, minWidth: 78, minHeight: 78, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgb(var(--bg-deep))' }} />
            ) : (
              <div style={{
                width: 78, height: 78, minWidth: 78, minHeight: 78, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
                background: getGradient(profile.id), border: '3px solid rgb(var(--bg-deep))',
              }}>
                {profile.avatar_emoji ?? profile.name?.[0]?.toUpperCase()}
              </div>
            )}
          </button>

          {/* Action buttons */}
          {!isSelf && (
            <div className="flex gap-2 pb-1">
              <button
                onClick={() => followMutation.mutate({ currentlyFollowing: isFollowing })}
                disabled={followMutation.isPending}
                className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all active:scale-95 disabled:opacity-60 ${
                  isFollowing
                    ? 'border border-white/15 bg-white/6 text-white/70'
                    : 'glass-btn-primary text-white'
                }`}>
                {followMutation.isPending ? '…' : isFollowing ? 'Siguiendo' : 'Seguir'}
              </button>
              <button
                onClick={() => messageMutation.mutate()}
                disabled={messageMutation.isPending}
                className="flex items-center justify-center rounded-xl text-white/70 transition-all active:scale-95 disabled:opacity-60"
                style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Name / username / bio / extras */}
        <div className="mb-4">
          <h2 className="text-[17px] font-bold text-white leading-tight flex items-center gap-1.5">
            {profile.name}
            {(profile as any).is_verified && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#4FC3F7" aria-label="Verificado">
                <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"/>
                <polyline points="8,12.5 10.5,15 16,9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            )}
          </h2>
          {profile.user_number && (
            <p className="text-[11px] accent-text mt-0.5">#{formatUserNumber(profile.user_number)}</p>
          )}
          {profile.bio && (
            <p className="text-[13px] text-white/55 leading-snug mt-2">{profile.bio}</p>
          )}
          {profile.birth_date && profile.birth_visibility !== 'none' && (
            <p className="text-[11px] text-white/35 mt-1.5">
              🎂 {(() => {
                const age = Math.floor((Date.now() - new Date(profile.birth_date!).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                const date = new Date(profile.birth_date! + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                if (profile.birth_visibility === 'age') return `${age} años`
                if (profile.birth_visibility === 'date') return date
                return `${date} · ${age} años`
              })()}
            </p>
          )}
          {(() => {
            const v = profile.location_visibility
            const birthParts = [profile.location, profile.country].filter(Boolean)
            const resParts   = [profile.residence_city, profile.residence_country].filter(Boolean)
            const showBirth  = (v === 'birth' || v === 'both') && birthParts.length > 0
            const showRes    = (v === 'residence' || v === 'both') && resParts.length > 0
            if (!showBirth && !showRes) return null
            return (
              <div className="flex flex-col gap-0.5 mt-0.5">
                {showBirth && <p className="text-[11px] text-white/30">📍 {birthParts.join(', ')}</p>}
                {showRes   && <p className="text-[11px] text-white/30">🏠 {resParts.join(', ')}</p>}
              </div>
            )
          })()}
          {profile.instagram_username && (
            <a href={`https://instagram.com/${profile.instagram_username}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-pink-400">
                <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2"/>
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
              </svg>
              <span className="text-[10px] text-pink-400/80 font-medium">@{profile.instagram_username}</span>
            </a>
          )}
        </div>

        {/* Stats row — Twitter/Instagram style */}
        <div className="flex items-center gap-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-baseline gap-1">
            <span className="text-[15px] font-bold text-white">{profile.dream_count}</span>
            <span className="text-[11px] text-white/35">sueños</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[15px] font-bold text-white">{profile.followers_count}</span>
            <span className="text-[11px] text-white/35">seguidores</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[15px] font-bold text-white">{profile.following_count}</span>
            <span className="text-[11px] text-white/35">siguiendo</span>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex items-center border-t border-white/10">
        {/* Diario tab */}
        <button onClick={() => setTab('diario')}
          className="flex-1 py-3 flex items-center justify-center gap-1.5 transition-all"
          style={{ borderBottom: tab === 'diario' ? '2px solid rgba(var(--glow),0.8)' : '2px solid transparent' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            style={{ color: tab === 'diario' ? `hsl(var(--accent-h),var(--accent-s),75%)` : 'rgba(255,255,255,0.3)' }}>
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          <span className="text-[11px] font-medium"
            style={{ color: tab === 'diario' ? `hsl(var(--accent-h),var(--accent-s),75%)` : 'rgba(255,255,255,0.3)' }}>
            Diario
          </span>
        </button>

        {/* Cuadrícula tab */}
        <button onClick={() => setTab('cuadricula')}
          className="flex-1 py-3 flex items-center justify-center gap-1.5 transition-all"
          style={{ borderBottom: tab === 'cuadricula' ? '2px solid rgba(var(--glow),0.8)' : '2px solid transparent' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: tab === 'cuadricula' ? `hsl(var(--accent-h),var(--accent-s),75%)` : 'rgba(255,255,255,0.3)' }}>
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span className="text-[11px] font-medium"
            style={{ color: tab === 'cuadricula' ? `hsl(var(--accent-h),var(--accent-s),75%)` : 'rgba(255,255,255,0.3)' }}>
            Cuadrícula
          </span>
        </button>

        {/* Dot separator + Stats (only if enabled) */}
        {profile.show_public_stats && (
          <>
            <span className="text-white/15 text-lg leading-none select-none">·</span>
            <button onClick={() => setTab('stats')}
              className="flex-1 py-3 flex items-center justify-center gap-1.5 transition-all"
              style={{ borderBottom: tab === 'stats' ? '2px solid rgba(var(--glow),0.8)' : '2px solid transparent' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                style={{ color: tab === 'stats' ? `hsl(var(--accent-h),var(--accent-s),75%)` : 'rgba(255,255,255,0.3)' }}>
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              <span className="text-[11px] font-medium"
                style={{ color: tab === 'stats' ? `hsl(var(--accent-h),var(--accent-s),75%)` : 'rgba(255,255,255,0.3)' }}>
                Stats
              </span>
            </button>
          </>
        )}
      </div>

      {/* ── Content ── */}
      {dreams.length === 0 && tab !== 'stats' ? (
        <div className="text-center py-16 text-white/30 text-sm mx-4">
          <div className="text-4xl mb-3 opacity-30">✦</div>
          {isSelf ? 'Sin sueños visibles.' : 'Este usuario no tiene sueños públicos.'}
        </div>
      ) : tab === 'cuadricula' ? (
        <div className="grid grid-cols-3 gap-px bg-white/5 mt-px pb-24">
          {dreams.map(dream => (
            <button key={dream.id} onClick={() => navigate(`/sueno/${dream.id}`)}
              className="relative overflow-hidden group"
              style={dream.grid_bg ? {
                aspectRatio: '1 / 1',
                backgroundImage: `url(/grid-bg/${dream.grid_bg}.png)`,
                backgroundSize: 'cover', backgroundPosition: 'center',
              } : { aspectRatio: '1 / 1', background: getGradient(dream.id) }}>
              {dream.grid_bg && <div className="absolute inset-0 bg-black/40" />}
              {dream.is_lucid && (
                <div className="absolute top-2 right-2 z-10 w-4 h-4 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
                  <span className="text-[8px] accent-text">✦</span>
                </div>
              )}
              <div className="absolute inset-0 flex items-end p-2 z-10"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)' }}>
                <p className="text-[9px] text-white/85 leading-tight line-clamp-2 font-medium text-left w-full drop-shadow">
                  {dream.title || dream.body.slice(0, 40)}
                </p>
              </div>
              <div className="absolute inset-0 bg-white/0 group-active:bg-white/10 transition-colors z-20" />
            </button>
          ))}
        </div>

      ) : tab === 'diario' ? (
        <div className="flex flex-col pb-24">
          {dreams.map((dream, i) => {
            const d = new Date(dream.dream_date + 'T00:00:00')
            const day = d.toLocaleDateString('es-ES', { weekday: 'long' })
            const date = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
            const showHeader = i === 0 || dreams[i - 1].dream_date !== dream.dream_date
            return (
              <div key={dream.id}>
                {showHeader && (
                  <div className="px-4 pt-5 pb-2 flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/25 uppercase tracking-widest font-mono">{day}</span>
                      <span className="text-[12px] text-white/40 font-medium">{date}</span>
                    </div>
                    <div className="flex-1 h-px bg-white/6" />
                  </div>
                )}
                <button onClick={() => navigate(`/sueno/${dream.id}`)}
                  className="w-full text-left px-4 py-3 transition-colors active:bg-white/4 group">
                  <div className="flex gap-3 items-start">
                    <div className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                      style={{ background: getGradient(dream.id), minHeight: '36px' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {dream.title ? (
                          <h3 className="text-sm font-semibold text-white/90 leading-snug line-clamp-1">{dream.title}</h3>
                        ) : (
                          <h3 className="text-sm text-white/35 leading-snug italic">Sin título</h3>
                        )}
                        {dream.is_lucid && (
                          <span className="text-[9px] accent-text shrink-0">✦</span>
                        )}
                      </div>
                      <p className="text-[12px] text-white/40 leading-relaxed line-clamp-2">{dream.body}</p>
                      {(dream.emotions?.length > 0 || dream.tags?.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {dream.emotions?.slice(0, 2).map((e: string) => (
                            <span key={e} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 text-white/35">{e}</span>
                          ))}
                          {dream.tags?.slice(0, 2).map((t: string) => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full accent-text" style={{ background: 'rgba(var(--glow-color),0.08)' }}>#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      className="shrink-0 mt-1.5 text-white/12 group-active:text-white/30 transition-colors">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                </button>
              </div>
            )
          })}
        </div>

      ) : (
        /* ── Stats tab ── */
        <div className="px-4 pt-5 pb-24 flex flex-col gap-5">

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: dreams.length, label: 'públicos', icon: '🌙' },
              { value: lucidCount, label: 'lúcidos', icon: '✦' },
              { value: `${lucidPct}%`, label: 'lucidez', icon: '💫' },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center py-3 px-2 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span className="text-base mb-1">{s.icon}</span>
                <span className="text-xl font-bold text-white leading-none">{s.value}</span>
                <span className="text-[10px] text-white/30 mt-1 uppercase tracking-wide">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Monthly bar chart */}
          {dreams.length > 0 && (
            <div className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-4">Últimos 6 meses</p>
              <div className="flex items-end gap-1.5 h-20">
                {last6Months.map(m => {
                  const count = monthCounts[m] ?? 0
                  const pct = count / maxMonth
                  const label = new Date(m + '-01').toLocaleDateString('es-ES', { month: 'short' })
                  return (
                    <div key={m} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-white/30">{count || ''}</span>
                      <div className="w-full rounded-t-md transition-all"
                        style={{
                          height: `${Math.max(count > 0 ? 4 : 0, pct * 52)}px`,
                          background: count > 0
                            ? `linear-gradient(to top, rgba(var(--glow-color),0.6), rgba(var(--glow-color),0.2))`
                            : 'rgba(255,255,255,0.05)',
                        }} />
                      <span className="text-[9px] text-white/25">{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top emotions */}
          {topEmotions.length > 0 && (
            <div className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Emociones frecuentes</p>
              <div className="flex flex-col gap-2">
                {topEmotions.map(([emotion, count]) => (
                  <div key={emotion} className="flex items-center gap-3">
                    <span className="text-[12px] text-white/60 w-28 truncate">{emotion}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${(count / topEmotions[0][1]) * 100}%`,
                          background: `linear-gradient(90deg, rgba(var(--glow-color),0.7), rgba(var(--glow-color),0.3))`,
                        }} />
                    </div>
                    <span className="text-[11px] text-white/30 w-4 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top tags */}
          {topTags.length > 0 && (
            <div className="rounded-2xl p-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Etiquetas más usadas</p>
              <div className="flex flex-wrap gap-2">
                {topTags.map(([tag, count]) => (
                  <div key={tag} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                    style={{ background: 'rgba(var(--glow-color),0.1)', border: '1px solid rgba(var(--glow-color),0.15)' }}>
                    <span className="text-[11px] accent-text font-medium">#{tag}</span>
                    <span className="text-[10px] text-white/30">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dreams.length === 0 && (
            <div className="text-center py-10 text-white/30 text-sm">Sin datos aún.</div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && profile.avatar_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightbox(false)}>
          <img src={profile.avatar_url}
            className="max-w-[88vw] max-h-[88vh] rounded-3xl shadow-2xl object-contain animate-scale-in"
            alt={profile.name} />
        </div>
      )}
    </div>
  )
}
