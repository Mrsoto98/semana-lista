import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  saveRecording, getAllRecordings, deleteRecording,
  formatDuration, formatSize,
  type AudioRecording, type AudioSegment,
} from '../lib/audioDB'

type State = 'idle' | 'listening' | 'recording' | 'saving'

const SILENCE_MS   = 4000
const MIN_DURATION = 1.5
const FFT_SIZE     = 2048
const CLASSIFY_MS  = 500
const BAR_COUNT    = 38
const MAX_BAR_H    = 72
const CONTAINER_H  = 88

// ── FFT-based classifier ──────────────────────────────────────────────────────
function classifyFrame(
  freqData: Uint8Array,
  sampleRate: number,
): 'snore' | 'talk' | 'noise' | 'quiet' {
  const binHz     = sampleRate / FFT_SIZE
  const snoreLow  = Math.floor(50   / binHz)
  const snoreHigh = Math.floor(500  / binHz)   // extended to 500Hz (snore harmonics)
  const talkLow   = Math.floor(500  / binHz)
  const talkHigh  = Math.floor(3000 / binHz)
  const ceiling   = Math.floor(5000 / binHz)

  let snoreE = 0, talkE = 0, totalE = 0
  for (let i = snoreLow; i < Math.min(snoreHigh, freqData.length); i++) snoreE += freqData[i] ** 2
  for (let i = talkLow;  i < Math.min(talkHigh,  freqData.length); i++) talkE  += freqData[i] ** 2
  for (let i = 1;        i < Math.min(ceiling,    freqData.length); i++) totalE += freqData[i] ** 2

  const rms = Math.sqrt(totalE / freqData.length)
  if (rms < 8) return 'quiet'

  const snoreR = snoreE / (totalE + 1)
  const talkR  = talkE  / (totalE + 1)

  // With background noise (fan etc.) ratios are diluted — compare bands directly:
  // snore wins if low-freq band dominates over mid-freq band
  if (snoreR > 0.28 && snoreE >= talkE * 0.75) return 'snore'
  if (talkR  > 0.58 && talkE  >  snoreE * 1.5) return 'talk'
  return 'noise'
}

function mergeSegments(
  snaps: { time: number; type: AudioSegment['type'] }[],
): AudioSegment[] {
  if (!snaps.length) return []
  const out: AudioSegment[] = []
  let cur = { start: snaps[0].time, end: snaps[0].time + CLASSIFY_MS / 1000, type: snaps[0].type }
  for (let i = 1; i < snaps.length; i++) {
    const s   = snaps[i]
    const end = s.time + CLASSIFY_MS / 1000
    if (s.type === cur.type) { cur.end = end }
    else { out.push(cur); cur = { start: s.time, end, type: s.type } }
  }
  out.push(cur)
  return out
}

// ── WhatsApp-style audio waveform ────────────────────────────────────────────
const BAR_N = 52

function AudioWaveform({
  segments, duration, height = 32, progress = 0, onSeek,
}: {
  segments: AudioSegment[]
  duration: number
  height?: number
  progress?: number   // 0-1 playback position
  onSeek?: (pct: number) => void
}) {
  const bars = useMemo(() => {
    return Array.from({ length: BAR_N }, (_, i) => {
      const t   = (i / BAR_N) * duration
      const seg = segments.find(s => t >= s.start && t < s.end)

      // Deterministic pseudo-random heights (stable across renders)
      const n1 = Math.abs(Math.sin(i * 2.3998 + 1.2))
      const n2 = Math.abs(Math.sin(i * 0.8173 + 3.7))
      const n3 = Math.abs(Math.cos(i * 5.1234 + 0.9))
      const rand = n1 * 0.5 + n2 * 0.3 + n3 * 0.2

      let amp: number
      const type = seg?.type
      if (!type || type === 'quiet') {
        amp = 0.04 + rand * 0.10
      } else if (type === 'noise') {
        amp = 0.08 + rand * 0.18
      } else if (type === 'snore') {
        const phase = ((t % 3) / 3)
        const env   = Math.abs(Math.sin(phase * Math.PI))
        amp = 0.25 + env * 0.38 + rand * 0.37
      } else {
        amp = 0.18 + rand * 0.82
      }

      return { amp: Math.min(1, amp), type: type ?? 'quiet' }
    })
  }, [segments, duration])

  return (
    <div
      className={`relative w-full flex items-center gap-[1.5px] select-none ${onSeek ? 'cursor-pointer' : ''}`}
      style={{ height }}
      onClick={onSeek ? (e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        onSeek((e.clientX - rect.left) / rect.width)
      } : undefined}
    >
      {bars.map(({ amp, type }, i) => {
        const barH   = Math.max(2, amp * height)
        const played = i / BAR_N < progress

        let color: string
        if (type === 'snore') {
          color = played
            ? `rgba(245,158,11,${0.55 + amp * 0.45})`
            : `rgba(245,158,11,${0.22 + amp * 0.28})`
        } else if (type === 'talk') {
          color = played
            ? `rgba(239,68,68,${0.55 + amp * 0.45})`
            : `rgba(239,68,68,${0.22 + amp * 0.28})`
        } else {
          color = played
            ? `rgba(255,255,255,${0.35 + amp * 0.4})`
            : `rgba(255,255,255,${0.08 + amp * 0.14})`
        }

        return (
          <div key={i} className="rounded-full"
            style={{ flex: 1, minWidth: 0, height: `${barH}px`, background: color }} />
        )
      })}

      {/* Playback cursor */}
      {progress > 0 && progress < 1 && (
        <div
          className="absolute top-0 bottom-0 w-0.5 rounded-full pointer-events-none"
          style={{ left: `${progress * 100}%`, background: 'rgba(255,255,255,0.7)' }}
        />
      )}
    </div>
  )
}

