import { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useUnreadCounts } from '../hooks/useUnreadCounts'
import { motion, AnimatePresence } from 'framer-motion'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, startOfMonth, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { pageVariants, pageTransition, listContainerVariants, listItemVariants } from '../lib/motion'
import type { FeedDream } from '../types'

type Tab = 'recientes' | 'populares' | 'seguidos'
const PAGE_SIZE = 15

// like_count / comment_count are denormalized columns on dreams maintained by DB triggers.
// dream_likes(user_id) is only used to check if the current user has liked — RLS limits
// that join to the current user's row, so it works correctly for user_liked but NOT for totals.
const DREAM_SELECT = `
  id, title, body, dream_date, is_lucid, emotions, tags, visibility,
  like_count, comment_count,
  created_at, updated_at,
  profiles!dreams_user_id_fkey(id, name, avatar_url, avatar_emoji),
  dream_likes(user_id)
`

function mapDream(d: any, userId?: string): FeedDream {
  return {
    ...d,
    author_id: d.profiles?.id ?? '',
    author_name: d.profiles?.name ?? 'Anónimo',
    author_avatar: d.profiles?.avatar_url ?? null,
    author_avatar_emoji: d.profiles?.avatar_emoji ?? null,
    like_count: d.like_count ?? 0,
    user_liked: userId ? (d.dream_likes ?? []).some((l: any) => l.user_id === userId) : false,
    comment_count: d.comment_count ?? 0,
    allow_comments: true,
  } as FeedDream
}

