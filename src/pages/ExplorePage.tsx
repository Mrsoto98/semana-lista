import { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { pageVariants, pageTransition, listContainerVariants, listItemVariants } from '../lib/motion'
import type { FeedDream } from '../types'

type Tab = 'amigos' | 'descubrir'
const PAGE_SIZE = 15

async function fetchPublicFeed(offset: number, search: string, userId: string | undefined): Promise<FeedDream[]> {
  let q = supabase
    .from('dreams')
    .select(`
      id, title, body, dream_date, is_lucid, emotions, tags, visibility,
      created_at, updated_at,
      profiles!dreams_user_id_fkey(id, name, avatar_url, avatar_emoji),
      dream_likes(user_id),
      dream_comments(id)
    `)
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (search) {
    q = q.or(`title.ilike.%${search}%,body.ilike.%${search}%`)
  }

  const { data, error } = await q
  if (error) throw error

  return (data ?? []).map((d: any) => ({
    ...d,
    author_id: d.profiles?.id ?? '',
    author_name: d.profiles?.name ?? 'Anónimo',
    author_avatar: d.profiles?.avatar_url ?? null,
    author_avatar_emoji: d.profiles?.avatar_emoji ?? null,
    like_count: d.dream_likes?.length ?? 0,
    user_liked: userId ? (d.dream_likes ?? []).some((l: any) => l.user_id === userId) : false,
    comment_count: d.dream_comments?.length ?? 0,
    allow_comments: true,
  })) as FeedDream[]
}

async function fetchFriendsFeed(offset: number, userId: string): Promise<FeedDream[]> {
  const { data: fs } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted')

  const friendIds = (fs ?? []).map((f: any) =>
    f.requester_id === userId ? f.addressee_id : f.requester_id
  )
  if (friendIds.length === 0) return []

  const { data, error } = await supabase
    .from('dreams')
    .select(`
      id, title, body, dream_date, is_lucid, emotions, tags, visibility,
      created_at, updated_at,
      profiles!dreams_user_id_fkey(id, name, avatar_url, avatar_emoji),
      dream_likes(user_id),
      dream_comments(id)
    `)
    .in('user_id', friendIds)
    .in('visibility', ['public', 'friends'])
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (error) throw error

  return (data ?? []).map((d: any) => ({
    ...d,
    author_id: d.profiles?.id ?? '',
    author_name: d.profiles?.name ?? 'Anónimo',
    author_avatar: d.profiles?.avatar_url ?? null,
    author_avatar_emoji: d.profiles?.avatar_emoji ?? null,
    like_count: d.dream_likes?.length ?? 0,
    user_liked: (d.dream_likes ?? []).some((l: any) => l.user_id === userId),
    comment_count: d.dream_comments?.length ?? 0,
    allow_comments: true,
  })) as FeedDream[]
}

export default function ExplorePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [tab, setTab] = useState<Tab>('descubrir')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const queryKey = ['feed', tab, search, user?.id]
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey,
      queryFn: ({ pageParam = 0 }) => {
        if (tab === 'amigos' && user) return fetchFriendsFeed(pageParam as number, user.id)
        return fetchPublicFeed(pageParam as number, search, user?.id)
      },
      getNextPageParam: (last, all) =>
        last.length === PAGE_SIZE ? all.flat().length : undefined,
      initialPageParam: 0,
    })

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
      await qc.cancelQueries({ queryKey })
      const prev = qc.getQueryData(queryKey)
      qc.setQueryData<typeof data>(queryKey, (old) => ({
        ...old!,
        pages: old!.pages.map((page) =>
          page.map((d) =>
            d.id === id
              ? { ...d, like_count: d.like_count + (liked ? -1 : 1), user_liked: !liked }
              : d
          )
        ),
      }))
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(queryKey, ctx.prev),
  })

  const dreams = data?.pages.flat() ?? []

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
        <h1 className="text-2xl font-normal mb-3" style={{ fontFamily: 'var(--font-serif)' }}>
          Explorar
        </h1>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-3">
          {([
            { value: 'descubrir', label: 'Descubrir' },
            { value: 'amigos',    label: 'Amigos' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className="px-3.5 py-1.5 text-xs font-medium rounded-full transition-all duration-200"
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

        {/* Search (only on Descubrir) */}
        <AnimatePresence>
          {tab === 'descubrir' && (
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
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/65"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </header>

      {/* Feed */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pt-4 pb-4"
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
            <div className="text-5xl mb-4 opacity-25">🔭</div>
            <p className="text-white/40 text-sm">
              {tab === 'amigos'
                ? 'Tus amigos no han compartido sueños aún.'
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
            {dreams.map((dream) => (
              <motion.div key={dream.id} variants={listItemVariants}>
                <FeedCard
                  dream={dream}
                  onLike={() => likeMutation.mutate({ id: dream.id, liked: dream.user_liked })}
                  onOpen={() => navigate(`/perfil/${dream.author_id}`)}
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
  onLike,
  onOpen,
}: {
  dream: FeedDream
  onLike: () => void
  onOpen: () => void
}) {
  const timeAgo = formatDistanceToNow(new Date(dream.created_at), { addSuffix: true, locale: es })

  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      className={`glass-card p-4 ${dream.is_lucid ? 'lucid-border' : ''}`}
    >
      {/* Author */}
      <div className="flex items-center gap-2.5 mb-3">
        <button
          onClick={onOpen}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
            style={{ background: 'rgba(var(--glow), 0.20)' }}
          >
            {dream.author_avatar ? (
              <img src={dream.author_avatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              dream.author_avatar_emoji ?? dream.author_name[0]?.toUpperCase()
            )}
          </div>
          <div>
            <p className="text-[12px] font-medium text-white/75">{dream.author_name}</p>
            <p className="text-[10px] text-white/30">{timeAgo}</p>
          </div>
        </button>

        {dream.is_lucid && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(100,212,184,0.12)', color: '#64D4B8' }}>
            ✨ Lúcido
          </span>
        )}
      </div>

      {/* Content */}
      {dream.title && (
        <h3 className="text-[14px] font-medium mb-1.5 line-clamp-1" style={{ fontFamily: 'var(--font-serif)' }}>
          {dream.title}
        </h3>
      )}
      <p className="text-[13px] text-white/55 leading-relaxed line-clamp-3 mb-3">
        {dream.body}
      </p>

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
          whileTap={{ scale: 1.25 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          onClick={onLike}
          className="flex items-center gap-1.5 text-[12px] font-medium transition-colors"
          style={{ color: dream.user_liked ? '#e05252' : 'rgba(255,255,255,0.35)' }}
        >
          <HeartIcon filled={dream.user_liked} />
          {dream.like_count > 0 && dream.like_count}
        </motion.button>

        <button className="flex items-center gap-1.5 text-[12px] text-white/30 hover:text-white/60 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {dream.comment_count > 0 && dream.comment_count}
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