// ── Segment timeline bar ──────────────────────────────────────────────────────
function segBg(type: AudioSegment['type']) {
  if (type === 'snore') return 'rgba(245,158,11,0.82)'
  if (type === 'talk')  return 'rgba(239,68,68,0.78)'
  return 'rgba(255,255,255,0.07)'
}

function Timeline({
  segments, duration, height = 12, onSeek,
}: {
  segments: AudioSegment[]
  duration: number
  height?: number
  onSeek?: (pct: number) => void
}) {
  return (
    <div
      className={`flex overflow-hidden rounded-lg ${onSeek ? 'cursor-pointer' : ''}`}
      style={{ height }}
      onClick={onSeek ? (e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        onSeek((e.clientX - rect.left) / rect.width)
      } : undefined}
    >
      {segments.map((seg, i) => {
        const w = ((seg.end - seg.start) / duration) * 100
        return (
          <div key={i} style={{
            width: `${w}%`,
            background: segBg(seg.type),
            minWidth: (seg.type !== 'quiet' && seg.type !== 'noise') ? '2px' : undefined,
          }} />
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Audio() {
  const navigate = useNavigate()
  const [state, setState]               = useState<State>('idle')
  const [sensitivity, setSensitivity]   = useState(18)
  const [volume, setVolume]             = useState(0)
  const [recordings, setRecordings]     = useState<AudioRecording[]>([])
  const [playingId, setPlayingId]       = useState<string | null>(null)
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [playProgress, setPlayProgress] = useState<Record<string, number>>({})
  const [error, setError]               = useState<string | null>(null)
  const [bars, setBars]                 = useState<number[]>(Array(BAR_COUNT).fill(2))
  const [elapsed, setElapsed]           = useState(0)

  const streamRef        = useRef<MediaStream | null>(null)
  const audioCtxRef      = useRef<AudioContext | null>(null)
  const analyserRef      = useRef<AnalyserNode | null>(null)
  const recorderRef      = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const silenceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animFrameRef     = useRef<number>(0)
  const recStartRef      = useRef<number>(0)
  const elapsedTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const classifyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRefs        = useRef<Record<string, HTMLAudioElement>>({})
  const isRecordingRef   = useRef(false)
  const sensitivityRef   = useRef(sensitivity)
  const snapshotsRef     = useRef<{ time: number; type: AudioSegment['type'] }[]>([])
  const sampleRateRef    = useRef(44100)

  useEffect(() => { sensitivityRef.current = sensitivity }, [sensitivity])

  useEffect(() => {
    getAllRecordings().then(setRecordings).catch(console.error)
  }, [])

  // ── Waveform + VAD loop ──
  const animateBars = useCallback(() => {
    if (!analyserRef.current) return
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(data)

    // bars sampled across voice range with slight log spacing for natural look
    setBars(Array.from({ length: BAR_COUNT }, (_, i) => {
      const t   = i / (BAR_COUNT - 1)
      const idx = Math.floor(Math.pow(t, 0.7) * (data.length / 3.5))
      return Math.max(2, (data[Math.min(idx, data.length - 1)] / 255) * MAX_BAR_H)
    }))

    // RMS on first 256 bins for VAD
    const slice = data.slice(0, 256)
    const rms   = Math.sqrt(slice.reduce((s, v) => s + v * v, 0) / slice.length)
    const vol   = Math.min(100, Math.max(0, (rms / 255) * 100))
    setVolume(vol)

    // volThreshold is the same formula used for the visual line — guarantees alignment
    const volThreshold = Math.pow(10, -sensitivityRef.current / 20) * 100
    const triggered    = vol > volThreshold
    if (triggered && !isRecordingRef.current) startRecording()
    if (!triggered && isRecordingRef.current) scheduleSilence()
    if (triggered  && isRecordingRef.current) clearSilenceTimer()

    animFrameRef.current = requestAnimationFrame(animateBars)
  }, []) // eslint-disable-line

  function clearSilenceTimer() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = null
  }

  function scheduleSilence() {
    if (silenceTimerRef.current) return
    silenceTimerRef.current = setTimeout(() => {
      if (isRecordingRef.current) stopRecording()
    }, SILENCE_MS)
  }

  // ── Classify timer (fires every 500 ms during a recording) ──
  function startClassifyTimer() {
    snapshotsRef.current = []
    classifyTimerRef.current = setInterval(() => {
      if (!analyserRef.current) return
      const data = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(data)
      snapshotsRef.current.push({
        time: (Date.now() - recStartRef.current) / 1000,
        type: classifyFrame(data, sampleRateRef.current),
      })
    }, CLASSIFY_MS)
  }

  function stopClassifyTimer() {
    if (classifyTimerRef.current) clearInterval(classifyTimerRef.current)
    classifyTimerRef.current = null
  }

  // ── Recording lifecycle ──
  function startRecording() {
    if (!streamRef.current || isRecordingRef.current) return
    isRecordingRef.current = true
    chunksRef.current      = []
    recStartRef.current    = Date.now()
    setElapsed(0)
    startClassifyTimer()

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm'

    const recorder = new MediaRecorder(streamRef.current, { mimeType })
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = handleRecordingStop
    recorder.start(200)
    recorderRef.current = recorder
    setState('recording')

    elapsedTimerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - recStartRef.current) / 1000))
    }, 1000)
  }

  function stopRecording() {
    if (!recorderRef.current || !isRecordingRef.current) return
    isRecordingRef.current = false
    clearSilenceTimer()
    stopClassifyTimer()
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    recorderRef.current.stop()
    setState('saving')
  }

  async function handleRecordingStop() {
    const duration = (Date.now() - recStartRef.current) / 1000
    if (duration < MIN_DURATION || chunksRef.current.length === 0) {
      setState('listening')
      return
    }
    const blob     = new Blob(chunksRef.current, { type: 'audio/webm' })
    const segments = mergeSegments(snapshotsRef.current)
    const rec: AudioRecording = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      duration,
      size: blob.size,
      blob,
      segments,
    }
    await saveRecording(rec)
    setRecordings(await getAllRecordings())
    setState('listening')
  }

  // ── Microphone init / teardown ──
  async function startListening() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 44100 },
      })
      streamRef.current = stream

      const ctx      = new AudioContext()
      sampleRateRef.current = ctx.sampleRate
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      source.connect(analyser)

      audioCtxRef.current = ctx
      analyserRef.current = analyser

      setState('listening')
      animFrameRef.current = requestAnimationFrame(animateBars)
    } catch {
      setError('No se pudo acceder al micrófono. Permite el acceso en tu navegador.')
    }
  }

  function stopListening() {
    cancelAnimationFrame(animFrameRef.current)
    if (elapsedTimerRef.current)  clearInterval(elapsedTimerRef.current)
    stopClassifyTimer()
    clearSilenceTimer()
    if (recorderRef.current && isRecordingRef.current) {
      recorderRef.current.onstop = null  // discard in-progress clip
      recorderRef.current.stop()
    }
    isRecordingRef.current = false
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    streamRef.current  = null
    audioCtxRef.current = null
    analyserRef.current = null
    recorderRef.current = null
    setBars(Array(BAR_COUNT).fill(2))
    setVolume(0)
    setElapsed(0)
    setState('idle')
  }

  // ── Playback / delete ──
  function ensureSrc(rec: AudioRecording) {
    const el = audioRefs.current[rec.id]
    if (!el) return null
    if (!el.src) el.src = URL.createObjectURL(rec.blob)
    return el
  }

  function togglePlay(rec: AudioRecording) {
    const el = ensureSrc(rec)
    if (!el) return
    if (playingId === rec.id) {
      el.pause(); el.currentTime = 0; setPlayingId(null)
    } else {
      if (playingId) { const prev = audioRefs.current[playingId]; prev?.pause(); if (prev) prev.currentTime = 0 }
      attachListeners(el, rec.id, rec.duration)
      el.play()
      setPlayingId(rec.id)
    }
  }

  function attachListeners(el: HTMLAudioElement, id: string, duration: number) {
    el.ontimeupdate = () => setPlayProgress(p => ({ ...p, [id]: el.currentTime / duration }))
    el.onended = () => { setPlayingId(null); setPlayProgress(p => ({ ...p, [id]: 0 })) }
  }

  function seekTo(rec: AudioRecording, pct: number) {
    const el = ensureSrc(rec)
    if (!el) return
    el.currentTime = pct * rec.duration
    if (playingId !== rec.id) {
      if (playingId) { const prev = audioRefs.current[playingId]; prev?.pause(); if (prev) prev.currentTime = 0 }
      attachListeners(el, rec.id, rec.duration)
      el.play()
      setPlayingId(rec.id)
    }
  }

  async function handleDelete(id: string) {
    await deleteRecording(id)
    const url = audioRefs.current[id]?.src
    if (url) URL.revokeObjectURL(url)
    setRecordings(r => r.filter(x => x.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  // ── Derived state ──
  const active = state === 'listening' || state === 'recording'

  return (
    <div className="animate-fade-in flex flex-col gap-5">

      <div>
        <h2 className="text-lg font-bold text-white">Monitor de sueño</h2>
        <p className="text-xs text-white/35 mt-0.5">Detecta y clasifica ronquidos y habla mientras duermes</p>
      </div>

      {/* ── Técnicas para soñar lúcido ── */}
      <div
        className="glass-card rounded-2xl p-4 cursor-pointer active:scale-[0.99] transition-all"
        onClick={() => navigate('/techniques')}
        style={{ border: '1px solid rgba(var(--glow-color),0.2)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
              style={{ background: 'rgba(var(--glow-color),0.12)', border: '1px solid rgba(var(--glow-color),0.2)' }}>
              🔮
            </div>
            <div>
              <p className="text-sm font-semibold text-white/90">Técnicas para soñar lúcido</p>
              <p className="text-[11px] text-white/40 mt-0.5">WILD · MILD · WBTB con temporizadores</p>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/25 shrink-0">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      </div>

      {/* ── Recorder card ── */}
      <div className="glass rounded-3xl p-5 relative overflow-hidden">
        <div className="absolute inset-0 rounded-3xl pointer-events-none transition-opacity duration-1000"
          style={{ opacity: state === 'recording' ? 0.15 : 0, background: `radial-gradient(circle, rgba(var(--glow-color),1) 0%, transparent 70%)` }} />

        {/* Status row */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-all ${
              state === 'recording' ? 'bg-red-400 animate-pulse' :
              state === 'listening' ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'
            }`} />
            <span className="text-xs font-medium text-white/60">
              {state === 'idle'      && 'Inactivo'}
              {state === 'listening' && 'Escuchando…'}
              {state === 'recording' && `Grabando · ${formatDuration(elapsed)}`}
              {state === 'saving'    && 'Analizando y guardando…'}
            </span>
          </div>
          {state === 'recording' && <span className="text-xs text-red-400 font-semibold animate-pulse">● REC</span>}
        </div>

        {/* Waveform + threshold line */}
        {(() => {
          // same formula as VAD — bars reaching this height = recording will trigger
          const volThreshold = Math.pow(10, -sensitivity / 20) * 100
          const triggerH     = Math.min(CONTAINER_H - 4, (volThreshold / 100) * MAX_BAR_H)
          const recColor    = (alpha: number) => `rgba(248,113,113,${alpha})`
          const glowColor   = (alpha: number) => `rgba(var(--glow-color),${alpha})`
          return (
            <div className="relative flex items-end justify-center gap-px mb-5 z-10 overflow-visible"
              style={{ height: CONTAINER_H }}>

              {/* Threshold line */}
              <div
                className="absolute left-0 right-0 flex items-center gap-1.5 pointer-events-none transition-all duration-200"
                style={{ bottom: `${triggerH}px` }}
              >
                <div className="flex-1 h-px transition-colors duration-200"
                  style={{ background: active ? `rgba(var(--glow-color),0.45)` : 'rgba(255,255,255,0.12)' }} />
                <span
                  className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 transition-all duration-200"
                  style={{
                    background: active ? `rgba(var(--glow-color),0.15)` : 'rgba(255,255,255,0.07)',
                    color: active ? `rgba(var(--glow-color),0.7)` : 'rgba(255,255,255,0.25)',
                  }}>
                  umbral
                </span>
              </div>

              {/* Bars */}
              {bars.map((h, i) => {
                const above = h >= triggerH
                const norm  = h / MAX_BAR_H
                let bg: string
                if (!active) {
                  bg = `rgba(255,255,255,${0.06 + norm * 0.12})`
                } else if (state === 'recording') {
                  bg = above ? recColor(0.55 + norm * 0.45) : recColor(0.15 + norm * 0.15)
                } else {
                  bg = above ? glowColor(0.6 + norm * 0.4) : glowColor(0.15 + norm * 0.2)
                }
                return (
                  <div key={i} className="rounded-full transition-[height] duration-75 shrink-0"
                    style={{ width: '2.5px', height: `${h}px`, background: bg }} />
                )
              })}
            </div>
          )
        })()}

        {/* Volume meter */}
        <div className="mb-5 relative z-10">
          <div className="flex justify-between text-[10px] text-white/30 mb-1">
            <span>Nivel de sonido</span>
            <span>{Math.round(volume)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-75" style={{
              width: `${volume}%`,
              background: volume > 70 ? 'rgba(248,113,113,0.8)' : volume > 40 ? `rgba(var(--glow-color),0.8)` : `rgba(var(--glow-color),0.5)`,
            }} />
          </div>
        </div>

        {/* Sensitivity slider */}
        <div className="mb-5 relative z-10">
          <div className="flex justify-between text-[10px] text-white/30 mb-2">
            <span>Sensibilidad al ruido</span>
            <span>{sensitivity > 28 ? 'Alta' : sensitivity > 14 ? 'Media' : 'Baja'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/20">Menos</span>
            <input type="range" min={4} max={42} value={sensitivity}
              onChange={e => setSensitivity(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full cursor-pointer" />
            <span className="text-[10px] text-white/20">Más</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mb-5 relative z-10">
          {[
            { color: 'rgba(245,158,11,0.82)', label: 'Ronquido' },
            { color: 'rgba(239,68,68,0.78)',  label: 'Habla' },
            { color: 'rgba(255,255,255,0.12)', label: 'Silencio' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
              <span className="text-[11px] text-white/40">{label}</span>
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-400/80 mb-3 text-center relative z-10">{error}</p>}

        <button
          onClick={active ? stopListening : startListening}
          className={`relative z-10 w-full py-4 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 ${
            active ? 'bg-red-500/20 border border-red-500/40 hover:bg-red-500/30' : 'glass-btn-primary'
          }`}
        >
          {active ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
              </svg>
              Dejar de grabar
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              Iniciar monitor de sueño
            </>
          )}
        </button>

        {active && (
          <p className="text-[10px] text-white/25 text-center mt-2 relative z-10">
            Deja el móvil cerca. Clasificará ronquidos y habla automáticamente.
          </p>
        )}
      </div>

      {/* ── Recordings list ── */}
      {recordings.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-white/40 uppercase tracking-wider">Grabaciones ({recordings.length})</p>
            <p className="text-[10px] text-white/20">{formatSize(recordings.reduce((s, r) => s + r.size, 0))} total</p>
          </div>

          <div className="flex flex-col gap-2.5">
            {recordings.map(rec => {
              const segs     = rec.segments ?? []
              const snoreS   = segs.filter(s => s.type === 'snore').reduce((a, s) => a + (s.end - s.start), 0)
              const talkS    = segs.filter(s => s.type === 'talk' ).reduce((a, s) => a + (s.end - s.start), 0)
              const expanded = expandedId === rec.id

              return (
                <div key={rec.id} className="glass-card rounded-2xl overflow-hidden">

                  {/* Main row */}
                  <div className="p-4 flex items-center gap-3">

                    {/* Play button */}
                    <button
                      onClick={() => togglePlay(rec)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 ${
                        playingId === rec.id ? 'glass-nav-active' : 'glass-btn-secondary'
                      }`}
                    >
                      {playingId === rec.id ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="accent-text">
                          <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-white/70">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      )}
                    </button>

                    {/* Info + tap to expand */}
                    <button className="flex-1 min-w-0 text-left" onClick={() => setExpandedId(expanded ? null : rec.id)}>
                      <p className="text-xs font-medium text-white/80">
                        {new Date(rec.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-white/30">
                          {new Date(rec.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-white/15">·</span>
                        <span className="text-[11px] text-white/30">{formatDuration(rec.duration)}</span>
                        <span className="text-white/15">·</span>
                        <span className="text-[11px] text-white/30">{formatSize(rec.size)}</span>
                      </div>

                      {/* Waveform — click to seek */}
                      {segs.length > 0 && (
                        <div className="mt-2">
                          <AudioWaveform
                            segments={segs} duration={rec.duration} height={28}
                            progress={playProgress[rec.id] ?? 0}
                            onSeek={pct => seekTo(rec, pct)} />
                        </div>
                      )}

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {snoreS > 2 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                            🟡 {snoreS < 60 ? `${Math.round(snoreS)}s` : `${Math.round(snoreS / 60)}min`} ronquido
                          </span>
                        )}
                        {talkS > 2 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                            🔴 {talkS < 60 ? `${Math.round(talkS)}s` : `${Math.round(talkS / 60)}min`} habla
                          </span>
                        )}
                        {snoreS <= 2 && talkS <= 2 && segs.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(52,211,153,0.15)', color: '#6ee7b7' }}>
                            ✓ Sin ronquidos
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Chevron + delete */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                        className={`text-white/20 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                      <button
                        onClick={() => handleDelete(rec.id)}
                        className="w-7 h-7 rounded-xl flex items-center justify-center text-red-400/35 hover:text-red-400 hover:bg-red-400/10 transition-all active:scale-95"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/>
                        </svg>
                      </button>
                    </div>

                    <audio ref={el => { if (el) audioRefs.current[rec.id] = el }} />
                  </div>

                  {/* ── Expanded detail ── */}
                  {expanded && (
                    <div className="px-4 pb-4 border-t border-white/5 pt-3 animate-fade-in">
                      {segs.length > 0 ? (
                        <>
                          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Mapa de actividad</p>
                          <AudioWaveform
                            segments={segs} duration={rec.duration} height={48}
                            progress={playProgress[rec.id] ?? 0}
                            onSeek={pct => seekTo(rec, pct)} />
                          <div className="flex justify-between text-[10px] text-white/20 mt-1 mb-3">
                            <span>Inicio</span>
                            <span>{formatDuration(rec.duration / 2)}</span>
                            <span>{formatDuration(rec.duration)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
                              <p className="text-xl font-bold leading-none mb-1" style={{ color: '#fbbf24' }}>
                                {snoreS < 60 ? `${Math.round(snoreS)}s` : `${Math.round(snoreS / 60)}min`}
                              </p>
                              <p className="text-[10px] text-white/30">ronquido</p>
                            </div>
                            <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                              <p className="text-xl font-bold leading-none mb-1" style={{ color: '#f87171' }}>
                                {talkS < 60 ? `${Math.round(talkS)}s` : `${Math.round(talkS / 60)}min`}
                              </p>
                              <p className="text-[10px] text-white/30">habla</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-[11px] text-white/25 text-center py-2">
                          Grabación sin análisis de segmentos
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {recordings.length === 0 && state === 'idle' && (
        <div className="text-center py-6 text-white/25 text-xs">
          Aún no hay grabaciones. Activa el monitor antes de dormir.
        </div>
      )}

      {/* ── How it works ── */}
      <div className="glass-card rounded-2xl p-4 mb-2">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Cómo funciona</p>
        <div className="flex flex-col gap-2.5">
          {[
            { icon: '👂', text: 'Escucha continuamente sin grabar nada' },
            { icon: '🔊', text: 'Al detectar ruido sobre el umbral, graba y analiza el espectro de frecuencias' },
            { icon: '🟡', text: 'Ronquidos: energía concentrada en frecuencias bajas (50–400 Hz)' },
            { icon: '🔴', text: 'Habla: espectro más amplio, frecuencias medias-altas activas' },
            { icon: '🤫', text: 'Para automáticamente tras 4 segundos de silencio' },
            { icon: '💾', text: 'Todo se guarda solo en tu dispositivo, sin internet' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-start gap-2.5">
              <span className="text-base shrink-0">{icon}</span>
              <span className="text-xs text-white/50 leading-relaxed">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
