import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { dreamsApi, pollApi, friendsApi } from '../../lib/queries'
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
  { value: 'public',  label: 'Público', icon: '🌐' },
]

export function DreamForm({ dream, onClose }: DreamFormProps) {
  const qc      = useQueryClient()
  const today   = new Date().toISOString().slice(0, 10)

  // Dream fields
  const [title,          setTitle]          = useState(dream?.title ?? '')
  const [body,           setBody]           = useState(dream?.body ?? '')
  const [date,           setDate]           = useState(dream?.dream_date ?? today)
  const [visibility,     setVisibility]     = useState<Visibility>(dream?.visibility ?? 'private')
  const [isLucid,        setIsLucid]        = useState(dream?.is_lucid ?? false)
  const [quality,        setQuality]        = useState<number | ''>(dream?.sleep_quality ?? '')
  const [tagsInput,      setTagsInput]      = useState(dream?.tags.join(', ') ?? '')
  const [emotionsInput,  setEmotionsInput]  = useState(dream?.emotions.join(', ') ?? '')
  const [allowComments,  setAllowComments]  = useState(dream?.allow_comments ?? true)

  // Dictate
  const [listening,    setListening]    = useState(false)
  const [interimText,  setInterimText]  = useState('')
  const [dictateError, setDictateError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Friend tagging
  const [taggedFriends, setTaggedFriends] = useState<string[]>(
    (dream as Dream & { tagged_user_ids?: string[] })?.tagged_user_ids ?? []
  )
  const { data: friendsList = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.list().then(r => r.data),
  })
  const acceptedFriends = friendsList.filter(f => f.status === 'accepted')

  // Poll (only for new dreams)
  const [pollEnabled,  setPollEnabled]  = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions,  setPollOptions]  = useState(['', ''])

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Dictate ──────────────────────────────────────────────────
  function startVoice() {
    setDictateError(null)
    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) { setDictateError('Tu navegador no soporta dictado por voz'); return }

    const rec = new SR()
    rec.lang            = 'es-ES'
    rec.continuous      = true
    rec.interimResults  = true
    rec.maxAlternatives = 1

    rec.onresult = (e) => {
      let final = '', interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t + ' '
        else interim += t
      }
      if (final.trim()) setBody(b => b + (b.trim() ? ' ' : '') + final.trim())
      setInterimText(interim)
    }

    rec.onerror = (e) => {
      if ((e as SpeechRecognitionErrorEvent).error === 'no-speech') return
      if ((e as SpeechRecognitionErrorEvent).error === 'not-allowed') setDictateError('Permiso de micrófono denegado')
      setListening(false); setInterimText('')
    }

    rec.onend = () => { setListening(false); setInterimText('') }
    rec.start()
    recognitionRef.current = rec
    setListening(true)
  }

  function stopVoice() {
    recognitionRef.current?.stop()
    setListening(false); setInterimText('')
  }

  // ── Poll helpers ──────────────────────────────────────────────
  function addOption() {
    if (pollOptions.length < 4) setPollOptions(o => [...o, ''])
  }

  function removeOption(i: number) {
    setPollOptions(o => o.filter((_, idx) => idx !== i))
  }

  function updateOption(i: number, val: string) {
    setPollOptions(o => o.map((v, idx) => idx === i ? val : v))
  }

  // ── Submit ────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitError(null)
    setSubmitting(true)
    stopVoice()

    try {
      const tags     = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      const emotions = emotionsInput.split(',').map(t => t.trim()).filter(Boolean)
      const payload  = {
        title: title || undefined, body, dream_date: date,
        visibility, is_lucid: isLucid,
        sleep_quality: quality !== '' ? Number(quality) : undefined,
        tags, emotions, allow_comments: allowComments,
        tagged_user_ids: taggedFriends.length ? taggedFriends : undefined,
      }

      let dreamId = dream?.id
      if (dream) {
        await dreamsApi.update(dream.id, payload)
      } else {
        const res = await dreamsApi.create(payload)
        dreamId = (res.data as { id: string }).id

        // Create poll if enabled
        if (pollEnabled && pollQuestion.trim() && dreamId) {
          const validOpts = pollOptions.map(o => o.trim()).filter(Boolean)
          if (validOpts.length >= 2) {
            await pollApi.create(dreamId, { question: pollQuestion.trim(), options: validOpts })
          }
        }
      }

      qc.invalidateQueries({ queryKey: ['dreams'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      onClose()
    } catch {
      setSubmitError('Error al guardar. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Título (opcional)"
        placeholder="El puente infinito…"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      {/* Body + dictate */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-300 font-medium">Cuéntame tu sueño *</label>
          <button
            type="button"
            onClick={listening ? stopVoice : startVoice}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              listening
                ? 'bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse'
                : 'bg-white/6 text-slate-400 hover:text-white border border-white/8'
            }`}
          >
            {listening
              ? <><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Detener dictado</>
              : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg> Dictar</>
            }
          </button>
        </div>

        <textarea
          required
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={7}
          placeholder="Describe tu sueño con todo el detalle que recuerdes…"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-dream-400 resize-none transition-colors"
        />

        {/* Live interim text */}
        {interimText && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white/4 border border-white/8">
            <span className="text-[10px] text-white/30 mt-0.5 shrink-0 animate-pulse">🎙</span>
            <p className="text-xs text-white/40 italic leading-relaxed">{interimText}…</p>
          </div>
        )}
        {dictateError && <p className="text-xs text-red-400/80">{dictateError}</p>}
        {listening && !interimText && (
          <p className="text-[10px] text-white/25 text-center">Escuchando… habla claro en español</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Fecha del sueño"
          type="date"
          value={date}
          max={today}
          onChange={e => setDate(e.target.value)}
          required
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm text-slate-300 font-medium">Calidad del descanso</label>
          <div className="flex gap-1 pt-1">
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button"
                onClick={() => setQuality(quality === n ? '' : n)}
                className={`text-xl transition-colors ${Number(quality) >= n ? 'text-yellow-400' : 'text-slate-700 hover:text-slate-500'}`}>
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
          {VISIBILITIES.map(v => (
            <button key={v.value} type="button" onClick={() => setVisibility(v.value)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                visibility === v.value
                  ? 'bg-dream-700/60 border-dream-500 text-white'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      <Input
        label="Emociones (separadas por coma)"
        placeholder="miedo, curiosidad, alegría…"
        value={emotionsInput}
        onChange={e => setEmotionsInput(e.target.value)}
      />

      <Input
        label="Etiquetas (separadas por coma)"
        placeholder="agua, vuelo, laberinto…"
        value={tagsInput}
        onChange={e => setTagsInput(e.target.value)}
      />

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={isLucid} onChange={e => setIsLucid(e.target.checked)}
          className="w-4 h-4 accent-dream-500" />
        <span className="text-sm text-slate-300">Fue un sueño lúcido</span>
      </label>

      {/* Allow comments toggle */}
      <label className="flex items-center justify-between gap-2 cursor-pointer select-none px-3 py-2.5 rounded-xl bg-white/4 border border-white/8">
        <div>
          <p className="text-sm text-white/70 font-medium">Permitir comentarios</p>
          <p className="text-[11px] text-white/30">Otros usuarios podrán comentar este sueño</p>
        </div>
        <div onClick={() => setAllowComments(v => !v)}
          className={`w-10 h-6 rounded-full transition-colors relative ${allowComments ? 'bg-[rgba(var(--glow-color),0.6)]' : 'bg-white/15'}`}>
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${allowComments ? 'left-5' : 'left-1'}`} />
        </div>
      </label>

      {/* Poll creator — only for new dreams when comments are on */}
      {allowComments && !dream && (
        <div className="rounded-xl bg-white/4 border border-white/8 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5">
            <div>
              <p className="text-sm text-white/70 font-medium">📊 Añadir encuesta</p>
              <p className="text-[11px] text-white/30">Los lectores podrán votar entre tus opciones</p>
            </div>
            <div
              onClick={() => setPollEnabled(v => !v)}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${pollEnabled ? 'bg-[rgba(var(--glow-color),0.6)]' : 'bg-white/15'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${pollEnabled ? 'left-5' : 'left-1'}`} />
            </div>
          </div>

          {pollEnabled && (
            <div className="px-3 pb-3 border-t border-white/8 pt-3 flex flex-col gap-2.5 animate-fade-in">
              <input
                value={pollQuestion}
                onChange={e => setPollQuestion(e.target.value)}
                placeholder="¿Cuál fue la parte más extraña?"
                maxLength={200}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
              <div className="flex flex-col gap-2">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[11px] text-white/30 w-4 text-right shrink-0">{i + 1}.</span>
                    <input
                      value={opt}
                      onChange={e => updateOption(i, e.target.value)}
                      placeholder={`Opción ${i + 1}`}
                      maxLength={100}
                      className="flex-1 bg-white/5 border border-white/8 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                    {i >= 2 && (
                      <button type="button" onClick={() => removeOption(i)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {pollOptions.length < 4 && (
                <button type="button" onClick={addOption}
                  className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors py-1">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Añadir opción
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Friend tagging ── */}
      {(
        <div className="rounded-xl bg-white/4 border border-white/8 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5">
            <div>
              <p className="text-sm text-white/70 font-medium">👁️ ¿Soñaste con alguien?</p>
              <p className="text-[11px] text-white/30">Etiqueta amigos que aparecieron en tu sueño</p>
            </div>
            {taggedFriends.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full accent-text"
                style={{ background: 'rgba(var(--glow-color),0.15)', border: '1px solid rgba(var(--glow-color),0.3)' }}>
                {taggedFriends.length}
              </span>
            )}
          </div>
          <div className="px-3 pb-3 border-t border-white/8 pt-2 flex flex-wrap gap-2">
            {acceptedFriends.length === 0 && (
              <p className="text-xs text-white/25 italic">Aún no tienes amigos — añade amigos para etiquetarlos aquí</p>
            )}
            {acceptedFriends.map(f => {
              const selected = taggedFriends.includes(f.id)
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTaggedFriends(prev =>
                    selected ? prev.filter(id => id !== f.id) : [...prev, f.id]
                  )}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    selected
                      ? 'text-white border'
                      : 'text-white/40 bg-white/4 border border-white/8 hover:bg-white/8 hover:text-white/70'
                  }`}
                  style={selected ? {
                    background: 'rgba(var(--glow-color),0.2)',
                    border: '1px solid rgba(var(--glow-color),0.4)',
                    boxShadow: '0 0 8px rgba(var(--glow-color),0.15)',
                  } : undefined}
                >
                  {f.avatar_url
                    ? <img src={f.avatar_url} className="w-4 h-4 rounded-full object-cover" alt="" />
                    : <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                        style={{ background: 'rgba(var(--glow-color),0.5)' }}>
                        {f.name[0]?.toUpperCase()}
                      </div>
                  }
                  {f.name}
                  {selected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {submitError && <p className="text-sm text-red-400">{submitError}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button type="submit" loading={submitting} className="flex-1">
          {dream ? 'Guardar cambios' : 'Añadir sueño'}
        </Button>
      </div>
    </form>
  )
}