async function fetchRecentFeed(offset: number, search: string, userId?: string): Promise<FeedDream[]> {
  let q = supabase
    .from('dreams')
    .select(DREAM_SELECT)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (search) q = q.or(`title.ilike.%${search}%,body.ilike.%${search}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((d: any) => mapDream(d, userId))
}

async function fetchPopularFeed(userId?: string): Promise<FeedDream[]> {
  const { data, error } = await supabase
    .from('dreams')
    .select(DREAM_SELECT)
    .eq('visibility', 'public')
    .gt('like_count', 0)
    .order('like_count', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map((d: any) => mapDream(d, userId))
}

async function fetchFollowingFeed(offset: number, userId: string): Promise<FeedDream[]> {
  const { data: fs } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)

  const followingIds = (fs ?? []).map((f: any) => f.following_id)
  if (followingIds.length === 0) return []

  const { data, error } = await supabase
    .from('dreams')
    .select(DREAM_SELECT)
    .in('user_id', followingIds)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (error) throw error
  return (data ?? []).map((d: any) => mapDream(d, userId))
}

export default function ExplorePage() {
  const navigate = useNavigate()
  const { notifCount } = useUnreadCounts()
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [tab, setTab] = useState<Tab>('recientes')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const recentKey   = ['feed', 'recientes', search, user?.id]
  const popularKey  = ['feed', 'populares', user?.id]
  const seguidosKey = ['feed', 'seguidos', user?.id]

  const recentQ = useInfiniteQuery({
    queryKey: recentKey,
    queryFn: ({ pageParam = 0 }) => fetchRecentFeed(pageParam as number, search, user?.id),
    getNextPageParam: (last, all) =>
      last.length === PAGE_SIZE ? all.flat().length : undefined,
    initialPageParam: 0,
    enabled: tab === 'recientes',
  })

  const popularQ = useQuery({
    queryKey: popularKey,
    queryFn: () => fetchPopularFeed(user?.id),
    enabled: tab === 'populares',
    staleTime: 60_000,
  })

  const seguidosQ = useInfiniteQuery({
    queryKey: seguidosKey,
    queryFn: ({ pageParam = 0 }) =>
      user ? fetchFollowingFeed(pageParam as number, user.id) : Promise.resolve([]),
    getNextPageParam: (last, all) =>
      last.length === PAGE_SIZE ? all.flat().length : undefined,
    initialPageParam: 0,
    enabled: tab === 'seguidos' && !!user,
  })

  function mutateKey() {
    if (tab === 'recientes') return recentKey
    if (tab === 'populares') return popularKey
    return seguidosKey
  }

  const likeMutation = useMutation({
    mutationFn: async ({ id, liked }: { id: string; liked: boolean }) => {
      if (!user) return
      if (liked) {
        await supabase.from('dream_likes').delete().eq('dream_id', id).eq('user_id', user.id)
      } else {
        await supabase.from('dream_likes').insert({ dream_id: id, user_id: user.id })
      }
    },
    onMutate: async ({ id, liked }) => {
      const key = mutateKey()
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)

      const patch = (d: FeedDream) =>
        d.id === id ? { ...d, like_count: d.like_count + (liked ? -1 : 1), user_liked: !liked } : d

      if (tab === 'populares') {
        qc.setQueryData<FeedDream[]>(key, (old) => (old ?? []).map(patch))
      } else {
        qc.setQueryData<typeof recentQ.data>(key, (old) => old && ({
          ...old, pages: old.pages.map(p => p.map(patch)),
        }))
      }
      return { prev, key }
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(ctx.key, ctx.prev),
  })

  const isLoading =
    tab === 'recientes' ? recentQ.isLoading :
    tab === 'populares' ? popularQ.isLoading :
    seguidosQ.isLoading

  const dreams: FeedDream[] =
    tab === 'recientes' ? (recentQ.data?.pages.flat() ?? []) :
    tab === 'populares' ? (popularQ.data ?? []) :
    (seguidosQ.data?.pages.flat() ?? [])

  const isFetchingNextPage =
    tab === 'recientes' ? recentQ.isFetchingNextPage : seguidosQ.isFetchingNextPage
  const hasNextPage =
    tab === 'recientes' ? recentQ.hasNextPage : seguidosQ.hasNextPage
  const fetchNextPage =
    tab === 'recientes' ? recentQ.fetchNextPage : seguidosQ.fetchNextPage

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

  const monthLabel = format(new Date(), "MMMM yyyy", { locale: es })

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="flex flex-col h-svh"
    >
      {/* Header */}
      <header
        className="glass-header sticky top-0 z-30 px-4"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 12 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h1 className="display-title" style={{ fontSize: 32 }}>Explorar</h1>
          <button
            onClick={() => navigate('/notificaciones')}
            className="relative flex items-center justify-center w-10 h-10 rounded-full transition-all active:scale-90"
            style={{
              background: notifCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)',
              border: notifCount > 0 ? '1px solid rgba(239,68,68,0.35)' : '1px solid transparent',
            }}
          >
            {/* Pulse ring when unread */}
            {notifCount > 0 && (
              <span className="absolute inset-0 rounded-full animate-ping"
                style={{ background: 'rgba(239,68,68,0.2)', animationDuration: '1.8s' }} />
            )}
            <svg width="20" height="20" viewBox="0 0 24 24"
              fill={notifCount > 0 ? 'rgba(239,68,68,0.15)' : 'none'}
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: notifCount > 0 ? 'rgb(239,68,68)' : 'rgba(255,255,255,0.55)' }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {notifCount > 0 && (
              <div
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none px-1 shadow-lg"
                style={{ background: 'rgb(239,68,68)', boxShadow: '0 0 8px rgba(239,68,68,0.6)' }}
              >
                {notifCount > 9 ? '9+' : notifCount}
              </div>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-3">
          {([
            { value: 'recientes', label: 'Recientes' },
            { value: 'populares', label: '🔥 Populares' },
            { value: 'seguidos',  label: 'Seguidos' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className="px-3.5 py-1.5 text-xs font-medium rounded-full transition-all duration-200 whitespace-nowrap"
              style={{
                background: tab === value ? 'rgba(var(--glow), 0.22)' : 'rgba(255,255,255,0.05)',
                color: tab === value ? `hsl(var(--accent-h), var(--accent-s), 80%)` : 'rgba(255,255,255,0.40)',
                border: `1px solid ${tab === value ? 'rgba(var(--glow), 0.28)' : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search — solo en Recientes */}
        <AnimatePresence>
          {tab === 'recientes' && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSearch}
              className="relative"
            >
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar sueños..."
                className="glass-input px-4 py-2.5 text-sm pr-10"
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/65">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Populares header */}
        {tab === 'populares' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/35 capitalize">{monthLabel}</span>
            <span className="text-white/15">·</span>
            <span className="text-[11px] text-white/35">ordenados por likes</span>
          </div>
        )}
      </header>

      {/* Feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-24"
        style={{ overscrollBehavior: 'contain' }}
      >
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="glass-card h-40 shimmer" />)}
          </div>
        ) : dreams.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center py-24 text-center"
          >
            <div className="text-5xl mb-4 opacity-25">
              {tab === 'populares' ? '🔥' : tab === 'seguidos' ? '🌙' : '🔭'}
            </div>
            <p className="text-white/40 text-sm">
              {tab === 'seguidos'
                ? 'Las personas a las que sigues no han compartido sueños aún.'
                : tab === 'populares'
                ? 'Ningún sueño ha recibido likes este mes todavía.'
                : search ? `Sin resultados para "${search}"` : 'El cielo onírico está tranquilo.'}
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={listContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {tab === 'populares' && (
              <div className="flex items-center gap-2 mb-1">
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
                <span className="text-[10px] text-white/25 uppercase tracking-widest">Top sueños del mes</span>
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
              </div>
            )}

            {dreams.map((dream, idx) => (
              <motion.div key={dream.id} variants={listItemVariants}>
                <FeedCard
                  dream={dream}
                  rank={tab === 'populares' ? idx + 1 : undefined}
                  onLike={() => likeMutation.mutate({ id: dream.id, liked: dream.user_liked })}
                  onOpen={() => navigate(`/perfil/${dream.author_id}`)}
                  onDetail={() => navigate(`/sueno/${dream.id}`)}
                />
              </motion.div>
            ))}

            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 rounded-full border-2 animate-spin"
                     style={{ borderColor: 'rgba(var(--glow), 0.2)', borderTopColor: 'rgba(var(--glow), 0.7)' }} />
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

function FeedCard({
  dream,
  rank,
  onLike,
  onOpen,
  onDetail,
}: {
  dream: FeedDream
  rank?: number
  onLike: () => void
  onOpen: () => void
  onDetail: () => void
}) {
  const timeAgo = formatDistanceToNow(new Date(dream.created_at), { addSuffix: true, locale: es })

  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      className={`glass-card p-4 ${dream.is_lucid ? 'lucid-border' : ''}`}
    >
      {/* Author row */}
      <div className="flex items-center gap-2.5 mb-3">
        <button onClick={onOpen} className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
               style={{ background: 'rgba(var(--glow), 0.20)' }}>
            {dream.author_avatar
              ? <img src={dream.author_avatar} alt="" className="w-full h-full rounded-full object-cover" />
              : dream.author_avatar_emoji ?? dream.author_name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-white/75 truncate">{dream.author_name}</p>
            <p className="text-[10px] text-white/30">{timeAgo}</p>
          </div>
        </button>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {dream.is_lucid && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(100,212,184,0.12)', color: '#64D4B8' }}>
              ✨ Lúcido
            </span>
          )}
          {rank && rank <= 3 && (
            <span className="text-base leading-none">
              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
            </span>
          )}
          {rank && rank > 3 && (
            <span className="text-[11px] font-bold text-white/30" style={{ fontFamily: 'var(--font-mono)' }}>
              #{rank}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div onClick={onDetail} className="cursor-pointer">
        {dream.title && (
          <h3 className="text-[14px] font-medium mb-1.5 line-clamp-1" style={{ fontFamily: 'var(--font-serif)' }}>
            {dream.title}
          </h3>
        )}
        <p className="text-[13px] text-white/55 leading-relaxed line-clamp-3 mb-1">
          {dream.body}
        </p>
        {dream.body.length > 180 && (
          <span className="text-[11px] mb-2 block" style={{ color: `hsl(var(--accent-h), var(--accent-s), 70%)` }}>
            Leer más…
          </span>
        )}
      </div>

      {/* Emotion chips */}
      {dream.emotions.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          {dream.emotions.slice(0, 3).map((e) => (
            <span key={e} className="text-[10px] px-2 py-0.5 rounded-full capitalize"
                  style={{ background: 'rgba(var(--glow), 0.10)', color: 'rgba(255,255,255,0.5)' }}>
              {e}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <motion.button
          whileTap={{ scale: 1.28 }}
          transition={{ type: 'spring', stiffness: 400, damping: 14 }}
          onClick={onLike}
          className="flex items-center gap-1.5 text-[12px] font-medium transition-colors"
          style={{ color: dream.user_liked ? '#e05252' : 'rgba(255,255,255,0.35)' }}
        >
          <HeartIcon filled={dream.user_liked} />
          <motion.span
            key={dream.like_count}
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            style={{ minWidth: '1ch', display: 'inline-block', textAlign: 'center' }}
          >
            {dream.like_count}
          </motion.span>
        </motion.button>

        <button onClick={onDetail} className="flex items-center gap-1.5 text-[12px] text-white/30 hover:text-white/60 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>{dream.comment_count > 0 ? dream.comment_count : 'Comentar'}</span>
        </button>
      </div>
    </motion.div>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.8}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}
