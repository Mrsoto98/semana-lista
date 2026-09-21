import { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { useInfiniteQuery } from '@tanstack/react-query'
import { format, startOfWeek, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { DreamCard } from '../components/dreams/DreamCard'
import { listContainerVariants, listItemVariants, pageVariants, pageTransition } from '../lib/motion'
import type { Dream } from '../types'

const PAGE_SIZE = 20

function groupByWeek(dreams: Dream[]): { label: string; items: Dream[] }[] {
  const groups: Record<string, Dream[]> = {}
  for (const d of dreams) {
    const date = new Date(d.dream_date + 'T12:00:00')
    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    const weekEnd = addDays(weekStart, 6)
    const label = `${format(weekStart, 'd MMM', { locale: es })} – ${format(weekEnd, 'd MMM', { locale: es })}`
    if (!groups[label]) groups[label] = []
    groups[label].push(d)
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
}

export default function DiaryPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['dreams', user?.id],
      queryFn: async ({ pageParam = 0 }) => {
        const { data: rows, error } = await supabase
          .from('dreams')
          .select('*')
          .eq('user_id', user!.id)
          .order('dream_date', { ascending: false })
          .range(pageParam as number, (pageParam as number) + PAGE_SIZE - 1)
        if (error) throw error
        return rows ?? []
      },
      getNextPageParam: (last, all) =>
        last.length === PAGE_SIZE ? all.flat().length : undefined,
      initialPageParam: 0,
      enabled: !!user,
    })

  const allDreams = data?.pages.flat() ?? []
  const groups = groupByWeek(allDreams)
  const stats = {
    total: allDreams.length,
    lucid: allDreams.filter((d) => d.is_lucid).length,
    streak: 0, // computed server-side via stats endpoint
  }

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setHeaderCollapsed(el.scrollTop > 60)

    // Infinite scroll trigger
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const todayDream = allDreams.find((d) => d.dream_date === today)

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
      className="flex flex-col h-svh"
    >
      {/* Sticky header */}
      <header
        className="glass-header sticky top-0 z-30 transition-all duration-300 px-4"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 12 }}
      >
        <AnimatePresence mode="wait">
          {!headerCollapsed ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-2xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                    Mi Diario
                  </h1>
                  <p className="text-[12px] text-white/40 mt-0.5">
                    {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
                  </p>
                </div>
                <div className="text-2xl">
                  {user?.avatar_emoji ?? '☽'}
                </div>
              </div>

              {/* Stats row */}
              <div className="flex gap-3">
                {[
                  { value: stats.total, label: 'sueños' },
                  { value: stats.lucid, label: 'lúcidos' },
                ].map(({ value, label }) => (
                  <div
                    key={label}
                    className="px-3 py-1.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <span
                      className="text-base font-semibold"
                      style={{ fontFamily: 'var(--font-mono)', color: `hsl(var(--accent-h), var(--accent-s), 76%)` }}
                    >
                      {value}
                    </span>
                    <span className="text-[11px] text-white/40 ml-1.5">{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center justify-between"
            >
              <h1 className="text-lg font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                Mi Diario
              </h1>
              <div className="flex items-center gap-2 text-xs text-white/40">
                <span style={{ fontFamily: 'var(--font-mono)' }}>{stats.total}</span>
                <span>sueños</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Today CTA */}
        {!todayDream && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            onClick={() => navigate('/diario/nuevo')}
            className="glass-btn-primary w-full py-2.5 text-sm font-semibold mt-3 flex items-center justify-center gap-2"
          >
            <span>✦</span>
            Añadir sueño de hoy
          </motion.button>
        )}
      </header>

      {/* Dream list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-24"
        style={{ overscrollBehavior: 'contain' }}
      >
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="glass-card p-4 h-28 shimmer rounded-[20px]" />
            ))}
          </div>
        ) : allDreams.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="text-5xl mb-4 opacity-30">☽</div>
            <p className="text-white/50 text-sm mb-6">Tu diario está vacío.<br />Registra tu primer sueño.</p>
            <button
              onClick={() => navigate('/diario/nuevo')}
              className="glass-btn-primary px-6 py-2.5 text-sm font-semibold"
            >
              Añadir sueño
            </button>
          </motion.div>
        ) : (
          <motion.div
            variants={listContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-5"
          >
            {groups.map(({ label, items }) => (
              <motion.section key={label} variants={listItemVariants}>
                <h2
                  className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-2.5 px-1"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {label}
                </h2>
                <div className="space-y-2.5">
                  {items.map((dream) => (
                    <motion.div key={dream.id} variants={listItemVariants}>
                      <DreamCard
                        dream={dream}
                        onClick={() => navigate(`/diario/${dream.id}`)}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            ))}

            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <div
                  className="w-5 h-5 rounded-full border-2 animate-spin"
                  style={{ borderColor: `rgba(var(--glow), 0.2)`, borderTopColor: `rgba(var(--glow), 0.7)` }}
                />
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
