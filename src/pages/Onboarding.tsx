import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { getZodiac } from '../lib/zodiac'
import type { Visibility } from '../types'

const DREAM_EMOJIS = ['🌙', '⭐', '💫', '✨', '🌟', '🌌', '🔮', '🌊', '🌀', '🦋', '🌸', '🦉', '🌠', '🪐', '👁️', '🧿', '🎭', '🌈', '🌺', '🎑']

const COUNTRIES = [
  { flag: '🇪🇸', name: 'España' },
  { flag: '🇲🇽', name: 'México' },
  { flag: '🇦🇷', name: 'Argentina' },
  { flag: '🇨🇴', name: 'Colombia' },
  { flag: '🇨🇱', name: 'Chile' },
  { flag: '🇵🇪', name: 'Perú' },
  { flag: '🇻🇪', name: 'Venezuela' },
  { flag: '🇧🇴', name: 'Bolivia' },
  { flag: '🇪🇨', name: 'Ecuador' },
  { flag: '🇵🇾', name: 'Paraguay' },
  { flag: '🇺🇾', name: 'Uruguay' },
  { flag: '🇵🇦', name: 'Panamá' },
  { flag: '🇨🇷', name: 'Costa Rica' },
  { flag: '🇳🇮', name: 'Nicaragua' },
  { flag: '🇭🇳', name: 'Honduras' },
  { flag: '🇸🇻', name: 'El Salvador' },
  { flag: '🇬🇹', name: 'Guatemala' },
  { flag: '🇨🇺', name: 'Cuba' },
  { flag: '🇩🇴', name: 'Rep. Dominicana' },
  { flag: '🇵🇷', name: 'Puerto Rico' },
  { flag: '🇺🇸', name: 'Estados Unidos' },
  { flag: '🇬🇧', name: 'Reino Unido' },
  { flag: '🇩🇪', name: 'Alemania' },
  { flag: '🇫🇷', name: 'Francia' },
  { flag: '🇮🇹', name: 'Italia' },
  { flag: '🇵🇹', name: 'Portugal' },
  { flag: '🇧🇷', name: 'Brasil' },
  { flag: '🇯🇵', name: 'Japón' },
  { flag: '🇨🇳', name: 'China' },
  { flag: '🇲🇦', name: 'Marruecos' },
]

const VIS_OPTIONS: { value: Visibility; icon: string; label: string; desc: string }[] = [
  { value: 'private', icon: '🔒', label: 'Privado', desc: 'Solo tú puedes verlos' },
  { value: 'public',  icon: '🌍', label: 'Público', desc: 'Toda la comunidad' },
]

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0 },
  exit:  (dir: number) => ({ opacity: 0, x: dir > 0 ? -28 : 28 }),
}

