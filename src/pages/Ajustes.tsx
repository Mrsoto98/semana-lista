import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { getInstallPrompt } from '../lib/installPrompt'
import { createPortal } from 'react-dom'
import { useI18n } from '../hooks/useI18n'
import { useNavigate } from 'react-router-dom'
import { TagInput } from '../components/ui/TagInput'
import { FeedbackModal } from '../components/FeedbackModal'
import { Avatar } from '../components/Avatar'
import { usePerfil } from '../hooks/usePerfil'
import { useUsuario } from '../hooks/useUsuario'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { guardar, recuperar } from '../lib/storage'
import { usePushNotifications, DIAS_SEMANA, HORAS_DISPONIBLES } from '../hooks/usePushNotifications'
import type { Objetivo, DificultadPreferida, Perfil } from '../types'

// Labels built inside component from t.* keys
type DificultadItem = { value: DificultadPreferida; label: string; emoji: string; desc: string }
type ObjetivoItem = { value: Objetivo; label: string; emoji: string }

type Draft = Omit<Perfil, 'id' | 'usuario_id'>

const AVATARES = ['🧑', '👩', '👨', '🧑‍🍳', '👩‍🍳', '👨‍🍳', '🧑‍💻', '🦸', '🧙', '🐱', '🐶', '🦊', '🐸', '🦋', '🌟', '🍕', '🥑', '🌮']

