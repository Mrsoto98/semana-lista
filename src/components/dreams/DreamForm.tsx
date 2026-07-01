import { useState, useRef } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { dreamsApi } from '../../lib/queries'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { Dream, Visibility } from '../../types'

interface DreamFormProps {
  dream?: Dream
  onClose: () => void
}

const VISIBILITIES: { value: Visibility; label: string; icon: string }[] = [
  { value: 'private', label: 'Privado', icon: '🔒' },
  { value: 'friends', label: 'Amigos', icon: '👥' },
  { value: 'public', label: 'Público', icon: '🌐' },
]

export function DreamForm({ dream, onClose }: DreamFormProps) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const [title, setTitle] = useState(dream?.title ?? '')
  const [body, setBody] = useState(dream?.body ?? '')
  const [date, setDate] = useState(dream?.dream_date ?? today)
  const [visibility, setVisibility] = useState<Visibility>(dream?.visibility ?? 'private')
  const [isLucid, setIsLucid] = useState(dream?.is_lucid ?? false)
  const [quality, setQuality] = useState<number | ''>(dream?.sleep_quality ?? '')
  const [tagsInput, setTagsInput] = useState(dream?.tags.join(', ') ?? '')
  const [emotionsInput, setEmotionsInput] = useState(dream?.emotions.join(', ') ?? '')
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const mutation = useMutation({
    mutationFn: (data: Partial<Dream>) =>
      dream ? dreamsApi.update(dream.id, data) : dreamsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dreams'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      onClose()
    },
  })

  function startVoice() {
    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return alert('Tu navegador no soporta dictado por voz')

    const rec = new SR()
    rec.lang = 'es-ES'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join(' ')
      setBody((b) => b + (b ? ' ' : '') + text)
    }
    rec.onend = () => setListening(false)
    rec.start()
    recognitionRef.current = rec
    setListening(true)
  }

  function stopVoice() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
    const emotions = emotionsInput.split(',').map((t) => t.trim()).filter(Boolean)
    mutation.mutate({
      title: title || undefined,
      body,
      dream_date: date,
      visibility,
      is_lucid: isLucid,
      sleep_quality: quality !== '' ? Number(quality) : undefined,
      tags,
      emotions,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Título (opcional)"
        placeholder="El puente infinito…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-300 font-medium">Cuéntame tu sueño *</label>
          <button
            type="button"
            onClick={listening ? stopVoice : startVoice}
            className={`text-xs px-2 py-1 rounded-md transition-all ${listening ? 'bg-red-500/20 text-red-300 animate-pulse' : 'bg-white/5 text-slate-400 hover:text-white'}`}
          >
            {listening ? '⏹ Detener' : '🎙 Dictar'}
          </button>
        </div>
        <textarea
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          placeholder="Describe tu sueño con todo el detalle que recuerdes…"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-dream-400 resize-none transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Fecha del sueño"
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm text-slate-300 font-medium">Calidad del descanso</label>
          <div className="flex gap-1 pt-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setQuality(quality === n ? '' : n)}
                className={`text-xl transition-colors ${Number(quality) >= n ? 'text-yellow-400' : 'text-slate-700 hover:text-slate-500'}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Visibility */}
      <div className="flex flex-col gap-2">
        <label className="text-sm text-slate-300 font-medium">Visibilidad</label>
        <div className="flex gap-2">
          {VISIBILITIES.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setVisibility(v.value)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                visibility === v.value
                  ? 'bg-dream-700/60 border-dream-500 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      <Input
        label="Emociones (separadas por coma)"
        placeholder="miedo, curiosidad, alegría…"
        value={emotionsInput}
        onChange={(e) => setEmotionsInput(e.target.value)}
      />

      <Input
        label="Etiquetas (separadas por coma)"
        placeholder="agua, vuelo, laberinto…"
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
      />

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isLucid}
          onChange={(e) => setIsLucid(e.target.checked)}
          className="w-4 h-4 accent-dream-500"
        />
        <span className="text-sm text-slate-300">Fue un sueño lúcido</span>
      </label>

      {mutation.isError && (
        <p className="text-sm text-red-400">Error al guardar. Inténtalo de nuevo.</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" loading={mutation.isPending} className="flex-1">
          {dream ? 'Guardar cambios' : 'Añadir sueño'}
        </Button>
      </div>
    </form>
  )
}
