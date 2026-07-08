import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatUserNumber } from '../lib/formatUserNumber'
import { friendsApi } from '../lib/queries'
import { useAuthStore } from '../lib/store'
import type { Dream, Visibility } from '../types'

interface PublicProfile {
  id: string; name: string; avatar_url: string | null; bio: string | null
  user_number: number | null; friend_count: number; dream_count: number
  instagram_username: string | null
}
interface ProfileResponse {
  profile: PublicProfile
  dreams: Dream[]
  relationship: 'self' | 'friend' | 'stranger'
}

const VIS_LABEL: Record<Visibility, { icon: string; label: string }> = {
  private: { icon: '🔒', label: 'Privado' },
  friends: { icon: '👥', label: 'Amigos' },
  public:  { icon: '🌐', label: 'Público' },
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const { user }  = useAuthStore()
  const [lightbox, setLightbox] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['profile', id],
    queryFn: () => api.get<ProfileResponse>(`/user/${id}/profile`).then(r => r.data),
    enabled: !!id,
  })

  const requestMutation = useMutation({
    mutationFn: () => friendsApi.request(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', id] }),
  })

  if (isLoading) return (
    <div className="animate-fade-in flex flex-col gap-4 pt-2">
      <div className="glass-card rounded-3xl h-48 shimmer" />
      {[1,2,3].map(i => <div key={i} className="glass-card rounded-2xl h-28 shimmer" />)}
    </div>
  )

  if (!data) return (
    <div className="text-center py-20 text-white/40">Usuario no encontrado</div>
  )

  const { profile, dreams, relationship } = data
  const isSelf = relationship === 'self' || user?.id === id

  return (
    <div className="animate-fade-in">

      {/* Back button */}
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Volver
      </button>

      {/* Profile card */}
      <div className="glass rounded-3xl p-5 mb-5 relative overflow-hidden">
        <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full opacity-25 pointer-events-none"
          style={{ background: `radial-gradient(circle, rgba(var(--glow-color),0.6) 0%, transparent 70%)`, filter: 'blur(24px)' }} />

        <div className="flex items-start gap-4 relative z-10">
          {/* Avatar with lightbox */}
          <button onClick={() => profile.avatar_url && setLightbox(true)} className="shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url}
                className="w-20 h-20 rounded-full object-cover ring-2 ring-white/15 hover:ring-white/30 transition-all"
                alt={profile.name} />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white ring-2 ring-white/15"
                style={{ background: 'linear-gradient(135deg, rgba(var(--glow-color),0.8), rgba(var(--glass-tint),0.9))' }}>
                {profile.name?.[0]?.toUpperCase()}
              </div>
            )}
          </button>

          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-lg font-bold text-white leading-tight">{profile.name}</h2>
            {profile.user_number && (
              <p className="text-[11px] accent-text mt-0.5">#{formatUserNumber(profile.user_number)}</p>
            )}
            {profile.bio && (
              <p className="text-sm text-white/50 mt-1.5 leading-snug">{profile.bio}</p>
            )}
            {profile.instagram_username && (
              <a
                href={`https://instagram.com/${profile.instagram_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-all group"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-pink-400 group-hover:text-pink-300 transition-colors">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
                </svg>
                <span className="text-[11px] text-pink-400/80 group-hover:text-pink-300 transition-colors font-medium">@{profile.instagram_username}</span>
              </a>
            )}

            {!isSelf && (
              <div className="mt-3">
                {relationship === 'stranger' && (
                  <button onClick={() => requestMutation.mutate()}
                    disabled={requestMutation.isPending || requestMutation.isSuccess}
                    className="glass-btn-primary px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all active:scale-95 disabled:opacity-60">
                    {requestMutation.isSuccess ? '✓ Solicitud enviada' : requestMutation.isPending ? 'Enviando…' : '+ Agregar amigo'}
                  </button>
                )}
                {relationship === 'friend' && (
                  <span className="text-xs text-emerald-400/70 flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Ya sois amigos
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-around mt-5 pt-4 border-t border-white/8">
          <div className="text-center">
            <p className="text-xl font-bold text-white">{profile.dream_count}</p>
            <p className="text-[11px] text-white/35 mt-0.5">sueños</p>
          </div>
          <div className="w-px h-8 bg-white/8" />
          <div className="text-center">
            <p className="text-xl font-bold text-white">{profile.friend_count}</p>
            <p className="text-[11px] text-white/35 mt-0.5">amigos</p>
          </div>
        </div>
      </div>

      {/* Dreams */}
      {dreams.length === 0 ? (
        <div className="text-center py-10 text-white/30 text-sm">
          {relationship === 'stranger' ? 'Este usuario no tiene sueños públicos.' : 'Sin sueños visibles.'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {dreams.map((dream, i) => {
            const vis = VIS_LABEL[dream.visibility]
            return (
              <div key={dream.id} style={{ animationDelay: `${i * 35}ms` }} className="animate-fade-in glass-card rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    {dream.title && <h3 className="font-semibold text-white text-sm">{dream.title}</h3>}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-white/30">
                        {new Date(dream.dream_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                      {dream.is_lucid && <span className="text-[10px] glass-pill px-1.5 py-0.5 rounded-full accent-text">✦ Lúcido</span>}
                    </div>
                  </div>
                  {isSelf && (
                    <span className="text-[10px] text-white/30 shrink-0">{vis.icon} {vis.label}</span>
                  )}
                </div>
                <p className="text-white/55 text-sm leading-relaxed line-clamp-3">{dream.body}</p>
                {dream.summary && (
                  <div className="mt-3 px-3 py-2 rounded-xl border border-white/8 bg-white/3">
                    <p className="text-[10px] text-white/35 mb-1 font-medium uppercase tracking-wider">✦ Análisis</p>
                    <p className="text-xs text-white/55 italic">{dream.summary}</p>
                  </div>
                )}
                {(dream.emotions.length > 0 || dream.tags.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {dream.emotions.slice(0,3).map(e => (
                      <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/50">{e}</span>
                    ))}
                    {dream.tags.slice(0,3).map(t => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full glass-pill accent-text">#{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
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
