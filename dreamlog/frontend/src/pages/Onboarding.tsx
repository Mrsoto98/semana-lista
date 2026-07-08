import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { userApi } from '../lib/queries'
import { supabase } from '../lib/supabase'
import type { Visibility } from '../types'

const DREAM_EMOJIS = ['🌙', '⭐', '💫', '✨', '🌟', '🌌', '🔮', '🌊', '🌀', '🦋', '🌸', '🦉', '🌠', '🪐', '👁️', '🧿', '🎭', '🌈', '🌺', '🎑']

const VIS_OPTIONS: { value: Visibility; icon: string; label: string; desc: string }[] = [
  { value: 'private', icon: '🔒', label: 'Privado',  desc: 'Solo tú puedes verlos' },
  { value: 'friends', icon: '👥', label: 'Amigos',   desc: 'Solo tus amigos' },
  { value: 'public',  icon: '🌐', label: 'Público',  desc: 'Todo el mundo' },
]

export default function Onboarding() {
  const navigate  = useNavigate()
  const { user, setAuth, accessToken, refreshToken } = useAuthStore()
  const fileRef   = useRef<HTMLInputElement>(null)

  const [step, setStep]               = useState(0)
  const [name, setName]               = useState(user?.name ?? '')
  const [bio, setBio]                 = useState('')
  const [birthDate, setBirthDate]     = useState('')
  const [birthVisibility, setBirthVisibility] = useState<'date' | 'age' | 'none'>('age')
  const [avatarMode, setAvatarMode]   = useState<'emoji' | 'photo'>('emoji')
  const [selectedEmoji, setSelectedEmoji] = useState('🌙')
  const [photoUrl, setPhotoUrl]       = useState<string | null>(null)
  const [uploading, setUploading]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [visibility, setVisibility]   = useState<Visibility>('private')

  const steps = ['Nombre', 'Bio', 'Cumpleaños', 'Avatar', 'Privacidad']

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setPhotoUrl(data.publicUrl + `?t=${Date.now()}`)
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
      }
      if (birthDate) updates.birth_date = birthDate
      updates.birth_visibility = birthDate ? birthVisibility : 'none'
      if (avatarMode === 'emoji') {
        updates.avatar_emoji = selectedEmoji
        updates.avatar_url   = null
      } else if (photoUrl) {
        updates.avatar_url   = photoUrl
        updates.avatar_emoji = null
      }

      const { data: updated } = await userApi.updateProfile(updates)
      setAuth({ ...user, ...updated, onboarding_done: true }, accessToken!, refreshToken!)
      navigate('/diary')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="orb w-[400px] h-[400px] top-[-100px] right-[-100px] opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(circle, rgba(var(--glow-color),0.5) 0%, transparent 70%)` }} />

      <div className="text-center mb-8">
        <div className="text-5xl mb-3 animate-float inline-block">🌙</div>
        <h1 className="text-xl font-bold text-white">Bienvenido a Bitácora del Sueño</h1>
        <p className="text-white/35 text-sm mt-1">Cuéntanos un poco sobre ti</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6 flex-wrap justify-center">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold transition-all ${
              i < step ? 'bg-green-500/80 text-white' :
              i === step ? 'accent-bg text-white' :
              'bg-white/10 text-white/30'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-xs transition-colors ${i === step ? 'text-white/70' : 'text-white/25'}`}>{s}</span>
            {i < steps.length - 1 && <div className="w-4 h-px bg-white/15 mx-1" />}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="glass rounded-3xl p-6 w-full max-w-sm">

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
            <button onClick={() => setStep(1)} disabled={!name.trim()}
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
              <button onClick={() => setStep(0)}
                className="flex-1 py-3 rounded-2xl text-sm text-white/40 bg-white/5 hover:bg-white/8 transition-all">
                ← Atrás
              </button>
              <button onClick={() => setStep(2)}
                className="flex-1 glass-btn-primary py-3 rounded-2xl text-sm font-semibold text-white transition-all active:scale-[0.98]">
                {bio.trim() ? 'Continuar →' : 'Omitir →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Fecha de nacimiento ── */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-white font-semibold text-lg mb-1">¿Cuándo naciste?</h2>
              <p className="text-white/35 text-sm">Opcional. Lo usamos para personalizar tu experiencia.</p>
            </div>
            <input
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="glass-input w-full rounded-2xl px-4 py-3.5 text-sm text-white [color-scheme:dark]"
            />

            {/* Visibility preference — always shown so user can decide even si no pone fecha */}
            <div>
              <p className="text-xs text-white/40 mb-2.5 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ¿Qué mostramos en tu perfil?
              </p>
              <div className="flex flex-col gap-2">
                {([
                  { value: 'date', icon: '📅', label: 'Fecha completa', desc: 'Ej: 14 de marzo de 1995' },
                  { value: 'age',  icon: '🎂', label: 'Solo la edad',   desc: 'Ej: 29 años' },
                  { value: 'none', icon: '🙈', label: 'No mostrar nada', desc: 'Guardado solo para ti' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBirthVisibility(opt.value)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all ${
                      birthVisibility === opt.value
                        ? 'glass-nav-active'
                        : 'bg-white/4 border border-transparent hover:bg-white/7'
                    }`}
                  >
                    <span className="text-lg shrink-0">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-tight ${birthVisibility === opt.value ? 'text-white' : 'text-white/60'}`}>{opt.label}</p>
                      <p className="text-[11px] text-white/30">{opt.desc}</p>
                    </div>
                    {birthVisibility === opt.value && (
                      <svg className="accent-text shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-2xl text-sm text-white/40 bg-white/5 hover:bg-white/8 transition-all">
                ← Atrás
              </button>
              <button onClick={() => setStep(3)}
                className="flex-1 glass-btn-primary py-3 rounded-2xl text-sm font-semibold text-white transition-all active:scale-[0.98]">
                {birthDate ? 'Continuar →' : 'Omitir →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Avatar ── */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-white font-semibold text-lg mb-1">Elige tu avatar</h2>
              <p className="text-white/35 text-sm">Un emoji onírico o sube tu foto.</p>
            </div>

            <div className="flex rounded-xl bg-white/5 p-1 gap-1">
              {(['emoji', 'photo'] as const).map(mode => (
                <button key={mode} onClick={() => setAvatarMode(mode)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    avatarMode === mode ? 'glass-nav-active text-white' : 'text-white/35 hover:text-white/60'
                  }`}>
                  {mode === 'emoji' ? '✨ Emoji' : '📷 Foto'}
                </button>
              ))}
            </div>

            {avatarMode === 'emoji' && (
              <>
                <div className="grid grid-cols-5 gap-2">
                  {DREAM_EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => setSelectedEmoji(emoji)}
                      className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all ${
                        selectedEmoji === emoji
                          ? 'glass-nav-active ring-2 ring-white/30 scale-110'
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
              </>
            )}

            {avatarMode === 'photo' && (
              <div className="flex flex-col items-center gap-3">
                {photoUrl
                  ? <img src={photoUrl} className="w-24 h-24 rounded-full object-cover ring-2 ring-white/20" alt="" />
                  : <div className="w-24 h-24 rounded-full bg-white/8 border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-1">
                      <span className="text-2xl">📷</span>
                      <span className="text-[10px] text-white/30">Sin foto</span>
                    </div>
                }
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="glass-btn-secondary px-5 py-2.5 rounded-xl text-sm text-white/70 transition-all active:scale-95 disabled:opacity-40">
                  {uploading ? 'Subiendo...' : 'Elegir foto'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-2xl text-sm text-white/40 bg-white/5 hover:bg-white/8 transition-all">
                ← Atrás
              </button>
              <button onClick={() => setStep(4)}
                className="flex-1 glass-btn-primary py-3 rounded-2xl text-sm font-semibold text-white transition-all active:scale-[0.98]">
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Visibilidad ── */}
        {step === 4 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-white font-semibold text-lg mb-1">¿Quién puede ver tus sueños?</h2>
              <p className="text-white/35 text-sm">Elige la visibilidad por defecto al publicar. Puedes cambiarlo en cada sueño.</p>
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

            <div className="flex gap-3">
              <button onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-2xl text-sm text-white/40 bg-white/5 hover:bg-white/8 transition-all">
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
      </div>

      {step < 4 && (
        <button onClick={finish} disabled={saving}
          className="mt-4 text-xs text-white/20 hover:text-white/40 transition-colors">
          Omitir configuración
        </button>
      )}
    </div>
  )
}
