import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { likesApi, dreamsApi } from '../lib/queries'
import { useAuthStore } from '../lib/store'
import { CommentSection } from '../components/dreams/CommentSection'
import { pageVariants, pageTransition } from '../lib/motion'
import type { DreamAnalysis } from '../types'

const VIS_LABEL = { private: '🔒', friends: '👥', public: '🌍' }

export default function DreamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['dream-detail', id],
    queryFn: async () => {
      const [dreamRes, myLikeRes] = await Promise.all([
        supabase.from('dreams')
          .select('*, profiles!dreams_user_id_fkey(id, name, avatar_url, avatar_emoji)')
          .eq('id', id!)
          .single(),
        user ? supabase.from('dream_likes').select('user_id').eq('dream_id', id!).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      const dream = dreamRes.data
      const profile = (dream as any)?.profiles
      return {
        dream,
        author: { id: profile?.id, name: profile?.name ?? 'Soñador', avatar_url: profile?.avatar_url ?? null, avatar_emoji: profile?.avatar_emoji ?? null },
        like_count: (dream as any)?.like_count ?? 0,
        user_liked: !!myLikeRes.data,
      }
    },
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dreams').delete().eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dreams'] })
      qc.invalidateQueries({ queryKey: ['my-dreams-profile'] })
      navigate('/perfil', { replace: true })
    },
  })

  const { data: analysis, isLoading: analysisLoading } = useQuery<DreamAnalysis>({
    queryKey: ['dream-analysis', id],
    queryFn: () => dreamsApi.getAnalysis(id!).then(r => r.data),
    enabled: !!id,
    retry: false,
  })

  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const analyzeMutation = useMutation({
    mutationFn: () => dreamsApi.analyze(id!).then(r => r.data),
    onSuccess: (result) => {
      qc.setQueryData(['dream-analysis', id], result)
      setAnalyzeError(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? err?.message ?? 'No se pudo analizar el sueño. Inténtalo más tarde.'
      setAnalyzeError(msg)
    },
  })

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!user || !data || !id) return
      if (data.user_liked) await likesApi.unlike(id)
      else await likesApi.like(id)
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['dream-detail', id] })
      qc.setQueryData<typeof data>(['dream-detail', id], old => old ? ({
        ...old,
        like_count: old.like_count + (old.user_liked ? -1 : 1),
        user_liked: !old.user_liked,
      }) : old)
    },
    onError: () => qc.invalidateQueries({ queryKey: ['dream-detail', id] }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['dream-detail', id] }),
  })

  function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: data?.dream?.title ?? 'Sueño', url })
    } else {
      navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    }
  }

  if (isLoading) return (
    <div className="flex flex-col gap-4 px-4 pt-16">
      <div className="glass-card h-48 shimmer" />
      <div className="glass-card h-28 shimmer" />
      <div className="glass-card h-28 shimmer" />
    </div>
  )

  if (!data?.dream) return (
    <div className="text-center py-20 text-white/40">Sueño no encontrado</div>
  )

  const { dream, author, like_count, user_liked } = data
  const isMine = user?.id === dream.user_id

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
        className="glass-header sticky top-0 z-30 px-4 flex items-center gap-3"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 12 }}
      >
        <button onClick={() => navigate(-1)}
          className="p-2 rounded-xl text-white/50 hover:text-white/80 transition-colors"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="flex-1 text-base font-medium truncate" style={{ fontFamily: 'var(--font-serif)' }}>
          {dream.title ?? 'Sueño'}
        </h1>
        <div className="flex items-center gap-2">
          {isMine && (
            <>
              <button onClick={() => navigate(`/diario/${dream.id}`)}
                className="p-2 rounded-xl text-white/40 hover:text-white/70 transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                onClick={() => { if (window.confirm('¿Eliminar este sueño? No se puede deshacer.')) deleteMutation.mutate() }}
                disabled={deleteMutation.isPending}
                className="p-2 rounded-xl transition-colors disabled:opacity-40"
                style={{ background: 'rgba(232,88,88,0.08)', color: 'rgba(232,88,88,0.6)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </>
          )}
          <button onClick={handleShare}
            className="p-2 rounded-xl text-white/40 hover:text-white/70 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            {copied
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            }
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-24">

        {/* Author */}
        <button
          onClick={() => navigate(`/perfil/${author.id}`)}
          className="flex items-center gap-2.5 mb-4 group"
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
               style={{ background: 'rgba(var(--glow), 0.20)' }}>
            {author.avatar_url
              ? <img src={author.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
              : author.avatar_emoji ?? author.name[0]?.toUpperCase()
            }
          </div>
          <div>
            <p className="text-[13px] font-medium text-white/80 group-hover:text-white transition-colors">{author.name}</p>
            <p className="text-[11px] text-white/35">
              {new Date(dream.dream_date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {dream.is_lucid && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(100,212,184,0.12)', color: '#64D4B8' }}>
                ✨ Lúcido
              </span>
            )}
            <span className="text-[11px] text-white/25">{(VIS_LABEL as any)[dream.visibility]}</span>
          </div>
        </button>

        {/* Dream content */}
        <div className="glass rounded-3xl p-5 mb-4 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full pointer-events-none"
               style={{ background: `radial-gradient(circle, rgba(var(--glow-color),0.25) 0%, transparent 70%)`, filter: 'blur(24px)' }} />

          {dream.title && (
            <h2 className="text-xl font-medium mb-3 relative" style={{ fontFamily: 'var(--font-serif)' }}>
              {dream.title}
            </h2>
          )}
          <p className="text-[14px] text-white/70 leading-relaxed relative" style={{ fontFamily: 'var(--font-serif)', whiteSpace: 'pre-line' }}>
            {dream.body}
          </p>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-2 mb-4">
          {dream.sleep_quality != null && (
            <span className="glass-pill text-[11px] px-2.5 py-1 rounded-full text-white/50">
              {'★'.repeat(dream.sleep_quality)}{'☆'.repeat(5 - dream.sleep_quality)} calidad
            </span>
          )}
          {dream.emotions?.map((e: string) => (
            <span key={e} className="text-[11px] px-2.5 py-1 rounded-full capitalize"
                  style={{ background: 'rgba(var(--glow), 0.10)', color: 'rgba(255,255,255,0.55)' }}>
              {e}
            </span>
          ))}
          {dream.tags?.map((t: string) => (
            <span key={t} className="text-[11px] px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono)' }}>
              #{t}
            </span>
          ))}
        </div>

        {/* AI Analysis */}
        {analysisLoading ? (
          <div className="glass rounded-2xl p-4 mb-4 border border-white/6 shimmer h-24" />
        ) : analysis ? (
          <div className="glass rounded-2xl p-4 mb-4 border border-white/6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-medium uppercase tracking-widest"
                 style={{ color: `hsl(var(--accent-h), var(--accent-s), 60%)` }}>
                ✦ Análisis IA
              </p>
              <div className="flex items-center gap-2">
                {analysis.cached && (
                  <span className="text-[9px] text-white/25 uppercase tracking-widest">caché</span>
                )}
                {isMine && (
                  <button
                    onClick={() => { setAnalyzeError(null); analyzeMutation.mutate() }}
                    disabled={analyzeMutation.isPending}
                    className="text-[10px] text-white/30 hover:text-white/60 transition-colors disabled:opacity-40"
                  >
                    ↺ Re-analizar
                  </button>
                )}
              </div>
            </div>
            <p className="text-[14px] text-white/75 leading-relaxed mb-3">
              {analysis.summary}
            </p>
            {analysis.emotional_tone && (
              <span className="inline-block text-[10px] px-2 py-0.5 rounded-full mb-2"
                    style={{ background: 'rgba(var(--glow),0.12)', color: `hsl(var(--accent-h),var(--accent-s),70%)` }}>
                {analysis.emotional_tone}
              </span>
            )}
            {(analysis.themes?.length > 0 || analysis.symbols?.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {analysis.themes?.map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}>
                    {t}
                  </span>
                ))}
                {analysis.symbols?.map(s => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    ◈ {s}
                  </span>
                ))}
              </div>
            )}
            {analysis.interpretations?.[0] && (
              <p className="text-[11px] text-white/35 mt-3 leading-relaxed border-t border-white/6 pt-3">
                {analysis.interpretations[0].text}
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4">
            {analyzeError && (
              <p className="text-[11px] text-center mb-2" style={{ color: 'rgba(240,100,100,0.7)' }}>
                {analyzeError}
              </p>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { setAnalyzeError(null); analyzeMutation.mutate() }}
              disabled={analyzeMutation.isPending}
              className="w-full py-3 rounded-2xl text-[13px] font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{
                background: 'rgba(var(--glow),0.10)',
                border: '1px dashed rgba(var(--glow),0.25)',
                color: `hsl(var(--accent-h),var(--accent-s),72%)`,
              }}
            >
              {analyzeMutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                       style={{ borderColor: 'rgba(var(--glow),0.2)', borderTopColor: 'rgba(var(--glow),0.7)' }} />
                  Analizando…
                </>
              ) : (
                <>🔮 Analizar sueño</>
              )}
            </motion.button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 mb-5 pb-4 border-b border-white/6">
          <motion.button
            whileTap={{ scale: 1.3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            onClick={() => user && likeMutation.mutate()}
            disabled={!user}
            className="flex items-center gap-1.5 text-[13px] font-medium transition-colors disabled:opacity-30"
            style={{ color: user_liked ? '#e05252' : 'rgba(255,255,255,0.4)' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24"
                 fill={user_liked ? 'currentColor' : 'none'}
                 stroke="currentColor" strokeWidth={user_liked ? 0 : 1.8}>
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {like_count > 0 ? like_count : 'Me gusta'}
          </motion.button>

          <span className="text-[13px] text-white/30">
            {formatDistanceToNow(new Date(dream.created_at), { addSuffix: true, locale: es })}
          </span>
        </div>

        {/* Comments */}
        <CommentSection
          dreamId={dream.id}
          allowComments={dream.allow_comments !== false}
          forceOpen
        />
      </div>
    </motion.div>
  )
}
