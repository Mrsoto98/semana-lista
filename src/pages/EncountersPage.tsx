import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { pageVariants, pageTransition, listContainerVariants, listItemVariants } from '../lib/motion'
import type { Coincidence } from '../types'

type Scope = 'friends' | 'public'

function jaccardScore(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0
  const setA = new Set(a.map(t => t.toLowerCase()))
  const setB = new Set(b.map(t => t.toLowerCase()))
  const intersection = [...setA].filter(t => setB.has(t)).length
  const union = new Set([...setA, ...setB]).size
  return intersection / union
}

export default function EncountersPage() {
  const { user } = useAuthStore()
  const [scope, setScope] = useState<Scope>('public')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [accepted, setAccepted] = useState<Set<string>>(new Set())

  const { data = [], isLoading } = useQuery({
    queryKey: ['coincidences', scope, user?.id],
    queryFn: async (): Promise<Coincidence[]> => {
      if (!user) return []
      // My dreams with tags
      const { data: myDreams } = await supabase.from('dreams').select('id,title,dream_date,tags')
        .eq('user_id', user.id).not('tags', 'eq', '{}')
      if (!myDreams?.length) return []

      // Others' dreams
      let q = supabase.from('dreams')
        .select('id,title,dream_date,tags,user_id,profiles!dreams_user_id_fkey(id,name,avatar_url)')
        .neq('user_id', user.id)
        .not('tags', 'eq', '{}')
        .order('created_at', { ascending: false })
        .limit(200)

      if (scope === 'friends') {
        const { data: fs } = await supabase.from('friendships').select('requester_id,addressee_id')
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq('status', 'accepted')
        const fIds = (fs ?? []).map((f: any) => f.requester_id === user.id ? f.addressee_id : f.requester_id)
        if (!fIds.length) return []
        q = q.in('user_id', fIds)
      } else {
        q = q.eq('visibility', 'public')
      }

      const { data: otherDreams } = await q
      const results: Coincidence[] = []

      for (const mine of myDreams) {
        for (const theirs of (otherDreams ?? [])) {
          const score = jaccardScore(mine.tags ?? [], (theirs as any).tags ?? [])
          if (score < 0.2) continue
          const profile = (theirs as any).profiles
          results.push({
            id: `${mine.id}-${theirs.id}`,
            score,
            scope,
            status: 'suggested',
            accepted_a: false, accepted_b: false,
            created_at: new Date().toISOString(),
            my_dream_id: mine.id, my_dream_title: mine.title, my_dream_date: mine.dream_date,
            my_dream_tags: mine.tags ?? [],
            their_dream_id: theirs.id, their_dream_date: (theirs as any).dream_date,
            their_dream_tags: (theirs as any).tags ?? [], their_dream_title: (theirs as any).title,
            their_user_id: (theirs as any).user_id,
            their_user_name: profile?.name ?? 'Soñador anónimo',
            their_avatar: profile?.avatar_url ?? null,
            i_accepted: false,
          })
        }
      }
      return results.sort((a, b) => b.score - a.score).slice(0, 30)
    },
    enabled: !!user,
  })

  const allCoincidences = data.filter(c => !dismissed.has(c.id))
  const pending = allCoincidences.filter(c => !accepted.has(c.id))
  const acceptedList = allCoincidences.filter(c => accepted.has(c.id)).map(c => ({ ...c, status: 'accepted' as const }))

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
        <div className="mb-3">
          <h1 className="text-2xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
            Encuentros
          </h1>
          <p className="text-[12px] text-white/35 mt-0.5">Sueños que resuenan entre almas</p>
        </div>

        <div className="flex gap-1.5">
          {([
            { value: 'public',  label: 'Con todos' },
            { value: 'friends', label: 'Con amigos' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setScope(value)}
              className="px-3.5 py-1.5 text-xs font-medium rounded-full transition-all duration-200"
              style={{
                background: scope === value ? 'rgba(var(--glow), 0.22)' : 'rgba(255,255,255,0.05)',
                color: scope === value ? `hsl(var(--accent-h), var(--accent-s), 80%)` : 'rgba(255,255,255,0.40)',
                border: `1px solid ${scope === value ? 'rgba(var(--glow), 0.28)' : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="glass-card h-36 shimmer" />)}
          </div>
        ) : data.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center py-24 text-center"
          >
            <div className="text-5xl mb-4">✨</div>
            <p className="text-white/40 text-sm leading-relaxed">
              Aún no hay coincidencias.<br />
              El universo onírico sigue tejiendo conexiones.
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={listContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {/* Pending encounters */}
            {pending.length > 0 && (
              <section>
                <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2.5 px-1"
                    style={{ fontFamily: 'var(--font-mono)' }}>
                  Nuevas conexiones
                </h2>
                {pending.map((c) => (
                  <motion.div key={c.id} variants={listItemVariants} className="mb-2.5">
                    <EncounterCard
                      coincidence={c}
                      onAccept={() => setAccepted(prev => new Set([...prev, c.id]))}
                      onDismiss={() => setDismissed(prev => new Set([...prev, c.id]))}
                    />
                  </motion.div>
                ))}
              </section>
            )}

            {/* Accepted encounters */}
            {acceptedList.length > 0 && (
              <section>
                <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2.5 px-1 mt-4"
                    style={{ fontFamily: 'var(--font-mono)' }}>
                  Conexiones establecidas
                </h2>
                {acceptedList.map((c) => (
                  <motion.div key={c.id} variants={listItemVariants} className="mb-2.5">
                    <EncounterCard coincidence={c} accepted />
                  </motion.div>
                ))}
              </section>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

function EncounterCard({
  coincidence: c,
  onAccept,
  onDismiss,
  loading,
  accepted,
}: {
  coincidence: Coincidence
  onAccept?: () => void
  onDismiss?: () => void
  loading?: boolean
  accepted?: boolean
}) {
  const score = Math.round(c.score * 100)
  const timeAgo = formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: es })

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px]" style={{ color: `hsl(var(--accent-h), var(--accent-s), 75%)` }}>
            ✨ Alguien soñó algo similar
          </span>
          {accepted && c.their_user_name && (
            <span className="text-[11px] text-white/40">— {c.their_user_name}</span>
          )}
        </div>
        <span className="text-[10px] text-white/30" style={{ fontFamily: 'var(--font-mono)' }}>{timeAgo}</span>
      </div>

      {/* Dream comparison */}
      <div className="space-y-2 mb-3">
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Tu sueño</div>
          <p className="text-[12px] text-white/70 line-clamp-2" style={{ fontFamily: 'var(--font-serif)' }}>
            {c.my_dream_title ?? c.my_dream_tags.join(', ') ?? `Sueño del ${new Date(c.my_dream_date).toLocaleDateString('es')}`}
          </p>
        </div>

        {/* Similarity bar */}
        <div className="flex items-center gap-2 px-1">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, hsl(var(--accent-h), var(--accent-s), 60%), hsl(var(--accent-h), var(--accent-s), 80%))` }}
            />
          </div>
          <span
            className="text-[11px] font-semibold shrink-0"
            style={{ fontFamily: 'var(--font-mono)', color: `hsl(var(--accent-h), var(--accent-s), 76%)` }}
          >
            {score}%
          </span>
        </div>

        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Su sueño</div>
          <p className="text-[12px] text-white/70 line-clamp-2" style={{ fontFamily: 'var(--font-serif)' }}>
            {accepted
              ? (c.their_dream_title ?? c.their_dream_tags.join(', '))
              : 'Identidad anónima hasta aceptar la conexión'}
          </p>
        </div>
      </div>

      {/* Tags */}
      {(c.my_dream_tags.length > 0 || c.their_dream_tags.length > 0) && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          {[...new Set([...c.my_dream_tags, ...c.their_dream_tags])].slice(0, 5).map((t) => (
            <span
              key={t}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(var(--glow), 0.10)',
                color: 'rgba(255,255,255,0.45)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      {!accepted && onAccept && onDismiss && (
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onAccept}
            disabled={loading}
            className="flex-1 glass-btn-primary py-2.5 text-xs font-semibold"
          >
            Aceptar conexión
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onDismiss}
            disabled={loading}
            className="flex-1 glass-btn-secondary py-2.5 text-xs font-medium"
          >
            Pasar
          </motion.button>
        </div>
      )}
    </div>
  )
}
