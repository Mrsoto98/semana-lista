import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { getZodiac } from '../lib/zodiac'
import { ThemePicker } from '../components/ui/ThemePicker'

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'same' | 'invalid'

const DREAM_EMOJIS = ['🌙', '⭐', '💫', '✨', '🌟', '🌌', '🔮', '🌊', '🌀', '🦋', '🌸', '🦉', '🌠', '🪐', '👁️', '🧿', '🎭', '🌈', '🌺', '🎑']

export default function Settings() {
  const navigate = useNavigate()
  const { user, setAuth, accessToken, refreshToken } = useAuthStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: freshProfile } = useQuery({
    queryKey: ['my-profile-settings', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single()
      return data
    },
    enabled: !!user,
  })
  const currentUser = freshProfile ?? user

  const [name,       setName]       = useState(user?.name ?? '')
  const [username,   setUsername]   = useState(user?.username ?? '')
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [bio,        setBio]        = useState(user?.bio ?? '')
  const [instagram,  setInstagram]  = useState(user?.instagram_username ?? '')
  const [saved,      setSaved]      = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [avatarUrl,  setAvatarUrl]  = useState<string | null>(user?.avatar_url ?? null)
  const [lightbox,   setLightbox]   = useState(false)
  const [avatarMode, setAvatarMode] = useState<'photo' | 'emoji'>(user?.avatar_emoji ? 'emoji' : 'photo')
  const [selectedEmoji, setSelectedEmoji] = useState(user?.avatar_emoji ?? '🌙')
  const [birthDate,  setBirthDate]  = useState(user?.birth_date ?? '')
  const [birthText,  setBirthText]  = useState(() => {
    if (!user?.birth_date) return ''
    const [y, m, d] = user.birth_date.split('-')
    return `${d}/${m}/${y}`
  })
  const [birthVisibility, setBirthVisibility] = useState<'date' | 'age' | 'date_age' | 'none'>(user?.birth_visibility ?? 'age')
  const [birthTime, setBirthTime] = useState(() => {
    try { return localStorage.getItem('birth-time') ?? user?.birth_time ?? '' } catch { return '' }
  })
  const [location, setLocation] = useState(() => {
    try { return localStorage.getItem('profile-location') ?? user?.location ?? '' } catch { return '' }
  })
  const [country, setCountry] = useState(() => {
    try { return localStorage.getItem('profile-country') ?? user?.country ?? '' } catch { return '' }
  })
  const [residenceCity, setResidenceCity] = useState(() => {
    try { return localStorage.getItem('profile-residence-city') ?? user?.residence_city ?? '' } catch { return '' }
  })
  const [residenceCountry, setResidenceCountry] = useState(() => {
    try { return localStorage.getItem('profile-residence-country') ?? user?.residence_country ?? '' } catch { return '' }
  })
  const [locationVisibility, setLocationVisibility] = useState<'birth' | 'residence' | 'both' | 'none'>(
    user?.location_visibility ?? 'birth'
  )
  const [showZodiac, setShowZodiac] = useState(() => {
    try { return localStorage.getItem('show-zodiac') === '1' } catch { return false }
  })
  const [showPublicStats, setShowPublicStats] = useState(() => {
    try {
      const v = localStorage.getItem('show-public-stats')
      return v === null ? true : v === '1'
    } catch { return true }
  })

  // Debounced username availability check (skip if same as current)
  useEffect(() => {
    if (usernameTimer.current) clearTimeout(usernameTimer.current)
    if (!username) { setUsernameStatus('idle'); return }
    if (username === (user?.username ?? '')) { setUsernameStatus('same'); return }
    if (!/^[a-z0-9_]{3,30}$/.test(username)) { setUsernameStatus('invalid'); return }
    setUsernameStatus('checking')
    usernameTimer.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .neq('id', user!.id)
          .maybeSingle()
        setUsernameStatus(data ? 'taken' : 'available')
      } catch {
        setUsernameStatus('idle')
      }
    }, 500)
    return () => { if (usernameTimer.current) clearTimeout(usernameTimer.current) }
  }, [username, user?.username, user?.id])

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl + `?t=${Date.now()}`
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id)
      if (updateError) throw updateError
      setAvatarUrl(url)
      setAuth({ ...user, avatar_url: url }, accessToken!, refreshToken!)
    } catch (err) {
      console.error('Error subiendo foto:', err)
    } finally {
      setUploading(false)
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const updates: Record<string, unknown> = {
        name, bio,
        username: username.trim() || null,
        instagram_username: instagram.replace('@', '').trim() || null,
        birth_date: birthDate || null,
        birth_visibility: birthVisibility,
      }
      if (avatarMode === 'emoji') {
        updates.avatar_emoji = selectedEmoji
        updates.avatar_url   = null
      }
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user!.id)
        .select()
        .single()
      if (error) throw error

      await supabase.from('profiles').update({
        birth_time: birthTime || null,
        location: location || null,
        country: country || null,
        residence_city: residenceCity || null,
        residence_country: residenceCountry || null,
        location_visibility: locationVisibility,
        show_zodiac: showZodiac,
        show_public_stats: showPublicStats,
      }).eq('id', user!.id)

      try {
        localStorage.setItem('show-zodiac', showZodiac ? '1' : '0')
        localStorage.setItem('birth-time', birthTime)
        localStorage.setItem('profile-location', location)
        localStorage.setItem('profile-country', country)
        localStorage.setItem('profile-residence-city', residenceCity)
        localStorage.setItem('profile-residence-country', residenceCountry)
        localStorage.setItem('show-public-stats', showPublicStats ? '1' : '0')
      } catch {}

      return data
    },
    onSuccess: (updated) => {
      if (user) setAuth({
        ...user, ...updated,
        birth_time: birthTime || null,
        location: location || null,
        country: country || null,
        residence_city: residenceCity || null,
        residence_country: residenceCountry || null,
        location_visibility: locationVisibility,
        show_zodiac: showZodiac,
        show_public_stats: showPublicStats,
      }, accessToken!, refreshToken!)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const initials = name?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="animate-fade-in pb-36">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 glass-btn-secondary rounded-xl flex items-center justify-center transition-all active:scale-95">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-lg font-bold text-white">Editar perfil</h1>
      </div>

      {/* Avatar preview */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative">
          <button onClick={() => avatarUrl && setLightbox(true)} className="block">
            {avatarUrl ? (
              <img src={avatarUrl} className="w-24 h-24 rounded-full object-cover ring-2 ring-white/15" alt="" />
            ) : (
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold text-white ring-2 ring-white/15"
                style={{ background: 'linear-gradient(135deg, rgba(var(--glow-color),0.8), rgba(var(--glass-tint),0.9))' }}>
                {initials}
              </div>
            )}
          </button>
          <button onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 w-8 h-8 glass-btn-primary rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50">
            {uploading
              ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
            }
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </div>
        <p className="text-[11px] text-white/30 mt-2">Foto de perfil</p>
      </div>

      {/* Avatar mode */}
      <div className="glass rounded-3xl p-5 mb-4">
        <label className="text-[11px] text-white/40 uppercase tracking-wider mb-3 block">Avatar</label>
        <div className="flex rounded-xl bg-white/5 p-1 gap-1 mb-4">
          {(['photo', 'emoji'] as const).map(mode => (
            <button key={mode} onClick={() => setAvatarMode(mode)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                avatarMode === mode ? 'glass-nav-active text-white' : 'text-white/35 hover:text-white/60'
              }`}>
              {mode === 'photo' ? '📷 Foto' : '✨ Emoji'}
            </button>
          ))}
        </div>
        {avatarMode === 'photo' && (
          <div className="flex flex-col items-center gap-3">
            {avatarUrl
              ? <img src={avatarUrl} className="w-20 h-20 rounded-full object-cover ring-2 ring-white/20" alt="" />
              : <div className="w-20 h-20 rounded-full bg-white/8 border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-1">
                  <span className="text-2xl">📷</span>
                  <span className="text-[10px] text-white/30">Sin foto</span>
                </div>
            }
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="glass-btn-secondary px-5 py-2.5 rounded-xl text-sm text-white/70 transition-all active:scale-95 disabled:opacity-40">
              {uploading ? 'Subiendo...' : 'Cambiar foto'}
            </button>
          </div>
        )}
        {avatarMode === 'emoji' && (
          <>
            <div className="grid grid-cols-5 gap-2 mb-3">
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
              <p className="text-xs text-white/40">Así te verán otros soñadores</p>
            </div>
          </>
        )}
      </div>

      {/* Account info */}
      <div className="glass rounded-3xl p-5 mb-4 flex flex-col gap-3">
        <p className="text-[11px] text-white/40 uppercase tracking-wider">Cuenta</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40">Correo</span>
          <span className="text-xs text-white/70 font-medium truncate max-w-[200px]">{currentUser?.email}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40">Usuario</span>
          <span className="text-sm font-semibold accent-text">
            {currentUser?.username ? `@${currentUser.username}` : '—'}
          </span>
        </div>
        <p className="text-[10px] text-white/25 leading-relaxed pt-1 border-t border-white/6">
          Comparte tu @usuario para que otros te encuentren fácilmente.
        </p>
      </div>

      {/* Profile form */}
      <div className="glass rounded-3xl p-5 flex flex-col gap-4 mb-4">
        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5 block">Nombre</label>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={80}
            placeholder="Tu nombre"
            className="glass-input w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20" />
        </div>
        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5 block">Nombre de usuario</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-medium select-none">@</span>
            <input
              value={username}
              onChange={e => {
                const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30)
                setUsername(v)
              }}
              maxLength={30}
              placeholder="tu_usuario"
              className={`glass-input w-full rounded-xl pl-8 pr-10 py-3 text-sm text-white placeholder:text-white/20 transition-all ${
                usernameStatus === 'available' ? 'border border-emerald-500/30' :
                usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border border-red-500/25' : ''
              }`}
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
              {usernameStatus === 'checking' && (
                <div className="w-3 h-3 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
              )}
              {(usernameStatus === 'available' || usernameStatus === 'same') && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-emerald-400">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-red-400">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              )}
            </div>
          </div>
          {usernameStatus === 'taken' && (
            <p className="text-[11px] text-red-400/80 mt-1 px-1">@{username} no está disponible</p>
          )}
          {usernameStatus === 'invalid' && (
            <p className="text-[11px] text-orange-400/70 mt-1 px-1">Solo minúsculas, números y _ · 3-30 caracteres</p>
          )}
        </div>
        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5 block">Biografía</label>
          <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={500} rows={3}
            placeholder="Cuéntanos algo sobre ti..."
            className="glass-input w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 resize-none" />
          <p className="text-[10px] text-white/20 mt-1 text-right">{bio.length}/500</p>
        </div>
        <div>
          <label className="text-[11px] text-white/40 uppercase tracking-wider mb-1.5 block">Instagram</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">@</span>
            <input value={instagram} onChange={e => setInstagram(e.target.value.replace('@', ''))} maxLength={30}
              placeholder="tu_usuario"
              className="glass-input w-full rounded-xl pl-8 pr-4 py-3 text-sm text-white placeholder:text-white/20" />
          </div>
        </div>
      </div>

      {/* Birth date & zodiac */}
      <div className="glass rounded-3xl p-5 mb-4 flex flex-col gap-3">
        <label className="text-[11px] text-white/40 uppercase tracking-wider block">Fecha de nacimiento</label>
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
          className="glass-input w-full rounded-xl px-4 py-3 text-sm text-white"
        />

        {/* Zodiac preview */}
        {(() => {
          const z = getZodiac(birthDate)
          return z ? (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{ background: 'rgba(var(--glow),0.08)', border: '1px solid rgba(var(--glow),0.15)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{z.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{z.name}</p>
                  <p className="text-[11px] text-white/35">Signo zodiacal · {z.symbol}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowZodiac(v => !v)}
                className="flex items-center gap-1.5 text-[11px] font-medium transition-colors px-3 py-1.5 rounded-lg"
                style={{
                  background: showZodiac ? 'rgba(var(--glow),0.2)' : 'rgba(255,255,255,0.06)',
                  color: showZodiac ? `hsl(var(--accent-h),var(--accent-s),80%)` : 'rgba(255,255,255,0.4)',
                }}
              >
                {showZodiac ? `${z.symbol} Visible` : 'Ocultar'}
              </button>
            </div>
          ) : null
        })()}

        {/* Optional birth time */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-white/30 uppercase tracking-wide">Hora de nacimiento (opcional)</label>
          <input
            type="time"
            value={birthTime}
            onChange={e => setBirthTime(e.target.value)}
            className="glass-input w-full rounded-xl px-4 py-2.5 text-sm text-white"
            style={{ colorScheme: 'dark' }}
          />
        </div>

        {/* Birth location */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wide mb-2">📍 Ciudad natal</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Ej: Barcelona" value={location}
              onChange={e => setLocation(e.target.value)} maxLength={80}
              className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-white" />
            <input type="text" placeholder="Ej: España" value={country}
              onChange={e => setCountry(e.target.value)} maxLength={80}
              className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-white" />
          </div>
        </div>

        {/* Residence */}
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wide mb-2">🏠 Residencia actual</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Ciudad actual" value={residenceCity}
              onChange={e => setResidenceCity(e.target.value)} maxLength={80}
              className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-white" />
            <input type="text" placeholder="País actual" value={residenceCountry}
              onChange={e => setResidenceCountry(e.target.value)} maxLength={80}
              className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-white" />
          </div>
        </div>

        {/* Location visibility */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-white/30 uppercase tracking-wide">¿Qué mostrar en tu perfil?</p>
          {([
            { value: 'both',      icon: '🌍', label: 'Nacimiento y residencia' },
            { value: 'residence', icon: '🏠', label: 'Solo residencia' },
            { value: 'birth',     icon: '📍', label: 'Solo ciudad natal' },
            { value: 'none',      icon: '🙈', label: 'No mostrar' },
          ] as const).map(opt => (
            <button key={opt.value} onClick={() => setLocationVisibility(opt.value)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all ${
                locationVisibility === opt.value ? 'glass-nav-active' : 'bg-white/4 hover:bg-white/7'
              }`}>
              <span>{opt.icon}</span>
              <span className={`text-sm ${locationVisibility === opt.value ? 'text-white font-medium' : 'text-white/50'}`}>{opt.label}</span>
              {locationVisibility === opt.value && (
                <svg className="ml-auto accent-text" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 mt-1">
          {([
            { value: 'date',     icon: '📅', label: 'Mostrar fecha completa' },
            { value: 'age',      icon: '🎂', label: 'Mostrar solo edad' },
            { value: 'date_age', icon: '✨', label: 'Mostrar fecha y edad' },
            { value: 'none',     icon: '🙈', label: 'No mostrar' },
          ] as const).map(opt => (
            <button key={opt.value} onClick={() => setBirthVisibility(opt.value)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all ${
                birthVisibility === opt.value ? 'glass-nav-active' : 'bg-white/4 hover:bg-white/7'
              }`}>
              <span>{opt.icon}</span>
              <span className={`text-sm ${birthVisibility === opt.value ? 'text-white font-medium' : 'text-white/50'}`}>{opt.label}</span>
              {birthVisibility === opt.value && (
                <svg className="ml-auto accent-text" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Public stats toggle */}
      <div className="glass rounded-3xl p-5 mb-4">
        <p className="text-[11px] text-white/40 uppercase tracking-wider mb-3">Perfil público</p>
        <button type="button" onClick={() => setShowPublicStats(v => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ color: showPublicStats ? `hsl(var(--accent-h),var(--accent-s),75%)` : 'rgba(255,255,255,0.3)' }}>
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            <div className="text-left">
              <p className="text-sm text-white/80">Mostrar pestaña de estadísticas</p>
              <p className="text-[11px] text-white/35 mt-0.5">Otras personas verán tus emociones y etiquetas frecuentes</p>
            </div>
          </div>
          <div className="shrink-0 w-11 h-6 rounded-full transition-all relative"
            style={{ background: showPublicStats ? `hsl(var(--accent-h),var(--accent-s),50%)` : 'rgba(255,255,255,0.1)' }}>
            <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
              style={{ left: showPublicStats ? '22px' : '2px' }} />
          </div>
        </button>
      </div>

      {/* Color theme */}
      <div className="glass rounded-3xl p-5 mb-4">
        <p className="text-[11px] text-white/40 uppercase tracking-wider mb-3">Tema de color</p>
        <ThemePicker />
      </div>

      {/* Save */}
      <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim()}
        className="glass-btn-primary w-full py-4 rounded-2xl text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
        {mutation.isPending
          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
          : saved ? '✓ Guardado' : 'Guardar cambios'}
      </button>

      {/* Lightbox */}
      {lightbox && avatarUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightbox(false)}>
          <img src={avatarUrl} className="max-w-[90vw] max-h-[90vh] rounded-3xl shadow-2xl object-contain" alt="" />
        </div>
      )}
    </div>
  )
}