export default function Ajustes() {
  const { t, lang, setLang } = useI18n()

  const DIFICULTADES: DificultadItem[] = [
    { value: 'fácil',     label: t.dif_facil,     emoji: '😊', desc: t.dif_desc_facil },
    { value: 'media',     label: t.dif_media,     emoji: '👨‍🍳', desc: t.dif_desc_media },
    { value: 'difícil',   label: t.dif_dificil,   emoji: '🔥', desc: t.dif_desc_dificil },
    { value: 'combinado', label: t.dif_combinado, emoji: '🎲', desc: t.dif_desc_combinado },
  ]

  const OBJETIVOS: ObjetivoItem[] = [
    { value: 'sin_restriccion', label: t.obj_sin_restriccion, emoji: '🍽️' },
    { value: 'bajar_peso',      label: t.obj_bajar_peso,      emoji: '⚖️' },
    { value: 'mas_proteina',    label: t.obj_mas_proteina,    emoji: '💪' },
    { value: 'vegetariano',     label: t.obj_vegetariano,     emoji: '🥦' },
    { value: 'vegano',          label: t.obj_vegano,          emoji: '🌱' },
    { value: 'sin_gluten',      label: t.obj_sin_gluten,      emoji: '🌾' },
  ]
  const navigate = useNavigate()
  const { user } = useAuth()
  const { perfil, guardarPerfil } = usePerfil()
  const { usuario, guardarUsuario, recargar: recargarUsuario } = useUsuario()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [modalFeedback, setModalFeedback] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { estado: estadoNotif, activar: activarNotif, desactivar: desactivarNotif, actualizarHorario, notifDia, notifHora } = usePushNotifications()

  // Perfil de usuario
  const [nombreDisplay, setNombreDisplay] = useState('')
  const [avatarEmoji, setAvatarEmoji] = useState('🧑')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [guardandoUsuario, setGuardandoUsuario] = useState(false)
  const [guardadoUsuario, setGuardadoUsuario] = useState(false)
  const [errorUsuario, setErrorUsuario] = useState('')

  // Menús recientes (leídos de localStorage, igual que Menu.tsx)
  const semanasGuardadas = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('semanas_guardadas') ?? '[]') as Array<{
      id: string; nombre: string; fecha: string
      estados: Record<string, { estado: string; datos?: { opciones: Array<{ nombre?: string }> } } | null>
      seleccion: Record<string, number>
    }> } catch { return [] }
  }, [])

  function recetasDeUnaSemana(s: typeof semanasGuardadas[0]): string[] {
    const names: string[] = []
    for (const [clave, est] of Object.entries(s.estados)) {
      if (est?.estado === 'listo' && est.datos?.opciones) {
        const r = est.datos.opciones[s.seleccion[clave] ?? 0]
        if (r?.nombre) names.push(r.nombre)
      }
    }
    return names.slice(0, 5)
  }

  // Eliminar cuenta
  const [modalEliminar, setModalEliminar] = useState(false)
  const [confirmTexto, setConfirmTexto] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState('')

  async function eliminarCuenta() {
    setEliminando(true)
    setErrorEliminar('')
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const res = await supabase.functions.invoke('eliminar-cuenta', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (res.error) { setErrorEliminar(res.error.message || 'Error al eliminar la cuenta.'); setEliminando(false); return }
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  useEffect(() => {
    if (usuario) {
      const nombreGoogle = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''
      setNombreDisplay(usuario.nombre_display || nombreGoogle)
      setAvatarEmoji(usuario.avatar_emoji ?? '🧑')
      setAvatarUrl(usuario.avatar_url ?? null)
    }
  }, [usuario, user])

  async function comprimirImagen(archivo: File): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(archivo)
      img.onload = () => {
        const MAX = 800
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        canvas.toBlob(b => { if (b) resolve(b); else resolve(archivo) }, 'image/jpeg', 0.85)
      }
      img.src = url
    })
  }

  async function subirFoto(archivo: File) {
    if (!user) return
    setSubiendoFoto(true)
    setErrorUsuario('')
    const blob = await comprimirImagen(archivo)
    const path = `${user.id}/avatar.jpg`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (uploadError) { setErrorUsuario(`Error al subir la foto: ${uploadError.message}`); setSubiendoFoto(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${publicUrl}?t=${Date.now()}`
    const { error } = await guardarUsuario({ avatar_url: url })
    setSubiendoFoto(false)
    if (error) setErrorUsuario(error)
    else { setAvatarUrl(url); await recargarUsuario() }
  }

  async function guardarPerfilUsuario() {
    setGuardandoUsuario(true)
    setErrorUsuario('')
    const { error } = await guardarUsuario({
      nombre_display: nombreDisplay || undefined,
      avatar_emoji: avatarEmoji,
    })
    setGuardandoUsuario(false)
    if (error) setErrorUsuario(error)
    else { setGuardadoUsuario(true); setTimeout(() => setGuardadoUsuario(false), 2000) }
  }

  const [tema, setTema] = useState<'light' | 'dark' | 'system'>(() => {
    const t = localStorage.getItem('semana-lista:theme')
    return (t === 'dark' || t === 'light') ? t : 'system'
  })

  const [tamano, setTamano] = useState<'pequeno' | 'normal' | 'grande'>(() => {
    const t = localStorage.getItem('semana-lista:tamano')
    return (t === 'pequeno' || t === 'grande') ? t : 'normal'
  })

  function aplicarTamano(t: 'pequeno' | 'normal' | 'grande') {
    setTamano(t)
    const sizes = { pequeno: '87.5%', normal: '100%', grande: '125%' }
    document.documentElement.style.fontSize = sizes[t]
    localStorage.setItem('semana-lista:tamano', t)
  }

  const COLORES_ACENTO = [
    { id: 'verde',   rgb: '22 163 74',   hex: '#16a34a', label: 'Verde'   },
    { id: 'rosa',    rgb: '219 39 119',  hex: '#db2777', label: 'Rosa'    },
    { id: 'morado',  rgb: '124 58 237',  hex: '#7c3aed', label: 'Morado'  },
    { id: 'azul',    rgb: '37 99 235',   hex: '#2563eb', label: 'Azul'    },
    { id: 'naranja', rgb: '234 88 12',   hex: '#ea580c', label: 'Naranja' },
  ] as const

  const [colorAcento, setColorAcento] = useState<string>(() =>
    localStorage.getItem('semana-lista:accent-id') ?? 'verde'
  )

  function aplicarColor(id: string, rgb: string) {
    setColorAcento(id)
    document.documentElement.style.setProperty('--accent', rgb)
    localStorage.setItem('semana-lista:accent-color', rgb)
    localStorage.setItem('semana-lista:accent-id', id)
  }

  const aplicarTema = useCallback((t: 'light' | 'dark' | 'system') => {
    setTema(t)
    if (t === 'dark') {
      document.documentElement.classList.add('dark')
      localStorage.setItem('semana-lista:theme', 'dark')
    } else if (t === 'light') {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('semana-lista:theme', 'light')
    } else {
      localStorage.removeItem('semana-lista:theme')
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }, [])

  useEffect(() => {
    if (perfil && !draft) {
      setDraft({
        personas: perfil.personas,
        presupuesto: perfil.presupuesto,
        codigo_postal: perfil.codigo_postal,
        supermercado: perfil.supermercado,
        objetivo: perfil.objetivo,
        dificultad_recetas: perfil.dificultad_recetas ?? 'combinado',
        ingredientes_si: perfil.ingredientes_si ?? [],
        ingredientes_no: perfil.ingredientes_no ?? [],
        nevera: perfil.nevera ?? [],
      })
    }
  }, [perfil])

  function set<K extends keyof Draft>(key: K, val: Draft[K]) {
    setDraft(d => d ? { ...d, [key]: val } : d)
  }

  async function guardarCambios() {
    if (!draft) return
    setGuardando(true)
    await guardarPerfil(draft)
    setGuardando(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  if (!draft) return null

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto pb-24 page-enter">
      {modalFeedback && <FeedbackModal onClose={() => setModalFeedback(false)} />}
      <h1 data-tutorial="ajustes-h1" className="text-2xl font-black tracking-tight mb-6 mt-2">{t.ajustes_titulo}</h1>

      {/* ── Perfil de usuario ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-card shadow-card p-4 mb-6 space-y-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t.ajustes_perfil}</p>

        {/* Avatar: foto o emoji */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t.ajustes_avatar}</p>
          <div className="flex items-start gap-4">
            {/* Foto actual / emoji, clic para subir */}
            <div className="relative shrink-0">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative group rounded-full overflow-hidden"
                title={t.ajustes_cambiar_foto}
              >
                <Avatar url={avatarUrl} emoji={avatarEmoji} size="xl" />
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-xl">{subiendoFoto ? '⏳' : '📷'}</span>
                </div>
              </button>
              {avatarUrl && (
                <button
                  onClick={async () => { await guardarUsuario({ avatar_url: undefined }); setAvatarUrl(null) }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none"
                  title={t.ajustes_quitar_foto}
                >✕</button>
              )}
            </div>
            {/* Emojis */}
            <div className="flex flex-wrap gap-1.5">
              {AVATARES.map(e => (
                <button
                  key={e}
                  onClick={() => setAvatarEmoji(e)}
                  className={`text-xl w-9 h-9 rounded-xl border-2 transition-colors ${avatarEmoji === e && !avatarUrl ? 'border-green-select bg-accent-light' : 'border-gray-200 dark:border-gray-700'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">{t.ajustes_toca_avatar}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f) }}
          />
        </div>

        {/* Nombre para mostrar */}
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{t.ajustes_nombre}</label>
          <input
            type="text"
            value={nombreDisplay}
            onChange={e => setNombreDisplay(e.target.value)}
            placeholder={t.ajustes_nombre_ph}
            maxLength={40}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-select"
          />
        </div>

        {/* Email de registro (solo lectura) */}
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{t.ajustes_correo}</label>
          <input
            type="text"
            value={user?.email ?? ''}
            readOnly
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
          />
        </div>

        {errorUsuario && <p className="text-sm text-red-500">{errorUsuario}</p>}

        <button
          onClick={guardarPerfilUsuario}
          disabled={guardandoUsuario || subiendoFoto}
          className="w-full bg-green-select text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {guardadoUsuario ? t.btn_guardado : guardandoUsuario ? t.btn_guardando : t.ajustes_guardar_perfil}
        </button>
      </div>

      <section className="space-y-5">
        {/* Personas */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.ajustes_personas}</p>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <button
                key={n}
                onClick={() => set('personas', n)}
                className={`w-12 h-12 rounded-card text-lg font-bold border-2 transition-colors ${
                  draft.personas === n
                    ? 'border-green-select bg-green-50 dark:bg-green-900 text-green-select'
                    : 'border-gray-200 dark:border-gray-700 hover:border-green-select'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Presupuesto */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.ajustes_presupuesto}</p>
          <input
            type="number" min={20} max={500}
            value={draft.presupuesto}
            onChange={e => set('presupuesto', Number(e.target.value))}
            className="w-full border-2 rounded-card px-4 py-2 text-xl font-bold text-center bg-white dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:border-green-select"
          />
        </div>

        {/* CP */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.ajustes_codigo_postal}</p>
          <input
            type="text" inputMode="numeric" pattern="[0-9]{5}" maxLength={5}
            value={draft.codigo_postal}
            onChange={e => set('codigo_postal', e.target.value)}
            placeholder="28001"
            className="w-full border-2 rounded-card px-4 py-2 text-xl font-bold text-center bg-white dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:border-green-select"
          />
        </div>

        {/* Objetivo */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.ajustes_objetivo}</p>
          <div className="grid grid-cols-2 gap-2">
            {OBJETIVOS.map(obj => (
              <button
                key={obj.value}
                onClick={() => set('objetivo', obj.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-card border-2 text-left text-sm transition-colors ${
                  draft.objetivo === obj.value
                    ? 'border-green-select bg-green-50 dark:bg-green-900'
                    : 'border-gray-200 dark:border-gray-700 hover:border-green-select'
                }`}
              >
                <span>{obj.emoji}</span>
                <span className="font-medium">{obj.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dificultad de recetas */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.ajustes_dificultad}</p>
          <div className="grid grid-cols-2 gap-2">
            {DIFICULTADES.map(d => (
              <button
                key={d.value}
                onClick={() => set('dificultad_recetas', d.value)}
                className={`flex flex-col gap-0.5 px-3 py-2.5 rounded-card border-2 text-left text-sm transition-colors ${
                  draft.dificultad_recetas === d.value
                    ? 'border-green-select bg-green-50 dark:bg-green-900'
                    : 'border-gray-200 dark:border-gray-700 hover:border-green-select'
                }`}
              >
                <span className="text-base">{d.emoji} <span className="font-semibold">{d.label}</span></span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{d.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Ingredientes favoritos */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.ajustes_favoritos}</p>
          <TagInput
            tags={draft.ingredientes_si}
            onChange={tags => set('ingredientes_si', tags)}
            placeholder={t.ajustes_favoritos_ph}
          />
        </div>

        {/* Ingredientes a evitar */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.ajustes_evitar}</p>
          <TagInput
            tags={draft.ingredientes_no}
            onChange={tags => set('ingredientes_no', tags)}
            placeholder={t.ajustes_evitar_ph}
          />
        </div>

      </section>

      {/* Menús recientes */}
      {semanasGuardadas.length > 0 && (
        <div className="pt-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t.ajustes_menus_recientes}</p>
          <div className="space-y-2">
            {semanasGuardadas.slice(0, 3).map(s => {
              const recetas = recetasDeUnaSemana(s)
              return (
                <div key={s.id} className="bg-white dark:bg-gray-900 rounded-card border border-gray-100 dark:border-gray-800 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{s.nombre}</p>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">{s.fecha}</span>
                  </div>
                  {recetas.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{recetas.join(' · ')}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Color de acento */}
      <div className="pt-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color de acento</p>
        <div className="flex gap-3 flex-wrap">
          {COLORES_ACENTO.map(({ id, rgb, hex, label }) => (
            <button
              key={id}
              onClick={() => aplicarColor(id, rgb)}
              title={label}
              className="flex flex-col items-center gap-1.5 group"
            >
              <span
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-transform group-hover:scale-110 ${colorAcento === id ? 'ring-4 ring-offset-2 ring-current scale-110' : ''}`}
                style={{ backgroundColor: hex, color: hex }}
              >
                {colorAcento === id && <span className="text-white text-lg font-bold">✓</span>}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tamaño de la app */}
      <div className="pt-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.ajustes_tamano}</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'pequeno', label: t.ajustes_pequeno,    desc: '88%' },
            { value: 'normal',  label: t.ajustes_normal_tam, desc: '100%' },
            { value: 'grande',  label: t.ajustes_grande,     desc: '125%' },
          ] as const).map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => aplicarTamano(value)}
              className={`flex flex-col items-center gap-1 py-3 rounded-card border-2 text-sm font-medium transition-colors ${
                tamano === value
                  ? 'border-green-select bg-accent-light text-green-select'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className={value === 'pequeno' ? 'text-sm' : value === 'normal' ? 'text-xl' : 'text-3xl'} style={{ fontWeight: 700, lineHeight: 1 }}>A</span>
              <span className="text-xs">{label}</span>
              <span className="text-[10px] text-gray-400">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Apariencia */}
      <div className="pt-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.ajustes_apariencia}</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'light',  label: t.ajustes_claro,   emoji: '☀️' },
            { value: 'dark',   label: t.ajustes_oscuro,  emoji: '🌙' },
            { value: 'system', label: t.ajustes_sistema, emoji: '⚙️' },
          ] as const).map(({ value, label, emoji }) => (
            <button
              key={value}
              onClick={() => aplicarTema(value)}
              className={`flex flex-col items-center gap-1 py-3 rounded-card border-2 text-sm font-medium transition-colors ${
                tema === value
                  ? 'border-green-select bg-accent-light text-green-select'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">{emoji}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Idioma */}
      <div className="pt-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.ajustes_idioma}</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            {
              value: 'es', label: 'Español',
              flag: (
                <svg viewBox="0 0 24 24" width="24" height="24" className="rounded-full overflow-hidden shrink-0">
                  <rect width="24" height="24" fill="#c60b1e"/>
                  <rect y="6" width="24" height="12" fill="#ffc400"/>
                </svg>
              ),
            },
            {
              value: 'ca', label: 'Català',
              flag: (
                <svg viewBox="0 0 24 24" width="24" height="24" className="rounded-full overflow-hidden shrink-0">
                  <rect width="24" height="24" fill="#fcdd09"/>
                  <rect y="3"  width="24" height="3" fill="#da121a"/>
                  <rect y="9"  width="24" height="3" fill="#da121a"/>
                  <rect y="15" width="24" height="3" fill="#da121a"/>
                  <rect y="21" width="24" height="3" fill="#da121a"/>
                </svg>
              ),
            },
          ] as const).map(({ value, label, flag }) => (
            <button
              key={value}
              onClick={() => setLang(value)}
              className={`flex items-center justify-center gap-2 py-3 rounded-card border-2 text-sm font-medium transition-colors ${
                lang === value
                  ? 'border-green-select bg-accent-light text-green-select'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
              }`}
            >
              {flag}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Guardar */}
      <div className="mt-8">
        <button
          onClick={guardarCambios}
          disabled={guardando}
          className="w-full bg-green-select text-white rounded-card py-3 font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors"
        >
          {guardado ? t.btn_guardado : guardando ? t.btn_guardando : t.ajustes_guardar_cambios}
        </button>
      </div>

      {/* Feedback + Privacidad + cerrar sesión */}
      <div className="mt-6 space-y-3">
        {estadoNotif !== 'no-soportado' && (
          <div className="w-full border border-gray-200 dark:border-gray-700 rounded-card px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔔</span>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{t.ajustes_recordatorio}</p>
                  <p className="text-xs text-gray-400">
                    {estadoNotif === 'concedido'
                      ? `${DIAS_SEMANA.find(d => d.value === notifDia)?.label} a las ${notifHora}`
                      : t.ajustes_recordatorio_desc}
                  </p>
                </div>
              </div>
              {estadoNotif === 'denegado' ? (
                <span className="text-xs text-gray-400">{t.ajustes_bloqueado}</span>
              ) : (
                <button
                  onClick={estadoNotif === 'concedido' ? desactivarNotif : () => activarNotif()}
                  disabled={estadoNotif === 'cargando'}
                  className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${estadoNotif === 'concedido' ? 'bg-green-select' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${estadoNotif === 'concedido' ? 'translate-x-5' : ''}`} />
                </button>
              )}
            </div>
            {estadoNotif === 'concedido' && (
              <div className="flex gap-2 pt-1">
                <select
                  value={notifDia}
                  onChange={e => actualizarHorario(Number(e.target.value), notifHora)}
                  className="flex-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-select"
                >
                  {DIAS_SEMANA.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                <select
                  value={notifHora}
                  onChange={e => actualizarHorario(notifDia, e.target.value)}
                  className="flex-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-select"
                >
                  {HORAS_DISPONIBLES.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
        <button
          onClick={() => setModalFeedback(true)}
          className="w-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-card py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {t.ajustes_feedback}
        </button>
        <button
          onClick={() => navigate('/privacidad')}
          className="w-full text-sm text-gray-400 hover:text-gray-600 py-2"
        >
          {t.ajustes_privacidad}
        </button>
        {!window.matchMedia('(display-mode: standalone)').matches && (
          <button
            onClick={async () => {
              const p = getInstallPrompt()
              if (p) {
                await p.prompt()
              } else {
                // Chrome aún no ha ofrecido el prompt — dar instrucciones manuales
                alert('Para instalar: abre el menú del navegador (⋮) y selecciona "Añadir a pantalla de inicio" o "Instalar aplicación".')
              }
            }}
            className="w-full flex items-center justify-center gap-2 border border-green-400/40 dark:border-green-600/40 text-green-600 dark:text-green-400 rounded-card py-3 text-sm font-semibold hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors"
          >
            📲 Instalar app en este dispositivo
          </button>
        )}
        <button
          onClick={cerrarSesion}
          className="w-full border border-red-200 dark:border-red-900 text-red-500 rounded-card py-3 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
        >
          {t.ajustes_cerrar_sesion}
        </button>
        <button
          onClick={() => setModalEliminar(true)}
          className="w-full text-xs text-gray-400 hover:text-red-500 py-2 transition-colors"
        >
          {t.ajustes_eliminar_cuenta}
        </button>
        <button
          onClick={async () => {
            if ('serviceWorker' in navigator) {
              const regs = await navigator.serviceWorker.getRegistrations()
              await Promise.all(regs.map(r => r.unregister()))
            }
            if ('caches' in window) {
              const keys = await caches.keys()
              await Promise.all(keys.map(k => caches.delete(k)))
            }
            window.location.reload()
          }}
          className="w-full text-xs text-gray-400 hover:text-blue-500 py-2 transition-colors"
        >
          {t.ajustes_forzar_update}
        </button>
      </div>

      {/* Modal eliminar cuenta */}
      {modalEliminar && createPortal(
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setModalEliminar(false) }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="text-center">
              <p className="text-4xl mb-2">⚠️</p>
              <h2 className="text-lg font-black text-red-600 mb-1">{t.ajustes_eliminar_cuenta}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t.eliminar_desc}</p>
            </div>

            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 bg-red-50 dark:bg-red-950/40 rounded-xl p-4">
              <li>{t.eliminar_item1}</li>
              <li>{t.eliminar_item2}</li>
              <li>{t.eliminar_item3}</li>
              <li>{t.eliminar_item4}</li>
            </ul>

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {t.eliminar_nota}
            </p>

            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5">{t.eliminar_escribe}</label>
              <input
                type="text"
                value={confirmTexto}
                onChange={e => setConfirmTexto(e.target.value)}
                placeholder={t.eliminar_confirm_palabra}
                className="w-full border-2 border-red-200 dark:border-red-800 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:border-red-500"
              />
            </div>

            {errorEliminar && <p className="text-sm text-red-500 text-center">{errorEliminar}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setModalEliminar(false); setConfirmTexto(''); setErrorEliminar('') }}
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl py-3 text-sm font-medium"
              >
                {t.btn_cancelar}
              </button>
              <button
                onClick={eliminarCuenta}
                disabled={confirmTexto !== 'ELIMINAR' || eliminando}
                className="flex-1 bg-red-500 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-40 transition-opacity"
              >
                {eliminando ? t.eliminar_btn_cargando : t.eliminar_btn}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
