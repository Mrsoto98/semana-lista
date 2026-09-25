import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { drawerVariants, overlayVariants } from '../../lib/motion'

const EMOTION_OPTIONS = [
  'Miedo', 'Tristeza', 'Alegría', 'Asombro', 'Confusión',
  'Paz', 'Amor', 'Ansiedad', 'Soledad', 'Euforia',
]

interface Props {
  dreamBody?: string
  dreamId?: string
  onClose: () => void
  onCreated: () => void
}

export function WhisperCompose({ dreamBody, dreamId, onClose, onCreated }: Props) {
  const user = useAuthStore(s => s.user)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState(dreamBody ?? '')
  const [emotions, setEmotions] = useState<string[]>([])
  const maxLen = 2000

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No autenticado')
      const { error } = await supabase.from('whispers').insert({
        user_id: user.id,
        title: title.trim() || null,
        body: body.trim(),
        emotions: emotions.map((e) => e.toLowerCase()),
        dream_id: dreamId ?? null,
      })
      if (error) throw error
    },
    onSuccess: onCreated,
  })

  function toggleEmotion(e: string) {
    setEmotions((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]
    )
  }

  return (
    <>
      {/* Overlay */}
      <motion.div
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-[70]"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        variants={drawerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed bottom-0 left-0 right-0 z-[71] glass rounded-t-[28px] px-6 pt-6"
        style={{ maxHeight: '90svh', overflowY: 'auto', paddingBottom: 'calc(24px + 72px + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.15)' }} />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>Nuevo susurro</h2>
            <p className="text-xs text-white/35 mt-0.5">Anónimo · solo tu sueño</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Title (optional) */}
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value.slice(0, 100))}
          placeholder="Título (opcional)…"
          className="glass-input w-full px-4 py-3 text-[14px] mb-3"
        />

        {/* Textarea */}
        <div className="relative mb-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, maxLen))}
            placeholder="Escribe tu sueño aquí… Solo las palabras importan."
            rows={6}
            className="glass-input px-4 py-3 text-[14px] leading-relaxed resize-none"
            style={{ fontFamily: 'var(--font-serif)' }}
          />
          <span
            className="absolute bottom-2.5 right-3 text-[10px]"
            style={{ color: body.length > maxLen * 0.9 ? '#E85858' : 'rgba(255,255,255,0.25)' }}
          >
            {body.length}/{maxLen}
          </span>
        </div>

        {/* Emotions */}
        <p className="text-xs font-medium text-white/40 mb-2">Emociones (opcional)</p>
        <div className="flex flex-wrap gap-1.5 mb-5">
          {EMOTION_OPTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => toggleEmotion(e)}
              className="text-[11px] px-2.5 py-1 rounded-full transition-all duration-150"
              style={{
                background: emotions.includes(e) ? 'rgba(184,164,232,0.22)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${emotions.includes(e) ? 'rgba(184,164,232,0.4)' : 'rgba(255,255,255,0.07)'}`,
                color: emotions.includes(e) ? '#B8A4E8' : 'rgba(255,255,255,0.45)',
              }}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Submit */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          disabled={body.trim().length < 10 || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="glass-btn-primary w-full py-3 text-sm font-semibold disabled:opacity-40"
        >
          {mutation.isPending ? 'Susurrando...' : 'Susurrar al vacío ✦'}
        </motion.button>

        {mutation.isError && (
          <p className="text-xs text-center mt-2" style={{ color: '#E85858' }}>
            Error al publicar. Intenta de nuevo.
          </p>
        )}
      </motion.div>
    </>
  )
}
