import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { pageVariants, pageTransition, listContainerVariants, listItemVariants } from '../lib/motion'
import { WhisperShareModal } from '../components/whispers/WhisperShareModal'
import { WhisperCompose } from '../components/whispers/WhisperCompose'
import type { Whisper, WhisperFeed } from '../types'

const PAGE_SIZE = 15

async function fetchWhispers(sort: WhisperFeed, offset: number, userId?: string): Promise<Whisper[]> {
  const orderCol = sort === 'popular' ? 'resono_count' : 'created_at'
  const { data, error } = await supabase
    .from('whispers')
    .select('id, dream_id, body, emotions, resono_count, created_at, whisper_resonos(user_id)')
    .order(orderCol, { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (error) throw error
  return (data ?? []).map((w: any) => ({
    id: w.id,
    dream_id: w.dream_id,
    body: w.body,
    emotions: w.emotions ?? [],
    resono_count: w.resono_count,
    created_at: w.created_at,
    user_resonated: userId ? (w.whisper_resonos ?? []).some((r: any) => r.user_id === userId) : false,
  }))
}

const EMOTION_COLOR: Record<string, string> = {
  miedo:    'rgba(232,88,88,0.15)',
  tristeza: 'rgba(100,148,212,0.15)',
  alegría:  'rgba(76,175,130,0.15)',
  asombro:  'rgba(184,164,232,0.15)',
  confusión:'rgba(232,200,88,0.15)',
  paz:      'rgba(100,212,184,0.15)',
  amor:     'rgba(232,140,184,0.15)',
  ansiedad: 'rgba(232,140,88,0.15)',
}

function emotionBg(emotions: string[]) {
  const first = emotions[0]?.toLowerCase()
  return EMOTION_COLOR[first ?? ''] ?? 'rgba(184,164,232,0.06)'
}

export default function WhispersPage() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [sort, setSort] = useState<WhisperFeed>('recent')
  const [shareWhisper, setShareWhisper] = useState<Whisper | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isFetching } =
    useInfiniteQuery({
      queryKey: ['whispers', sort],
      queryFn: ({ pageParam = 0 }) => fetchWhispers(sort, pageParam as number, user?.id),
      getNextPageParam: (last, all) =>
        last.length === PAGE_SIZE ? all.flat().length : undefined,
      initialPageParam: 0,
    })

  const resonoMutation = useMutation({
    mutationFn: async ({ id, resonated }: { id: string; resonated: boolean }) => {
      if (!user) return
      if (resonated) {
        await supabase.from('whisper_resonos').delete().eq('whisper_id', id).eq('user_id', user.id)
      } else {
        await supabase.from('whisper_resonos').upsert({ whisper_id: id, user_id: user.id })
      }
    },
    onMutate: async ({ id, resonated }) => {
      await qc.cancelQueries({ queryKey: ['whispers', sort] })
      const prev = qc.getQueryData(['whispers', sort])
      qc.setQueryData<typeof data>(['whispers', sort], (old) => ({
        ...old!,
        pages: old!.pages.map((page) =>
          page.map((w) =>
            w.id === id
              ? { ...w, resono_count: w.resono_count + (resonated ? -1 : 1), user_resonated: !resonated }
              : w
          )
        ),
      }))
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['whispers', sort], ctx.prev)
    },
  })

  const whispers = data?.pages.flat() ?? []

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

  return (
    <>
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
            <div>
              <h1 className="text-2xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                Susurros
              </h1>
              <p className="text-[12px] text-white/35 mt-0.5">Sueños sin nombre, solo palabras</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCompose(true)}
              className="glass-btn-primary px-4 py-2 text-[13px] font-semibold flex items-center gap-1.5"
            >
              <span style={{ fontSize: 15 }}>✦</span>
              Susurrar
            </motion.button>
          </div>

          {/* Sort tabs */}
          <div className="flex gap-1.5">
            {([
              { value: 'recent',  label: 'Recientes' },
              { value: 'popular', label: 'Populares' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSort(value)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-full transition-all duration-200"
                style={{
                  background: sort === value ? 'rgba(var(--glow), 0.22)' : 'rgba(255,255,255,0.05)',
                  color: sort === value ? `hsl(var(--accent-h), var(--accent-s), 80%)` : 'rgba(255,255,255,0.40)',
                  border: `1px solid ${sort === value ? 'rgba(var(--glow), 0.28)' : 'rgba(255,255,255,0.07)'}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* Feed */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 pt-4 space-y-3"
          style={{ overscrollBehavior: 'contain' }}
        >
          {isLoading ? (
            <>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-whisper p-5 h-36 shimmer" />
              ))}
            </>
          ) : whispers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-20 text-center"
            >
              <div className="text-5xl mb-4 opacity-25">🌙</div>
              <p className="text-white/40 text-sm">El silencio espera el primer susurro.</p>
              <button onClick={() => setShowCompose(true)} className="glass-btn-primary px-6 py-2.5 text-sm font-semibold mt-5">
                Ser el primero
              </button>
            </motion.div>
          ) : (
            <motion.div
              variants={listContainerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3 pb-4"
            >
              {whispers.map((w) => (
                <motion.div key={w.id} variants={listItemVariants}>
                  <WhisperCard
                    whisper={w}
                    onResono={() => resonoMutation.mutate({ id: w.id, resonated: !!w.user_resonated })}
                    onShare={() => setShareWhisper(w)}
                  />
                </motion.div>
              ))}

              {isFetchingNextPage && (
                <div className="flex justify-center py-4">
                  <div
                    className="w-5 h-5 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'rgba(184,164,232,0.2)', borderTopColor: 'rgba(184,164,232,0.7)' }}
                  />
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Modals */}
      <AnimatePresence>
        {showCompose && (
          <WhisperCompose
            onClose={() => setShowCompose(false)}
            onCreated={() => {
              setShowCompose(false)
              qc.invalidateQueries({ queryKey: ['whispers'] })
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareWhisper && (
          <WhisperShareModal whisper={shareWhisper} onClose={() => setShareWhisper(null)} />
        )}
      </AnimatePresence>
    </>
  )
}

function WhisperCard({
  whisper,
  onResono,
  onShare,
}: {
  whisper: Whisper
  onResono: () => void
  onShare: () => void
}) {
  const timeAgo = formatDistanceToNow(new Date(whisper.created_at), { addSuffix: true, locale: es })

  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.99 }}
      className="glass-whisper p-5 relative overflow-hidden"
      style={{ background: `${emotionBg(whisper.emotions)}` }}
    >
      {/* Decorative quote mark */}
      <div
        className="absolute top-3 left-3 text-5xl leading-none opacity-10 select-none pointer-events-none"
        style={{ fontFamily: 'var(--font-serif)', color: '#B8A4E8' }}
      >
        "
      </div>

      {/* Body */}
      <p
        className="text-[14px] leading-relaxed text-white/80 mb-4 relative z-10"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        {whisper.body.length > 320 ? whisper.body.slice(0, 320) + '…' : whisper.body}
      </p>

      {/* Emotion chips */}
      {whisper.emotions.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          {whisper.emotions.map((e) => (
            <span
              key={e}
              className="text-[10px] px-2 py-0.5 rounded-full capitalize"
              style={{ background: 'rgba(184,164,232,0.15)', color: 'rgba(184,164,232,0.9)' }}
            >
              {e}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/30">{timeAgo}</span>

        <div className="flex items-center gap-3">
          {/* Resono button */}
          <motion.button
            whileTap={{ scale: 1.3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            onClick={onResono}
            className="flex items-center gap-1.5 text-[12px] font-medium transition-colors"
            style={{
              color: whisper.user_resonated ? '#B8A4E8' : 'rgba(255,255,255,0.35)',
            }}
          >
            <MoonWaveIcon filled={!!whisper.user_resonated} />
            {whisper.resono_count > 0 && whisper.resono_count}
            <span>{whisper.user_resonated ? 'resoñado' : 'resoñar'}</span>
          </motion.button>

          {/* Share */}
          <button
            onClick={onShare}
            className="text-[12px] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
          >
            <ShareIcon />
            <span>compartir</span>
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function MoonWaveIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.8}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  )
}
