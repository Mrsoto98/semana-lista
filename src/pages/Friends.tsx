import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import type { FollowUser } from '../types'

interface SearchUser {
  id: string
  name: string
  avatar_url: string | null
  avatar_emoji: string | null
  bio: string | null
  username: string | null
}

type TabId = 'seguidores' | 'seguidos'

function Avatar({ name, url, emoji, size = 10 }: { name: string; url?: string | null; emoji?: string | null; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full shrink-0 object-cover`
  if (url) return <img src={url} className={cls} alt="" />
  return (
    <div className={`${cls} flex items-center justify-center text-sm font-bold text-white`}
      style={{ background: 'linear-gradient(135deg, rgba(var(--glow-color),0.7), rgba(var(--glass-tint),0.8))' }}>
      {emoji ?? name?.[0]?.toUpperCase()}
    </div>
  )
}

export default function FollowsPage() {
  const qc        = useQueryClient()
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const [tab, setTab]             = useState<TabId>('seguidores')
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState('')
  const [copiedUser, setCopiedUser] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // My following IDs set — used to show correct button state everywhere
  const { data: myFollowingIds = new Set<string>() } = useQuery({
    queryKey: ['my-following-ids', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('follows').select('following_id').eq('follower_id', user!.id)
      return new Set((data ?? []).map((r: any) => r.following_id as string))
    },
    enabled: !!user,
    refetchInterval: 30_000,
  })

  const { data: followers = [], isLoading: loadingFollowers } = useQuery({
    queryKey: ['followers', user?.id],
    queryFn: async (): Promise<FollowUser[]> => {
      const { data: rows } = await supabase.from('follows').select('follower_id').eq('following_id', user!.id)
      if (!rows?.length) return []
      const { data: profs } = await supabase.from('profiles')
        .select('id, name, avatar_url, avatar_emoji, bio, username, followers_count')
        .in('id', rows.map((r: any) => r.follower_id))
      return (profs ?? []) as FollowUser[]
    },
    enabled: !!user && tab === 'seguidores',
    refetchInterval: 30_000,
  })

  const { data: following = [], isLoading: loadingFollowing } = useQuery({
    queryKey: ['following', user?.id],
    queryFn: async (): Promise<FollowUser[]> => {
      const { data: rows } = await supabase.from('follows').select('following_id').eq('follower_id', user!.id)
      if (!rows?.length) return []
      const { data: profs } = await supabase.from('profiles')
        .select('id, name, avatar_url, avatar_emoji, bio, username, followers_count')
        .in('id', rows.map((r: any) => r.following_id))
      return (profs ?? []) as FollowUser[]
    },
    enabled: !!user && tab === 'seguidos',
    refetchInterval: 30_000,
  })

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['my-following-ids', user?.id] })
    qc.invalidateQueries({ queryKey: ['followers', user?.id] })
    qc.invalidateQueries({ queryKey: ['following', user?.id] })
    qc.invalidateQueries({ queryKey: ['my-follow-stats', user?.id] })
  }

  const followMutation = useMutation({
    mutationFn: async ({ targetId, isFollowing }: { targetId: string; isFollowing: boolean }) => {
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', user!.id).eq('following_id', targetId)
      } else {
        await supabase.from('follows').insert({ follower_id: user!.id, following_id: targetId })
      }
    },
    onSuccess: () => { inv(); setResults(r => r.map(u => u)) },
  })

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault()
    const q = query.trim()
    if (!q || q.length < 2) { setSearchErr('Escribe al menos 2 caracteres'); return }
    setSearchErr('')
    setSearching(true)
    try {
      let rows: SearchUser[] = []
      const cleanQ = q.startsWith('@') ? q.slice(1) : q
      if (q.startsWith('@') || /^[a-z0-9_]+$/.test(cleanQ)) {
        const { data } = await supabase.from('profiles')
          .select('id, name, avatar_url, avatar_emoji, bio, username')
          .ilike('username', `${cleanQ}%`).neq('id', user!.id).limit(10)
        rows = (data ?? []) as SearchUser[]
      }
      if (!rows.length) {
        const { data } = await supabase.from('profiles')
          .select('id, name, avatar_url, avatar_emoji, bio, username')
          .ilike('name', `%${cleanQ}%`).neq('id', user!.id).limit(10)
        rows = (data ?? []) as SearchUser[]
      }
      setResults(rows)
      if (!rows.length) setSearchErr('No se encontró ningún soñador.')
    } catch {
      setSearchErr('Error al buscar. Inténtalo de nuevo.')
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => { if (!query) { setResults([]); setSearchErr('') } }, [query])

  function copyUsername() {
    if (!user?.username) return
    navigator.clipboard.writeText(`@${user.username}`)
    setCopiedUser(true)
    setTimeout(() => setCopiedUser(false), 2000)
  }

  const list = tab === 'seguidores' ? followers : following
  const isLoading = tab === 'seguidores' ? loadingFollowers : loadingFollowing

  return (
    <div className="min-h-svh pb-28">
      {/* Header */}
      <div
        className="sticky top-0 z-20 flex items-center gap-3 px-4 pt-12 pb-3"
        style={{ background: 'rgb(var(--bg-deep))', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button onClick={() => navigate(-1)} className="text-white/40 hover:text-white/70 transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-lg font-bold text-white flex-1">
          {tab === 'seguidores' ? `Seguidores · ${followers.length}` : `Siguiendo · ${following.length}`}
        </h1>
      </div>

      <div className="px-4 py-4 flex flex-col gap-5">

        {/* Tu usuario */}
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
          <Avatar name={user?.name ?? '?'} url={user?.avatar_url} size={10} />
          <div className="flex-1 min-w-0">
            <p className="text-white/60 text-xs font-medium mb-0.5">{user?.name}</p>
            <p className="text-[10px] text-white/30 mb-1.5">Tu nombre de usuario</p>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xl tracking-tight accent-text">
                {user?.username ? `@${user.username}` : '—'}
              </span>
              <button
                onClick={copyUsername}
                disabled={!user?.username}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border disabled:opacity-40 ${
                  copiedUser
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-white/10 bg-white/5 text-white/35 hover:text-white hover:bg-white/10'
                }`}
              >
                {copiedUser
                  ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copiado</>
                  : <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar</>
                }
              </button>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2">
          {(['seguidores', 'seguidos'] as TabId[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: tab === t ? 'rgba(var(--glow), 0.20)' : 'rgba(255,255,255,0.05)',
                color: tab === t ? `hsl(var(--accent-h), var(--accent-s), 80%)` : 'rgba(255,255,255,0.40)',
                border: `1px solid ${tab === t ? 'rgba(var(--glow), 0.28)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {t === 'seguidores' ? 'Seguidores' : 'Siguiendo'}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex flex-col gap-2">
          {isLoading ? (
            <div className="glass-card rounded-2xl h-16 shimmer" />
          ) : list.length === 0 ? (
            <div className="text-center py-10 glass-card rounded-2xl">
              <div className="text-4xl mb-3">🌙</div>
              <p className="text-white/40 text-sm font-medium">
                {tab === 'seguidores' ? 'Nadie te sigue aún' : 'No sigues a nadie aún'}
              </p>
              <p className="text-white/20 text-xs mt-1">Busca soñadores abajo</p>
            </div>
          ) : (
            list.map(u => {
              const amIFollowing = myFollowingIds.has(u.id)
              const isMutating = followMutation.isPending && followMutation.variables?.targetId === u.id
              return (
                <div key={u.id} className="glass-card rounded-2xl p-3.5 flex items-center gap-3">
                  <button onClick={() => navigate(`/perfil/${u.id}`)} className="shrink-0">
                    <Avatar name={u.name} url={u.avatar_url} emoji={u.avatar_emoji} size={10} />
                  </button>
                  <button onClick={() => navigate(`/perfil/${u.id}`)} className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-white">{u.name}</p>
                    {u.username && (
                      <p className="text-[10px] accent-text">@{u.username}</p>
                    )}
                    {u.bio && <p className="text-[11px] text-white/35 truncate">{u.bio}</p>}
                  </button>
                  <button
                    onClick={() => followMutation.mutate({ targetId: u.id, isFollowing: amIFollowing })}
                    disabled={isMutating}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all active:scale-95 disabled:opacity-40 ${
                      amIFollowing
                        ? 'text-white/50 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                        : 'glass-btn-primary text-white'
                    }`}
                  >
                    {isMutating
                      ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                      : amIFollowing ? 'Siguiendo' : 'Seguir'
                    }
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Buscador */}
        <div className="glass-card rounded-2xl p-4 flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white/70">Buscar soñadores</h3>
            <p className="text-[11px] text-white/30 mt-0.5">Por nombre o @usuario</p>
          </div>
          <form onSubmit={doSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="@usuario o nombre…"
                className="glass-input w-full rounded-xl px-3 py-2.5 text-sm pr-8"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
            <button type="submit" disabled={searching || !query.trim()}
              className="glass-btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all active:scale-95">
              {searching
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              }
            </button>
          </form>

          {searchErr && <p className="text-xs text-white/35 italic">{searchErr}</p>}

          {results.length > 0 && (
            <div className="flex flex-col gap-2 mt-1">
              {results.map(u => {
                const amIFollowing = myFollowingIds.has(u.id)
                const isMutating = followMutation.isPending && followMutation.variables?.targetId === u.id
                return (
                  <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/4 border border-white/6">
                    <button onClick={() => navigate(`/perfil/${u.id}`)} className="shrink-0">
                      <Avatar name={u.name} url={u.avatar_url} emoji={u.avatar_emoji} size={9} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-tight">{u.name}</p>
                      {u.username && (
                        <p className="text-[11px] accent-text">@{u.username}</p>
                      )}
                      {u.bio && <p className="text-[10px] text-white/25 truncate mt-0.5">{u.bio}</p>}
                    </div>
                    <button
                      onClick={() => followMutation.mutate({ targetId: u.id, isFollowing: amIFollowing })}
                      disabled={isMutating}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all active:scale-95 disabled:opacity-40 ${
                        amIFollowing
                          ? 'text-white/50 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                          : 'glass-btn-primary text-white'
                      }`}
                    >
                      {isMutating
                        ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                        : amIFollowing ? 'Siguiendo' : 'Seguir'
                      }
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
