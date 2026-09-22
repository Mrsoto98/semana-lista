import { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { formatUserNumber } from '../lib/formatUserNumber'
import { ThemePicker } from '../components/ui/ThemePicker'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { getZodiac } from '../lib/zodiac'
import type { Visibility } from '../types'


const VIS_OPTIONS: { value: Visibility; icon: string; label: string; desc: string }[] = [
  { value: 'private', icon: '🔒', label: 'Privado', desc: 'Solo tú puedes verlos' },
  { value: 'public',  icon: '🌍', label: 'Público', desc: 'Todo el mundo' },
]

const DREAM_EMOJIS = ['🌙', '⭐', '💫', '✨', '🌟', '🌌', '🔮', '🌊', '🌀', '🦋', '🌸', '🦉', '🌠', '🪐', '👁️', '🧿', '🎭', '🌈', '🌺', '🎑']

export default function Settings() {
  const navigate = useNavigate()
  const { user, setAuth, logout, accessToken, refreshToken } = useAuthStore()
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
  const [bio,        setBio]        = useState(user?.bio ?? '')
  const [instagram,  setInstagram]  = useState(user?.instagram_username ?? '')
  const [vis,        setVis]        = useState<Visibility>(user?.default_visibility ?? 'private')
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
  const [showZodiac, setShowZodiac] = useState(() => {
    try { return localStorage.getItem('show-zodiac') === '1' } catch { return false }
  })
  const [showPublicStats, setShowPublicStats] = useState(() => {
    try {
      const v = localStorage.getItem('show-public-stats')
      return v === null ? true : v === '1'
    } catch { return true }
  })
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteText,  setDeleteText]  = useState('')
  const [deleting,    setDeleting]    = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [reminderTime, setReminderTimeLocal] = useState(() => {
    try { return localStorage.getItem('dream-reminder-time') ?? '08:00' } catch { return '08:00' }
  })

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
        name, bio, default_visibility: vis,
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

      // Extended fields (new columns — silently skipped if not migrated yet)
      await supabase.from('profiles').update({
        birth_time: birthTime || null,
        location: location || null,
        country: country || null,
        show_zodiac: showZodiac,
        show_public_stats: showPublicStats,
      }).eq('id', user!.id)

      try {
        localStorage.setItem('show-zodiac', showZodiac ? '1' : '0')
        localStorage.setItem('birth-time', birthTime)
        localStorage.setItem('profile-location', location)
        localStorage.setItem('profile-country', country)
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
        show_zodiac: showZodiac,
        show_public_stats: showPublicStats,
      }, accessToken!, refreshToken!)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  async function handleLogout() {
    await supabase.auth.signOut().catch(() => {})
    logout()
    navigate('/entrada')
  }

  async function handleDeleteAccount() {
    if (deleteText !== 'ELIMINAR') return
    setDeleting(true)
    setDeleteError('')
    try {
      const { error } = await supabase.rpc('delete_own_account')
      if (error) throw error
      logout()
      navigate('/entrada')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setDeleteError(`Error al eliminar la cuenta: ${msg}`)
      setDeleting(false)
    }
  }

  const push = usePushNotifications()
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
          <span className="text-xs text-white/40">Nº de usuario</span>
          <span className="text-base font-bold accent-text tracking-wider">
            #{currentUser?.user_number != null ? formatUserNumber(currentUser.user_number) : '…'}
          </span>
        </div>
        <p className="text-[10px] text-white/25 leading-relaxed pt-1 border-t border-white/6">
          Comparte tu número o correo para que otros te agreguen como amigo.
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

      {/* Default visibility */}
      <div className="glass rounded-3xl p-5 mb-4">
        <label className="text-[11px] text-white/40 uppercase tracking-wider mb-3 block">
          Visibilidad por defecto
        </label>
        <div className="flex flex-col gap-2">
          {VIS_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setVis(opt.value)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all ${
                vis === opt.value ? 'glass-nav-active' : 'bg-white/4 hover:bg-white/7 border border-transparent'
              }`}>
              <span className="text-lg">{opt.icon}</span>
              <div>
                <p className={`text-sm font-medium ${vis === opt.value ? 'text-white' : 'text-white/60'}`}>{opt.label}</p>
                <p className="text-[11px] text-white/30">{opt.desc}</p>
              </div>
              {vis === opt.value && (
                <svg className="ml-auto accent-text" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
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

        {/* Location & country */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/30 uppercase tracking-wide">Ciudad (opcional)</label>
            <input
              type="text"
              placeholder="Ej: Barcelona"
              value={location}
              onChange={e => setLocation(e.target.value)}
              maxLength={80}
              className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-white"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/30 uppercase tracking-wide">País (opcional)</label>
            <input
              type="text"
              placeholder="Ej: España"
              value={country}
              onChange={e => setCountry(e.target.value)}
              maxLength={80}
              className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-white"
            />
          </div>
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

      {/* Save */}
      <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim()}
        className="glass-btn-primary w-full py-4 rounded-2xl text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
        {mutation.isPending
          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
          : saved ? '✓ Guardado' : 'Guardar cambios'}
      </button>

      {/* Push notifications */}
      {push.state !== 'unsupported' && (
        <div className="glass rounded-3xl p-5 mt-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Recordatorio diario</p>
          {push.state === 'denied' ? (
            <p className="text-xs text-orange-400/70 mt-2">
              ⚠️ Permiso denegado. Actívalo en los ajustes de tu navegador para recibir recordatorios.
            </p>
          ) : (
            <>
              <p className="text-xs text-white/35 mb-4">
                Recibe un aviso a la hora elegida para anotar tus sueños antes de que se desvanezcan.
              </p>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="time"
                  value={reminderTime}
                  onChange={e => setReminderTimeLocal(e.target.value)}
                  className="glass-input flex-1 rounded-xl px-4 py-2.5 text-sm text-white"
                />
                <button
                  onClick={async () => {
                    const ok = await push.setReminderTime(reminderTime)
                    if (!ok) setReminderTimeLocal(push.getSavedTime() ?? '08:00')
                  }}
                  disabled={push.state === 'loading'}
                  className="glass-btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 whitespace-nowrap"
                >
                  {push.state === 'loading'
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : push.getSavedTime() ? 'Actualizar' : 'Activar'}
                </button>
              </div>
              {push.getSavedTime() && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px]" style={{ color: `hsl(var(--accent-h), var(--accent-s), 70%)` }}>
                    ✓ Activo a las {push.getSavedTime()}
                  </span>
                  <button
                    onClick={async () => { await push.setReminderTime(null); setReminderTimeLocal('08:00') }}
                    className="text-[11px] text-red-400/50 hover:text-red-400 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Theme */}
      <div className="glass rounded-3xl p-5 mt-4">
        <p className="text-[11px] text-white/40 uppercase tracking-wider mb-3">Tema de color</p>
        <ThemePicker />
      </div>


      {/* Export dreams */}
      <ExportSection userId={user!.id} />

      {/* Tutorial */}
      <button onClick={() => { localStorage.removeItem('tutorial-seen'); window.dispatchEvent(new CustomEvent('open-tutorial')) }}
        className="w-full mt-4 py-3.5 rounded-2xl text-sm font-medium border transition-all flex items-center justify-center gap-2"
        style={{ color: 'rgba(0,194,255,0.8)', borderColor: 'rgba(0,194,255,0.2)', background: 'rgba(0,194,255,0.06)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
        </svg>
        Ver tutorial de la app
      </button>

      {/* Logout */}
      <button onClick={handleLogout}
        className="w-full mt-4 py-3.5 rounded-2xl text-sm font-medium text-red-400/70 hover:text-red-400 border border-red-400/15 hover:border-red-400/30 hover:bg-red-400/5 transition-all flex items-center justify-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Cerrar sesión
      </button>

      {/* Delete account */}
      <button onClick={() => { setDeleteModal(true); setDeleteText(''); setDeleteError('') }}
        className="w-full mt-2 mb-8 py-3.5 rounded-2xl text-sm font-medium text-red-500/50 hover:text-red-500 border border-red-500/10 hover:border-red-500/25 hover:bg-red-500/5 transition-all flex items-center justify-center gap-2">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
        Eliminar cuenta
      </button>

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(10px)' }}
          onClick={e => { if (e.target === e.currentTarget && !deleting) setDeleteModal(false) }}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm animate-scale-in">

            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>

            <h2 className="text-white font-bold text-center text-lg mb-1">Eliminar cuenta</h2>
            <p className="text-white/45 text-sm text-center leading-relaxed mb-4">
              Esta acción es <span className="text-red-400 font-semibold">permanente e irreversible</span>.
              Se borrarán todos tus sueños, análisis, comentarios, amigos y datos publicados.
            </p>

            <div className="bg-red-500/8 border border-red-500/15 rounded-xl px-4 py-3 mb-4">
              <p className="text-xs text-red-400/80 leading-relaxed">
                Para confirmar escribe <span className="font-bold font-mono text-red-400">ELIMINAR</span> en el campo de abajo:
              </p>
            </div>

            <input
              autoFocus
              value={deleteText}
              onChange={e => setDeleteText(e.target.value)}
              placeholder="ELIMINAR"
              maxLength={10}
              className="w-full glass-input rounded-xl px-4 py-3 text-sm font-mono font-bold text-red-400 placeholder:text-white/15 placeholder:font-normal mb-3 text-center tracking-widest"
            />

            {deleteError && (
              <p className="text-xs text-red-400 text-center mb-3">{deleteError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(false)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm text-white/40 bg-white/5 hover:bg-white/8 transition-all disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteText !== 'ELIMINAR' || deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500/70 hover:bg-red-500/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {deleting
                  ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Eliminando...</>
                  : 'Eliminar cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}

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


function ExportSection({ userId }: { userId: string }) {
  const [exporting, setExporting] = useState(false)

  async function handleExport(format: 'json' | 'txt') {
    setExporting(true)
    try {
      const { data } = await supabase
        .from('dreams')
        .select('title, body, dream_date, is_lucid, emotions, tags, sleep_quality, visibility, created_at')
        .eq('user_id', userId)
        .order('dream_date', { ascending: false })
      const dreams = data ?? []
      let content: string
      let filename: string
      let mimeType: string
      if (format === 'json') {
        content = JSON.stringify(dreams, null, 2)
        filename = `bitacora-suenos-${new Date().toISOString().slice(0, 10)}.json`
        mimeType = 'application/json'
      } else {
        content = dreams.map(d =>
          `${d.dream_date}${d.is_lucid ? ' [LÚCIDO]' : ''}\n${d.title ? d.title + '\n' : ''}${d.body}\n\nEmociones: ${d.emotions?.join(', ') || '—'}\nEtiquetas: ${d.tags?.join(', ') || '—'}\n${'─'.repeat(40)}`
        ).join('\n\n')
        filename = `bitacora-suenos-${new Date().toISOString().slice(0, 10)}.txt`
        mimeType = 'text/plain;charset=utf-8'
      }
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="glass rounded-3xl p-5 mt-4">
      <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Exportar sueños</p>
      <p className="text-xs text-white/30 mb-4">Descarga todos tus sueños como archivo</p>
      <div className="flex gap-2">
        <button onClick={() => handleExport('json')} disabled={exporting}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all active:scale-[0.98] disabled:opacity-40"
          style={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
          {exporting ? '…' : '{ } JSON'}
        </button>
        <button onClick={() => handleExport('txt')} disabled={exporting}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all active:scale-[0.98] disabled:opacity-40"
          style={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
          {exporting ? '…' : '≡ Texto'}
        </button>
      </div>
    </div>
  )
}
