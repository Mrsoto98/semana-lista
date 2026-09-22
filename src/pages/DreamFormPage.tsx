import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { CosmicBackground } from '../components/common/CosmicBackground'
import type { Visibility } from '../types'

const VISIBILITIES: { value: Visibility; label: string; icon: string; desc: string }[] = [
  { value: 'private', label: 'Solo yo',  icon: '🔒', desc: 'Solo tú puedes verlo' },
  { value: 'friends', label: 'Amigos',   icon: '👥', desc: 'Visible para tus amigos' },
  { value: 'public',  label: 'Público',  icon: '🌍', desc: 'Visible para todos' },
]

const EMOTIONS = [
  'Miedo', 'Tristeza', 'Alegría', 'Asombro', 'Confusión',
  'Paz', 'Amor', 'Ansiedad', 'Soledad', 'Euforia',
  'Ira', 'Nostalgia', 'Curiosidad', 'Vergüenza', 'Orgullo',
]

const QUALITY_LABELS = ['Terrible', 'Malo', 'Normal', 'Bueno', 'Increíble']

const BG_IDS = ['bg-1', 'bg-2', 'bg-3', 'bg-4', 'bg-5', 'bg-6', 'bg-7', 'bg-8', 'bg-9']

export default function DreamFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const today = new Date().toISOString().slice(0, 10)

  const [title,          setTitle]          = useState('')
  const [body,           setBody]           = useState('')
  const [date,           setDate]           = useState(today)
  const [visibility,     setVisibility]     = useState<Visibility>(user?.default_visibility ?? 'private')
  const [isLucid,        setIsLucid]        = useState(false)
  const [quality,        setQuality]        = useState<number | null>(null)
  const [tagsRaw,        setTagsRaw]        = useState('')
  const [emotions,       setEmotions]       = useState<string[]>([])
  const [allowComments,  setAllowComments]  = useState(true)
  const [allowWhisper,   setAllowWhisper]   = useState(false)
  const [gridBg,         setGridBg]         = useState<string | null>(() => {
    try { return localStorage.getItem('last-dream-bg') } catch { return null }
  })
  const [showMore,       setShowMore]       = useState(false)
  const [listening,      setListening]      = useState(false)
  const [suggLoading,    setSuggLoading]    = useState(false)
  const recognitionRef = useRef<unknown>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const isEdit = !!id

  // Load existing dream for edit
  const { data: existing } = useQuery({
    queryKey: ['dream', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('dreams').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setTitle(existing.title ?? '')
      setBody(existing.body)
      setDate(existing.dream_date)
      setVisibility(existing.visibility)
      setIsLucid(existing.is_lucid)
      setQuality(existing.sleep_quality)
      setTagsRaw(existing.tags.join(', '))
      setEmotions(existing.emotions)
      setAllowComments(existing.allow_comments)
      setGridBg(existing.grid_bg ?? null)
    }
  }, [existing])

  const payload = () => ({
    title: title.trim() || null,
    body: body.trim(),
    dream_date: date,
    visibility,
    is_lucid: isLucid,
    sleep_quality: quality,
    tags: tagsRaw.split(',').map((t) => t.trim()).filter(Boolean),
    emotions: emotions.map((e) => e.toLowerCase()),
    allow_comments: allowComments,
    allow_whisper: allowWhisper,
    grid_bg: gridBg,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dreams').insert({ user_id: user!.id, ...payload() })
      if (error) throw error
    },
    onSuccess: () => {
      try {
        if (gridBg) localStorage.setItem('last-dream-bg', gridBg)
        else localStorage.removeItem('last-dream-bg')
      } catch {}
      qc.invalidateQueries({ queryKey: ['my-dreams-profile', user?.id] })
      navigate('/perfil')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dreams').update(payload()).eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      try {
        if (gridBg) localStorage.setItem('last-dream-bg', gridBg)
        else localStorage.removeItem('last-dream-bg')
      } catch {}
      qc.invalidateQueries({ queryKey: ['my-dreams-profile', user?.id] })
      qc.invalidateQueries({ queryKey: ['dream', id] })
      navigate('/perfil')
    },
  })

  function toggleEmotion(e: string) {
    setEmotions((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e])
  }

  function startVoice() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return

    if (listening) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(recognitionRef.current as any)?.stop()
      setListening(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'es-ES'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results as unknown[])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join(' ')
      setBody((prev) => prev + (prev ? ' ' : '') + transcript)
    }
    rec.onend = () => setListening(false)
    rec.start()
    recognitionRef.current = rec
    setListening(true)
  }

  async function suggestTitle() {
    // AI title suggestion requires backend — disabled in client-only mode
    void suggLoading
    void setSuggLoading
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const canSave = body.trim().length >= 10

  return (
    <div className="relative min-h-svh flex flex-col" style={{ background: 'rgb(var(--bg-deep))' }}>
      <CosmicBackground />

      {/* Top bar */}
      <header
        className="glass-header sticky top-0 z-30 flex items-center justify-between px-4"
        style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: 12 }}
      >
        <button
          onClick={() => navigate(-1)}
          className="text-white/50 hover:text-white/80 transition-colors flex items-center gap-1.5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          <span className="text-sm">Atrás</span>
        </button>

        <h1 className="text-base font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
          {isEdit ? 'Editar sueño' : 'Nuevo sueño'}
        </h1>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          disabled={!canSave || isPending}
          onClick={() => isEdit ? updateMutation.mutate() : createMutation.mutate()}
          className="glass-btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {isPending ? '...' : isEdit ? 'Guardar' : 'Guardar sueño'}
        </motion.button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-8 relative z-10" style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>

        {/* Body — main field */}
        <div className="mb-4 relative">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-white/40">Tu sueño</label>
            <button
              type="button"
              onClick={startVoice}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full transition-all"
              style={{
                background: listening ? 'rgba(232,88,88,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${listening ? 'rgba(232,88,88,0.3)' : 'rgba(255,255,255,0.07)'}`,
                color: listening ? '#E85858' : 'rgba(255,255,255,0.4)',
              }}
            >
              <MicIcon active={listening} />
              {listening ? 'Escuchando...' : 'Dictar'}
            </button>
          </div>
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribe lo que soñaste esta noche…"
            rows={8}
            className="glass-input px-4 py-3.5 text-[14px] leading-relaxed resize-none"
            style={{ fontFamily: 'var(--font-serif)', minHeight: 180 }}
          />
        </div>

        {/* Title */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-white/40">Título (opcional)</label>
            <button
              type="button"
              onClick={suggestTitle}
              disabled={!body.trim() || suggLoading}
              className="text-[11px] px-2.5 py-1 rounded-full transition-all disabled:opacity-30"
              style={{
                background: 'rgba(var(--glow), 0.12)',
                border: '1px solid rgba(var(--glow), 0.2)',
                color: `hsl(var(--accent-h), var(--accent-s), 76%)`,
              }}
            >
              {suggLoading ? '...' : '✨ Sugerir título'}
            </button>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Dale un nombre a este sueño"
            className="glass-input px-4 py-3 text-sm"
          />
        </div>

        {/* Date + Quality row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-white/40 mb-2">Fecha</label>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="glass-input px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/40 mb-2">
              Calidad {quality != null && `— ${QUALITY_LABELS[quality - 1]}`}
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuality(quality === n ? null : n)}
                  className="flex-1 text-center text-lg transition-all"
                  style={{
                    color: quality != null && n <= quality
                      ? `hsl(var(--accent-h), var(--accent-s), 76%)`
                      : 'rgba(255,255,255,0.2)',
                    transform: quality === n ? 'scale(1.15)' : 'scale(1)',
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Visibility */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-white/40 mb-2">Visibilidad</label>
          <div className="flex gap-2">
            {VISIBILITIES.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setVisibility(value)}
                className="flex-1 py-2.5 text-xs font-medium rounded-xl transition-all"
                style={{
                  background: visibility === value ? 'rgba(var(--glow), 0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${visibility === value ? 'rgba(var(--glow), 0.3)' : 'rgba(255,255,255,0.07)'}`,
                  color: visibility === value ? `hsl(var(--accent-h), var(--accent-s), 80%)` : 'rgba(255,255,255,0.45)',
                }}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {/* Lucid toggle */}
        <div className="glass-card px-4 py-3.5 mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">¿Fue lúcido?</p>
            <p className="text-[11px] text-white/35 mt-0.5">Tuviste consciencia dentro del sueño</p>
          </div>
          <button
            type="button"
            onClick={() => setIsLucid((v) => !v)}
            className="shrink-0 w-12 h-6 rounded-full transition-all relative"
            style={{ background: isLucid ? 'rgba(100,212,184,0.55)' : 'rgba(255,255,255,0.12)' }}
            role="switch"
            aria-checked={isLucid}
          >
            <motion.div
              layout
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
              style={{ left: isLucid ? 26 : 4 }}
            />
          </button>
        </div>

        {/* Background picker */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-white/40 mb-2">Fondo de la tarjeta</label>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button
              type="button"
              onClick={() => setGridBg(null)}
              className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: `2px solid ${!gridBg ? 'rgba(var(--glow-color), 0.7)' : 'rgba(255,255,255,0.1)'}`,
                boxShadow: !gridBg ? '0 0 10px rgba(var(--glow-color),0.3)' : 'none',
              }}
            >
              <span className="text-white/30 text-base">✕</span>
            </button>
            {BG_IDS.map((bgId) => (
              <button
                key={bgId}
                type="button"
                onClick={() => setGridBg(bgId)}
                className="shrink-0 w-14 h-14 rounded-xl overflow-hidden transition-all"
                style={{
                  backgroundImage: `url(/grid-bg/${bgId}.png)`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: `2px solid ${gridBg === bgId ? 'rgba(var(--glow-color), 0.8)' : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: gridBg === bgId ? '0 0 12px rgba(var(--glow-color),0.4)' : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* More details toggle */}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="w-full py-2.5 text-xs font-medium text-white/40 hover:text-white/65 transition-colors flex items-center justify-center gap-1.5 mb-2"
        >
          <span>{showMore ? '▲' : '▼'}</span>
          {showMore ? 'Menos detalles' : 'Más detalles'}
        </button>

        <AnimatePresence>
          {showMore && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 overflow-hidden"
            >
              {/* Emotions */}
              <div>
                <label className="block text-xs font-medium text-white/40 mb-2">Emociones</label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => toggleEmotion(e)}
                      className="text-[11px] px-2.5 py-1 rounded-full transition-all"
                      style={{
                        background: emotions.includes(e) ? 'rgba(var(--glow), 0.2)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${emotions.includes(e) ? 'rgba(var(--glow), 0.3)' : 'rgba(255,255,255,0.07)'}`,
                        color: emotions.includes(e) ? `hsl(var(--accent-h), var(--accent-s), 80%)` : 'rgba(255,255,255,0.45)',
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-white/40 mb-2">Etiquetas</label>
                <input
                  type="text"
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder="volar, agua, casa — separadas por coma"
                  className="glass-input px-4 py-2.5 text-sm"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>

              {/* Toggles */}
              <div className="glass-card px-4 py-3.5 space-y-3">
                <Toggle
                  label="Permitir comentarios"
                  checked={allowComments}
                  onChange={setAllowComments}
                />
                {visibility === 'public' && (
                  <Toggle
                    label="Publicar como susurro"
                    description="También aparecerá en el feed anónimo"
                    checked={allowWhisper}
                    onChange={setAllowWhisper}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {(createMutation.isError || updateMutation.isError) && (
          <p className="text-xs text-center mt-4 px-3 py-2.5 rounded-xl"
             style={{ background: 'rgba(232,88,88,0.1)', color: '#E85858' }}>
            Error al guardar. Intenta de nuevo.
          </p>
        )}
      </div>
    </div>
  )
}

function Toggle({ label, description, checked, onChange }: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/65 font-medium">{label}</p>
        {description && <p className="text-[11px] text-white/30 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="shrink-0 w-11 h-6 rounded-full transition-all relative"
        style={{ background: checked ? 'rgba(var(--glow), 0.55)' : 'rgba(255,255,255,0.12)' }}
      >
        <motion.div
          layout
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
          style={{ left: checked ? 22 : 4 }}
        />
      </button>
    </div>
  )
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      {!active && <line x1="8" y1="23" x2="16" y2="23"/>}
    </svg>
  )
}
