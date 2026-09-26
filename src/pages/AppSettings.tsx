import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { userApi } from '../lib/queries'
import { usePushNotifications } from '../hooks/usePushNotifications'
import type { Visibility } from '../types'

const VIS_OPTIONS: { value: Visibility; icon: string; label: string; desc: string }[] = [
  { value: 'private', icon: '🔒', label: 'Privado', desc: 'Solo tú puedes verlos' },
  { value: 'public',  icon: '🌍', label: 'Público', desc: 'Todo el mundo' },
]

export default function AppSettings() {
  const navigate = useNavigate()
  const { user, setAuth, logout, accessToken, refreshToken } = useAuthStore()

  const [vis,        setVis]        = useState<Visibility>(user?.default_visibility ?? 'private')
  const [visSaving,  setVisSaving]  = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [deleteText,  setDeleteText]  = useState('')
  const [deleting,    setDeleting]    = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [reminderTime, setReminderTimeLocal] = useState(() => {
    try { return localStorage.getItem('dream-reminder-time') ?? '08:00' } catch { return '08:00' }
  })

  const push = usePushNotifications()

  async function handleVisChange(newVis: Visibility) {
    setVis(newVis)
    setVisSaving(true)
    await supabase.from('profiles').update({ default_visibility: newVis }).eq('id', user!.id)
    if (user) setAuth({ ...user, default_visibility: newVis }, accessToken!, refreshToken!)
    setVisSaving(false)
  }

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
      const { data: { session } } = await supabase.auth.refreshSession()
      if (session) {
        setAuth(user!, session.access_token, session.refresh_token ?? '')
      }
      await userApi.deleteAccount()
      await supabase.auth.signOut().catch(() => {})
      logout()
      navigate('/entrada')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; details?: string[] } }; message?: string }
      const details = axiosErr.response?.data?.details?.join(' | ') ?? ''
      const msg = axiosErr.response?.data?.error ?? axiosErr.message ?? 'Error desconocido'
      setDeleteError(`Error: ${msg}${details ? ` — ${details}` : ''}`)
      setDeleting(false)
    }
  }

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
        <h1 className="text-lg font-bold text-white">Ajustes</h1>
      </div>

      {/* Default visibility */}
      <div className="glass rounded-3xl p-5 mb-4">
        <label className="text-[11px] text-white/40 uppercase tracking-wider mb-3 block">
          Visibilidad por defecto
        </label>
        <div className="flex flex-col gap-2">
          {VIS_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => handleVisChange(opt.value)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all ${
                vis === opt.value ? 'glass-nav-active' : 'bg-white/4 hover:bg-white/7 border border-transparent'
              }`}>
              <span className="text-lg">{opt.icon}</span>
              <div>
                <p className={`text-sm font-medium ${vis === opt.value ? 'text-white' : 'text-white/60'}`}>{opt.label}</p>
                <p className="text-[11px] text-white/30">{opt.desc}</p>
              </div>
              {vis === opt.value && !visSaving && (
                <svg className="ml-auto accent-text" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
              {vis === opt.value && visSaving && (
                <div className="ml-auto w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Push notifications */}
      {push.state !== 'unsupported' && (
        <div className="glass rounded-3xl p-5 mb-4">
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

      {/* Export dreams */}
      <ExportSection userId={user!.id} />

      {/* Tutorial */}
      <button
        onClick={() => { localStorage.removeItem('tutorial-seen'); window.dispatchEvent(new CustomEvent('open-tutorial')) }}
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
        className="w-full mt-2 mb-8 py-3.5 rounded-2xl text-sm font-medium text-red-500/70 hover:text-red-500 border border-red-500/20 hover:border-red-500/35 hover:bg-red-500/5 transition-all flex items-center justify-center gap-2">
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
        filename = `mydreams-suenos-${new Date().toISOString().slice(0, 10)}.json`
        mimeType = 'application/json'
      } else {
        content = dreams.map(d =>
          `${d.dream_date}${d.is_lucid ? ' [LÚCIDO]' : ''}\n${d.title ? d.title + '\n' : ''}${d.body}\n\nEmociones: ${d.emotions?.join(', ') || '—'}\nEtiquetas: ${d.tags?.join(', ') || '—'}\n${'─'.repeat(40)}`
        ).join('\n\n')
        filename = `mydreams-suenos-${new Date().toISOString().slice(0, 10)}.txt`
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
