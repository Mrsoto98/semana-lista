import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuthStore } from '../lib/store'
import { userApi, authApi } from '../lib/queries'
import { formatUserNumber } from '../lib/formatUserNumber'
import { supabase } from '../lib/supabase'
import { ThemePicker } from '../components/ui/ThemePicker'
import { usePushNotifications } from '../hooks/usePushNotifications'
import type { Visibility } from '../types'

const VIS_OPTIONS: { value: Visibility; icon: string; label: string; desc: string }[] = [
  { value: 'private', icon: '🔒', label: 'Privado',  desc: 'Solo tú puedes verlos' },
  { value: 'friends', icon: '👥', label: 'Amigos',   desc: 'Solo tus amigos' },
  { value: 'public',  icon: '🌐', label: 'Público',  desc: 'Todo el mundo' },
]

export default function Settings() {
  const navigate = useNavigate()
  const { user, setAuth, logout, accessToken, refreshToken } = useAuthStore()
  const fileRef = useRef<HTMLInputElement>(null)

  // Fetch fresh profile (gets user_number)
  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then(r => r.data),
  })
  const currentUser = profile ?? user

  const [name, setName]         = useState(user?.name ?? '')
  const [bio, setBio]           = useState(user?.bio ?? '')
  const [instagram, setInstagram] = useState(user?.instagram_username ?? '')
  const [vis, setVis]           = useState<Visibility>(user?.default_visibility ?? 'private')
  const [saved, setSaved]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url ?? null)
  const [lightbox, setLightbox]   = useState(false)
  const [avatarMode, setAvatarMode] = useState<'photo' | 'emoji'>(user?.avatar_emoji ? 'emoji' : 'photo')
  const [selectedEmoji, setSelectedEmoji] = useState(user?.avatar_emoji ?? '🌙')
  const [birthDate, setBirthDate] = useState(user?.birth_date ?? '')
  const [birthText, setBirthText] = useState(() => {
    if (!user?.birth_date) return ''
    const [y, m, d] = user.birth_date.split('-')
    return `${d}/${m}/${y}`
  })
  const [birthVisibility, setBirthVisibility] = useState<'date' | 'age' | 'none'>(user?.birth_visibility ?? 'age')
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteText, setDeleteText]   = useState('')
  const [deleting, setDeleting]       = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl + `?t=${Date.now()}`
      await userApi.updateProfile({ avatar_url: url })
      setAvatarUrl(url)
      if (user) setAuth({ ...user, avatar_url: url }, accessToken!, refreshToken!)
    } catch (err) {
      console.error('Error subiendo foto:', err)
    } finally {
      setUploading(false)
    }
  }

  const DREAM_EMOJIS = ['🌙', '⭐', '💫', '✨', '🌟', '🌌', '🔮', '🌊', '🌀', '🦋', '🌸', '🦉', '🌠', '🪐', '👁️', '🧿', '🎭', '🌈', '🌺', '🎑']

  const mutation = useMutation({
    mutationFn: () => {
      const updates: Record<string, unknown> = {
        name, bio, default_visibility: vis,
        instagram_username: instagram.replace('@', '').trim() || null,
        birth_date: birthDate || null,
        birth_visibility: birthDate ? birthVisibility : 'none',
      }
      if (avatarMode === 'emoji') {
        updates.avatar_emoji = selectedEmoji
        updates.avatar_url = null
      }
      return userApi.updateProfile(updates).then(r => r.data)
    },
    onSuccess: (updated) => {
      if (user) setAuth({ ...user, ...updated }, accessToken!, refreshToken!)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  async function handleLogout() {
    await authApi.logout().catch(() => {})
    logout()
    navigate('/login')
  }

  async function handleDeleteAccount() {
    if (deleteText !== 'ELIMINAR') return
    setDeleting(true)
    setDeleteError('')
    try {
      // Call a SECURITY DEFINER Postgres function that deletes auth.users by auth.uid()
      const { error } = await supabase.rpc('delete_own_account')
      if (error) throw error
      logout()
      navigate('/login')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setDeleteError(`Error al eliminar la cuenta: ${msg}`)
      setDeleting(false)
    }
  }

  const push = usePushNotifications()
  const initials = name?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="animate-fade-in">

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

      {/* Avatar */}
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
          {/* Upload button */}
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

      {/* Avatar mode tabs */}
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

      {/* Birth date */}
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
        <div className="flex flex-col gap-2 mt-1">
          {([
            { value: 'date', icon: '📅', label: 'Mostrar fecha completa' },
            { value: 'age',  icon: '🎂', label: 'Mostrar solo edad' },
            { value: 'none', icon: '🙈', label: 'No mostrar' },
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
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">Recordatorio matutino</p>
              <p className="text-sm text-white/70 font-medium">Aviso a las 8:00 AM</p>
              <p className="text-[11px] text-white/30 mt-0.5">
                {push.state === 'denied'
                  ? '⚠️ Permiso denegado. Actívalo en ajustes del navegador.'
                  : push.state === 'subscribed'
                    ? '✓ Recibirás un aviso cada mañana para anotar tus sueños.'
                    : '¿Tuviste algún sueño? Regístralo antes de que lo olvides.'}
              </p>
            </div>
            {push.state !== 'denied' && (
              <button
                onClick={() => push.state === 'subscribed' ? push.unsubscribe() : push.subscribe()}
                disabled={push.state === 'loading'}
                className={`shrink-0 w-12 h-6 rounded-full transition-all relative disabled:opacity-50 ${
                  push.state === 'subscribed' ? 'bg-[rgba(var(--glow-color),0.6)]' : 'bg-white/15'
                }`}
              >
                {push.state === 'loading'
                  ? <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  : <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
                      push.state === 'subscribed' ? 'left-7' : 'left-1'
                    }`} />
                }
              </button>
            )}
          </div>
        </div>
      )}

      {/* Theme */}
      <div className="glass rounded-3xl p-5 mt-4">
        <p className="text-[11px] text-white/40 uppercase tracking-wider mb-3">Tema de color</p>
        <ThemePicker />
      </div>

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
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4 pb-6 sm:pb-0"
          style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(10px)' }}
          onClick={e => { if (e.target === e.currentTarget && !deleting) setDeleteModal(false) }}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm animate-scale-in">

            {/* Warning icon */}
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