export default function Onboarding() {
  const navigate  = useNavigate()
  const { user, setAuth, accessToken, refreshToken } = useAuthStore()
  const fileRef   = useRef<HTMLInputElement>(null)

  const [step, setStep]           = useState(0)
  const [dir, setDir]             = useState(1)
  const [name, setName]           = useState(user?.name ?? '')
  const [bio, setBio]             = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthText, setBirthText] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [birthVisibility, setBirthVisibility] = useState<'date' | 'age' | 'date_age' | 'none'>('age')
  const [showZodiac, setShowZodiac] = useState(true)
  const [location, setLocation]   = useState('')
  const [country, setCountry]     = useState('')
  const [residenceCity, setResidenceCity]       = useState('')
  const [residenceCountry, setResidenceCountry] = useState('')
  const [locationVisibility, setLocationVisibility] = useState<'birth' | 'residence' | 'both' | 'none'>('both')
  const [avatarMode, setAvatarMode] = useState<'emoji' | 'photo'>('photo')
  const [selectedEmoji, setSelectedEmoji] = useState('🌙')
  const [photoUrl, setPhotoUrl]   = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [visibility, setVisibility] = useState<Visibility>('public')

  const steps = ['Nombre', 'Bio', 'Cumpleaños', 'Lugares', 'Avatar', 'Privacidad']

  function goTo(next: number) {
    setDir(next > step ? 1 : -1)
    setStep(next)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUrl(URL.createObjectURL(file))
    setUploadError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post<{ url: string }>('/user/avatar', form)
      setPhotoUrl(data.url)
      setUploadedUrl(data.url)
    } catch {
      setUploadError('No se pudo subir la foto. Inténtalo de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  async function finish() {
    if (!user) return
    setSaving(true)
    try {
      const updates: Record<string, unknown> = {
        name,
        bio: bio || null,
        onboarding_done: true,
        default_visibility: visibility,
        show_zodiac: showZodiac,
      }
      if (birthDate) updates.birth_date = birthDate
      updates.birth_visibility = birthDate ? birthVisibility : 'none'
      if (birthTime) updates.birth_time = birthTime
      if (location.trim()) updates.location = location.trim()
      if (country) updates.country = country
      if (residenceCity.trim()) updates.residence_city = residenceCity.trim()
      if (residenceCountry) updates.residence_country = residenceCountry
      updates.location_visibility = locationVisibility
      if (avatarMode === 'emoji') {
        updates.avatar_emoji = selectedEmoji
        updates.avatar_url   = null
      } else if (uploadedUrl) {
        updates.avatar_url   = uploadedUrl
        updates.avatar_emoji = null
      }
      await supabase.from('profiles').update(updates).eq('id', user.id)
      setAuth({ ...user, ...(updates as object), onboarding_done: true }, accessToken!, refreshToken!)
      navigate('/diario')
    } finally {
      setSaving(false)
    }
  }

  const zodiac = getZodiac(birthDate)
  const progress = ((step + 1) / steps.length) * 100

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background orb */}
      <div className="orb w-[500px] h-[500px] top-[-120px] right-[-120px] opacity-15 pointer-events-none"
        style={{ background: `radial-gradient(circle, rgba(var(--glow-color),0.6) 0%, transparent 70%)` }} />
      <div className="orb w-[300px] h-[300px] bottom-[-80px] left-[-80px] opacity-10 pointer-events-none"
        style={{ background: `radial-gradient(circle, rgba(var(--glow-color),0.5) 0%, transparent 70%)` }} />

      {/* Header */}
      <div className="text-center mb-4">
        <img
          src="/logo.png"
          alt="myDreams"
          className="mx-auto w-full max-w-[260px] select-none -mb-2"
        />
        <p className="text-white/35 text-sm">Cuéntanos un poco sobre ti</p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm mb-5">
        <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 180, damping: 28 }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, rgba(var(--glow),0.5), rgba(var(--glow),1))` }}
          />
        </div>
        {/* Step pills */}
        <div className="flex items-center gap-1 mt-3 justify-center flex-wrap">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-all duration-300 ${
                i < step ? 'bg-green-500/80 text-white' :
                i === step ? 'accent-bg text-white shadow-lg' :
                'bg-white/8 text-white/25'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              {i === step && <span className="text-[11px] text-white/65">{s}</span>}
              {i < steps.length - 1 && <div className="w-3 h-px bg-white/10 mx-0.5" />}
            </div>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="glass rounded-3xl w-full max-w-sm overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }}
            className="p-6"
          >

            {/* ── Step 0: Nombre ── */}
            {step === 0 && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-white font-semibold text-lg mb-1">¿Cómo te llamamos?</h2>
                  <p className="text-white/35 text-sm">Aparecerá en tu perfil y sueños públicos.</p>
                </div>
                <input
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={80}
                  placeholder="Tu nombre o apodo..."
                  className="glass-input w-full rounded-2xl px-4 py-3.5 text-sm text-white placeholder:text-white/20"
                />
                <button onClick={() => goTo(1)} disabled={!name.trim()}
                  className="glass-btn-primary w-full py-3.5 rounded-2xl text-sm font-semibold text-white disabled:opacity-30 transition-all active:scale-[0.98]">
                  Continuar →
                </button>
              </div>
            )}

            {/* ── Step 1: Bio ── */}
            {step === 1 && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-white font-semibold text-lg mb-1">Cuéntanos sobre ti</h2>
                  <p className="text-white/35 text-sm">Opcional. Aparecerá en tu perfil público.</p>
                </div>
                <div className="relative">
                  <textarea
                    autoFocus
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="Soy un soñador que..."
                    className="glass-input w-full rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/20 resize-none"
                  />
                  <span className="absolute bottom-3 right-3 text-[10px] text-white/20">{bio.length}/500</span>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => goTo(0)}
                    className="flex-1 py-3 rounded-2xl text-sm text-white/40 bg-white/5 transition-all active:scale-95">
                    ← Atrás
                  </button>
                  <button onClick={() => goTo(2)}
                    className="flex-1 glass-btn-primary py-3 rounded-2xl text-sm font-semibold text-white transition-all active:scale-[0.98]">
                    {bio.trim() ? 'Continuar →' : 'Omitir →'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Cumpleaños ── */}
            {step === 2 && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-white font-semibold text-lg mb-1">¿Cuándo naciste?</h2>
                  <p className="text-white/35 text-sm">Opcional. Calculamos tu carta astral y te mostramos tu signo.</p>
                </div>

                {/* Date input */}
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  value={birthText}
                  onChange={e => {
                    let raw = e.target.value.replace(/[^\d]/g, '')
                    if (raw.length > 8) raw = raw.slice(0, 8)
                    let fmt = raw
                    if (raw.length > 4) fmt = raw.slice(0,2) + '/' + raw.slice(2,4) + '/' + raw.slice(4)
                    else if (raw.length > 2) fmt = raw.slice(0,2) + '/' + raw.slice(2)
                    setBirthText(fmt)
                    if (raw.length === 8) {
                      const d = raw.slice(0,2), m = raw.slice(2,4), y = raw.slice(4,8)
                      setBirthDate(`${y}-${m}-${d}`)
                    } else setBirthDate('')
                  }}
                  maxLength={10}
                  className="glass-input w-full rounded-2xl px-4 py-3.5 text-sm text-white placeholder:text-white/40"
                />

                {/* Zodiac preview */}
                <AnimatePresence>
                  {zodiac && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
                      style={{ background: 'rgba(var(--glow),0.08)', border: '1px solid rgba(var(--glow),0.18)' }}
                    >
                      <span className="text-2xl">{zodiac.emoji}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">{zodiac.name} {zodiac.symbol}</p>
                        <p className="text-[11px] text-white/40">Tu signo zodiacal</p>
                      </div>
                      <button
                        onClick={() => setShowZodiac(v => !v)}
                        className={`text-[10px] px-2 py-1 rounded-full transition-all ${showZodiac ? 'text-white/70' : 'text-white/25'}`}
                        style={{ background: showZodiac ? 'rgba(var(--glow),0.15)' : 'rgba(255,255,255,0.05)' }}
                      >
                        {showZodiac ? 'Visible ✓' : 'Oculto'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Birth time */}
                <div>
                  <p className="text-xs text-white/35 mb-1.5">Hora de nacimiento (opcional)</p>
                  <input
                    type="time"
                    value={birthTime}
                    onChange={e => setBirthTime(e.target.value)}
                    className="glass-input w-full rounded-2xl px-4 py-3 text-sm text-white"
                    style={{ colorScheme: 'dark' }}
                  />
                  {birthTime && (
                    <p className="text-[11px] text-white/30 mt-1.5 px-1">
                      Necesaria para calcular tu Ascendente y casas astrológicas.
                    </p>
                  )}
                </div>

                {/* Visibility */}
                <div>
                  <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 opacity-60"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    ¿Qué mostramos en tu perfil?
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { value: 'date',     icon: '📅', label: 'Fecha completa' },
                      { value: 'age',      icon: '🎂', label: 'Solo la edad' },
                      { value: 'date_age', icon: '🗓️', label: 'Fecha y edad' },
                      { value: 'none',     icon: '🙈', label: 'No mostrar' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBirthVisibility(opt.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${
                          birthVisibility === opt.value ? 'glass-nav-active' : 'bg-white/4 border border-transparent'
                        }`}
                      >
                        <span className="text-base shrink-0">{opt.icon}</span>
                        <p className={`text-[11px] font-medium leading-tight ${birthVisibility === opt.value ? 'text-white' : 'text-white/50'}`}>
                          {opt.label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => goTo(1)}
                    className="flex-1 py-3 rounded-2xl text-sm text-white/40 bg-white/5 transition-all active:scale-95">
                    ← Atrás
                  </button>
                  <button onClick={() => goTo(3)}
                    className="flex-1 glass-btn-primary py-3 rounded-2xl text-sm font-semibold text-white transition-all active:scale-[0.98]">
                    {birthDate ? 'Continuar →' : 'Omitir →'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Lugares ── */}
            {step === 3 && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-white font-semibold text-lg mb-1">Tu lugar en el mundo</h2>
                  <p className="text-white/35 text-sm">Opcional. Para tu carta astral y perfil.</p>
                </div>

                {/* ─ Birth place ─ */}
                <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">♑</span>
                    <p className="text-[12px] font-semibold text-white/55 uppercase tracking-wide">Ciudad natal</p>
                    <span className="text-[10px] text-white/25 ml-auto">Para tu carta astral</span>
                  </div>
                  <input
                    autoFocus
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Ej: Madrid, Buenos Aires..."
                    className="glass-input w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25"
                  />
                  <div className="relative">
                    <select
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                      className="glass-input w-full rounded-xl px-4 py-3 text-sm text-white appearance-none pr-8"
                      style={{ colorScheme: 'dark', background: 'rgba(255,255,255,0.05)' }}
                    >
                      <option value="" style={{ background: '#0a0c1e' }}>País de nacimiento...</option>
                      {COUNTRIES.map(c => (
                        <option key={c.name} value={c.name} style={{ background: '#0a0c1e' }}>{c.flag} {c.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>

                {/* ─ Residence ─ */}
                <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">🏠</span>
                    <p className="text-[12px] font-semibold text-white/55 uppercase tracking-wide">Residencia actual</p>
                  </div>
                  <input
                    value={residenceCity}
                    onChange={e => setResidenceCity(e.target.value)}
                    placeholder="¿En qué ciudad vives?"
                    className="glass-input w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25"
                  />
                  <div className="relative">
                    <select
                      value={residenceCountry}
                      onChange={e => setResidenceCountry(e.target.value)}
                      className="glass-input w-full rounded-xl px-4 py-3 text-sm text-white appearance-none pr-8"
                      style={{ colorScheme: 'dark', background: 'rgba(255,255,255,0.05)' }}
                    >
                      <option value="" style={{ background: '#0a0c1e' }}>País de residencia...</option>
                      {COUNTRIES.map(c => (
                        <option key={c.name} value={c.name} style={{ background: '#0a0c1e' }}>{c.flag} {c.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>

                {/* ─ Location visibility ─ */}
                <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[12px] font-semibold text-white/55 uppercase tracking-wide mb-3">📍 ¿Qué mostrar en tu perfil?</p>
                  {([
                    { value: 'both',      icon: '🌍', label: 'Nacimiento y residencia' },
                    { value: 'residence', icon: '🏠', label: 'Solo residencia' },
                    { value: 'birth',     icon: '📍', label: 'Solo ciudad natal' },
                    { value: 'none',      icon: '🙈', label: 'No mostrar ubicación' },
                  ] as const).map(opt => (
                    <button key={opt.value} type="button" onClick={() => setLocationVisibility(opt.value)}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all ${
                        locationVisibility === opt.value ? 'glass-nav-active' : 'bg-white/4 border border-transparent'
                      }`}>
                      <span className="text-base shrink-0">{opt.icon}</span>
                      <span className={`text-sm ${locationVisibility === opt.value ? 'text-white font-medium' : 'text-white/55'}`}>{opt.label}</span>
                      {locationVisibility === opt.value && (
                        <svg className="ml-auto accent-text shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => goTo(2)}
                    className="flex-1 py-3 rounded-2xl text-sm text-white/40 bg-white/5 transition-all active:scale-95">
                    ← Atrás
                  </button>
                  <button onClick={() => goTo(4)}
                    className="flex-1 glass-btn-primary py-3 rounded-2xl text-sm font-semibold text-white transition-all active:scale-[0.98]">
                    {(location.trim() || country || residenceCity.trim() || residenceCountry) ? 'Continuar →' : 'Omitir →'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 4: Avatar ── */}
            {step === 4 && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-white font-semibold text-lg mb-1">Pon una foto de perfil</h2>
                  <p className="text-white/35 text-sm">Que otros soñadores sepan quién eres.</p>
                </div>

                {avatarMode === 'photo' && (
                  <div className="flex flex-col items-center gap-4">
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="relative group"
                    >
                      {photoUrl
                        ? <img src={photoUrl} className="w-28 h-28 rounded-full object-cover ring-2 ring-white/20" alt="" />
                        : (
                          <div className="w-28 h-28 rounded-full flex flex-col items-center justify-center gap-2 transition-all group-hover:opacity-80"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '2px dashed rgba(255,255,255,0.18)' }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-white/40">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                              <circle cx="12" cy="13" r="4"/>
                            </svg>
                            <span className="text-[11px] text-white/30">Subir foto</span>
                          </div>
                        )
                      }
                      {uploading && (
                        <div className="absolute inset-0 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(0,0,0,0.5)' }}>
                          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="glass-btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-40">
                      {uploading ? 'Subiendo...' : photoUrl ? '📷 Cambiar foto' : '📷 Elegir foto'}
                    </button>
                    {uploadError && <p className="text-xs text-red-400/80 text-center px-2">{uploadError}</p>}

                    {/* Preview with name */}
                    {photoUrl && (
                      <div className="flex items-center gap-3 w-full p-3 rounded-2xl bg-white/5 border border-white/8">
                        <img src={photoUrl} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
                        <div>
                          <p className="text-sm font-semibold text-white">{name}</p>
                          <p className="text-[11px] text-white/35">Así te verán otros soñadores</p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => { setAvatarMode('emoji') }}
                      className="text-[12px] text-white/30 hover:text-white/55 transition-colors"
                    >
                      o prefiero un emoji →
                    </button>
                  </div>
                )}

                {avatarMode === 'emoji' && (
                  <>
                    <div className="grid grid-cols-5 gap-2">
                      {DREAM_EMOJIS.map(emoji => (
                        <button key={emoji} onClick={() => setSelectedEmoji(emoji)}
                          className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all ${
                            selectedEmoji === emoji
                              ? 'glass-nav-active ring-2 ring-white/25 scale-110'
                              : 'bg-white/5 hover:bg-white/10 hover:scale-105'
                          }`}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/8">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-2xl shrink-0"
                        style={{ background: 'linear-gradient(135deg, rgba(var(--glow-color),0.4), rgba(var(--glass-tint),0.5))' }}>
                        {selectedEmoji}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{name}</p>
                        <p className="text-[11px] text-white/35">Así te verán otros soñadores</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAvatarMode('photo')}
                      className="text-[12px] text-white/30 hover:text-white/55 transition-colors text-center"
                    >
                      ← volver a usar foto
                    </button>
                  </>
                )}

                <div className="flex gap-3">
                  <button onClick={() => goTo(3)}
                    className="flex-1 py-3 rounded-2xl text-sm text-white/40 bg-white/5 transition-all active:scale-95">
                    ← Atrás
                  </button>
                  <button onClick={() => goTo(5)}
                    className="flex-1 glass-btn-primary py-3 rounded-2xl text-sm font-semibold text-white transition-all active:scale-[0.98]">
                    Continuar →
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 5: Privacidad ── */}
            {step === 5 && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-white font-semibold text-lg mb-1">¿Quién ve tus sueños?</h2>
                  <p className="text-white/35 text-sm">Visibilidad por defecto. Puedes cambiarlo en cada sueño.</p>
                </div>

                <div className="flex flex-col gap-2">
                  {VIS_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setVisibility(opt.value)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all ${
                        visibility === opt.value ? 'glass-nav-active' : 'bg-white/4 hover:bg-white/7 border border-transparent'
                      }`}>
                      <span className="text-xl">{opt.icon}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${visibility === opt.value ? 'text-white' : 'text-white/60'}`}>{opt.label}</p>
                        <p className="text-[11px] text-white/30">{opt.desc}</p>
                      </div>
                      {visibility === opt.value && (
                        <svg className="accent-text shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                {/* Summary of what's been set */}
                <div className="rounded-2xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] text-white/25 uppercase tracking-widest mb-3">Resumen de tu perfil</p>
                  {[
                    { icon: '👤', label: name || '—' },
                    zodiac ? { icon: zodiac.emoji, label: `${zodiac.name} · ${birthTime ? birthTime : 'hora no indicada'}` } : null,
                    (location || country) ? { icon: COUNTRIES.find(c => c.name === country)?.flag ?? '🌍', label: [location, country].filter(Boolean).join(', ') } : null,
                  ].filter(Boolean).map((item, i) => item && (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm shrink-0">{item.icon}</span>
                      <span className="text-[12px] text-white/55 truncate">{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => goTo(4)}
                    className="flex-1 py-3 rounded-2xl text-sm text-white/40 bg-white/5 transition-all active:scale-95">
                    ← Atrás
                  </button>
                  <button onClick={finish} disabled={saving}
                    className="flex-1 glass-btn-primary py-3 rounded-2xl text-sm font-semibold text-white disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                    {saving
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                      : '¡Empezar a soñar! 🌙'}
                  </button>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {step < 5 && (
        <button onClick={finish} disabled={saving}
          className="mt-4 text-xs text-white/20 hover:text-white/40 transition-colors">
          Omitir configuración
        </button>
      )}
    </div>
  )
}
