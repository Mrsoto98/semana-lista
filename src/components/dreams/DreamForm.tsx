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
  { value: 'public',  label: 'Público', icon: '🌐' },
]

function Toggle({ checked, onChange, label, description }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/70 font-medium">{label}</p>
        {description && <p className="text-[11px] text-white/30 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`shrink-0 w-11 h-6 rounded-full transition-all relative ${
          checked ? 'bg-[rgba(var(--glow-color),0.6)]' : 'bg-white/15'
        }`}
      >
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
          checked ? 'left-6' : 'left-1'
        }`} />
      </button>
    </div>
  )
}

export function DreamForm({ dream, onClose }: DreamFormProps) {
  const qc    = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const [title,         setTitle]         = useState(dream?.title ?? '')
  const [body,          setBody]          = useState(dream?.body ?? '')
  const [date,          setDate]          = useState(dream?.dream_date ?? today)
  const [visibility,    setVisibility]    = useState<Visibility>(dream?.visibility ?? 'private')
  const [isLucid,       setIsLucid]       = useState(dream?.is_lucid ?? false)
  const [quality,       setQuality]       = useState<number | ''>(dream?.sleep_quality ?? '')
  const [tagsInput,     setTagsInput]     = useState(dream?.tags.join(', ') ?? '')
  const [emotionsInput, setEmotionsInput] = useState(dream?.emotions.join(', ') ?? '')
  const [allowComments, setAllowComments] = useState(dream?.allow_comments ?? true)
  const [showMore,      setShowMore]      = useState(false)

  // Voice dictation
  const [listening,    setListening]    = useState(false)
  const [interimText,  setInterimText]  = useState('')
  const [dictateError, setDictateError] = useState<string | null>(null)
  const recognitionRef = useRef<unknown>(null)

  // Friend tagging
  const [taggedFriends, setTaggedFriends] = useState<string[]>(
    (dream as Dream & { tagged_user_ids?: string[] })?.tagged_user_ids ?? []
  )
  const { data: friendsList = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.list().then(r => r.data),
  })
  const acceptedFriends = friendsList.filter(f => f.status === 'accepted')

  // Poll
  const [pollEnabled,  setPollEnabled]  = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions,  setPollOptions]  = useState(['', ''])

  const [submitting,  setSubmitting]  = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function startVoice() {
    setDictateError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) { setDictateError('Tu navegador no soporta dictado por voz'); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any
    rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let final = '', interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t + ' '
        else interim += t
      }
      if (final.trim()) setBody((b: string) => b + (b.trim() ? ' ' : '') + final.trim())
      setInterimText(interim)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') setDictateError('Permiso de micrófono denegado')
      setListening(false); setInterimText('')
    }
    rec.onend = () => { setListening(false); setInterimText('') }
    rec.start()
    recognitionRef.current = rec
    setListening(true)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function stopVoice() { (recognitionRef.current as any)?.stop(); setListening(false); setInterimText('') }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitError(null); setSubmitting(true); stopVoice()
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
        if (pollEnabled && pollQuestion.trim() && dreamId) {
          const validOpts = pollOptions.map(o => o.trim()).filter(Boolean)
          if (validOpts.length >= 2) await pollApi.create(dreamId, { question: pollQuestion.trim(), options: validOpts })
        }
      }
      qc.invalidateQueries({ queryKey: ['dreams'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['my-dreams-profile'] })
      onClose()
    } catch {
      setSubmitError('Error al guardar. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* ── Body (main field) ── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
            Tu sueño *
          </label>
          <button
            type="button"
            onClick={listening ? stopVoice : startVoice}
            className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-all ${
              listening
                ? 'bg-red-500/15 text-red-300 border border-red-500/25 animate-pulse'
                : 'glass-btn-secondary text-white/50 hover:text-white/80'
            }`}
          >
            {listening ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> Detener</>
            ) : (
              <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
              </svg> Dictar</>
            )}
          </button>
        </div>
        <textarea
          required
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={6}
          placeholder="Describe tu sueño con todo el detalle que recuerdes…"
          className="glass-input w-full rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 resize-none"
        />
        {interimText && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/4 border border-white/8">
            <span className="text-[10px] text-white/30 mt-0.5 shrink-0 animate-pulse">🎙</span>
            <p className="text-xs text-white/40 italic leading-relaxed">{interimText}…</p>
          </div>
        )}
        {dictateError && <p className="text-xs text-red-400/80">{dictateError}</p>}
        {listening && !interimText && (
          <p className="text-[10px] text-white/25 text-center">Escuchando… habla claro en español</p>
        )}
      </div>

      {/* ── Title ── */}
      <Input
        label="Título (opcional)"
        placeholder="El puente infinito…"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      {/* ── Date + Quality ── */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Fecha"
          type="date"
          value={date}
          max={today}
          onChange={e => setDate(e.target.value)}
          required
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Descanso</span>
          <div className="flex gap-1 pt-1.5">
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button"
                aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
                onClick={() => setQuality(quality === n ? '' : n)}
                className={`text-xl transition-all ${Number(quality) >= n ? 'accent-text drop-shadow-sm' : 'text-white/15 hover:text-white/35'}`}>
                ★
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Lucid + Visibility ── */}
      <div className="glass rounded-2xl p-3.5 flex flex-col gap-3">
        {/* Lucid toggle */}
        <Toggle
          checked={isLucid}
          onChange={setIsLucid}
          label="✦ Sueño lúcido"
          description="Fui consciente de que estaba soñando"
        />

        <div className="h-px bg-white/6" />

        {/* Visibility */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] text-white/40 uppercase tracking-wider font-medium">Visibilidad</span>
          <div className="flex gap-2">
            {VISIBILITIES.map(v => (
              <button key={v.value} type="button" onClick={() => setVisibility(v.value)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all border ${
                  visibility === v.value
                    ? 'glass-nav-active text-white border-transparent'
                    : 'text-white/40 bg-white/4 border-white/8 hover:text-white/70 hover:bg-white/8'
                }`}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── More options collapsible ── */}
      <button
        type="button"
        onClick={() => setShowMore(v => !v)}
        className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-2xl bg-white/4 border border-white/8 text-sm text-white/50 hover:text-white/70 hover:bg-white/6 transition-all"
      >
        <span className="font-medium">Más opciones</span>
        <div className="flex items-center gap-2">
          {(tagsInput || emotionsInput || taggedFriends.length > 0) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold accent-text"
              style={{ background: 'rgba(var(--glow-color),0.15)' }}>
              {[tagsInput, emotionsInput, taggedFriends.length > 0].filter(Boolean).length}
            </span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className={`transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </button>

      {showMore && (
        <div className="flex flex-col gap-3 animate-fade-in">
          <Input
            label="Emociones"
            placeholder="miedo, curiosidad, alegría…"
            value={emotionsInput}
            onChange={e => setEmotionsInput(e.target.value)}
          />
          <Input
            label="Etiquetas"
            placeholder="agua, vuelo, laberinto…"
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
          />

          {/* Allow comments + Poll */}
          <div className="glass rounded-2xl p-3.5 flex flex-col gap-3">
            <Toggle
              checked={allowComments}
              onChange={setAllowComments}
              label="Permitir comentarios"
            />

            {allowComments && !dream && (
              <>
                <div className="h-px bg-white/6" />
                <Toggle
                  checked={pollEnabled}
                  onChange={setPollEnabled}
                  label="📊 Añadir encuesta"
                  description="Los lectores podrán votar entre tus opciones"
                />
                {pollEnabled && (
                  <div className="flex flex-col gap-2 pt-1 animate-fade-in">
                    <input
                      value={pollQuestion}
                      onChange={e => setPollQuestion(e.target.value)}
                      placeholder="¿Cuál fue la parte más extraña?"
                      maxLength={200}
                      className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25"
                    />
                    <div className="flex flex-col gap-2">
                      {pollOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[11px] text-white/25 w-4 text-right shrink-0">{i + 1}.</span>
                          <input
                            value={opt}
                            onChange={e => setPollOptions(o => o.map((v, idx) => idx === i ? e.target.value : v))}
                            placeholder={`Opción ${i + 1}`}
                            maxLength={100}
                            className="glass-input flex-1 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20"
                          />
                          {i >= 2 && (
                            <button type="button" onClick={() => setPollOptions(o => o.filter((_, idx) => idx !== i))}
                              aria-label="Eliminar opción"
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
                      <button type="button" onClick={() => setPollOptions(o => [...o, ''])}
                        className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors py-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Añadir opción
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Friend tagging */}
          {acceptedFriends.length > 0 && (
            <div className="glass rounded-2xl p-3.5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] text-white/40 uppercase tracking-wider font-medium">👁️ ¿Soñaste con alguien?</span>
                {taggedFriends.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold accent-text ml-auto"
                    style={{ background: 'rgba(var(--glow-color),0.15)' }}>
                    {taggedFriends.length}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {acceptedFriends.map(f => {
                  const selected = taggedFriends.includes(f.id)
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTaggedFriends(prev =>
                        selected ? prev.filter(id => id !== f.id) : [...prev, f.id]
                      )}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                        selected ? 'text-white border-transparent' : 'text-white/40 bg-white/4 border-white/8 hover:text-white/70'
                      }`}
                      style={selected ? {
                        background: 'rgba(var(--glow-color),0.2)',
                        border: '1px solid rgba(var(--glow-color),0.4)',
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
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {submitError && <p className="text-sm text-red-400/80">{submitError}</p>}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button type="submit" loading={submitting} className="flex-1 py-3">
          {dream ? 'Guardar cambios' : 'Añadir sueño'}
        </Button>
      </div>
    </form>
  )
}
