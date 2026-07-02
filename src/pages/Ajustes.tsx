import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TagInput } from '../components/ui/TagInput'
import { FeedbackModal } from '../components/FeedbackModal'
import { Avatar } from '../components/Avatar'
import { usePerfil } from '../hooks/usePerfil'
import { useUsuario } from '../hooks/useUsuario'
import { useAmigos } from '../hooks/useAmigos'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { guardar, recuperar } from '../lib/storage'
import type { Objetivo, DificultadPreferida, Perfil, Dia } from '../types'
import { DIAS, DIAS_LABEL } from '../types'

const DIFICULTADES: { value: DificultadPreferida; label: string; emoji: string; desc: string }[] = [
  { value: 'fácil',     label: 'Fácil',     emoji: '😊', desc: 'Recetas simples, menos de 30 min' },
  { value: 'media',     label: 'Media',     emoji: '👨‍🍳', desc: 'Equilibrio entre sencillo y elaborado' },
  { value: 'difícil',   label: 'Difícil',   emoji: '🔥', desc: 'Recetas elaboradas para chefs' },
  { value: 'combinado', label: 'Combinado', emoji: '🎲', desc: 'Mezcla de todo, variedad máxima' },
]

const OBJETIVOS: { value: Objetivo; label: string; emoji: string }[] = [
  { value: 'sin_restriccion', label: 'Sin restricciones', emoji: '🍽️' },
  { value: 'bajar_peso',      label: 'Bajar peso',        emoji: '⚖️' },
  { value: 'mas_proteina',    label: 'Más proteína',      emoji: '💪' },
  { value: 'vegetariano',     label: 'Vegetariano',       emoji: '🥦' },
  { value: 'vegano',          label: 'Vegano',            emoji: '🌱' },
  { value: 'sin_gluten',      label: 'Sin gluten',        emoji: '🌾' },
]

type Draft = Omit<Perfil, 'id' | 'usuario_id'>

const AVATARES = ['🧑', '👩', '👨', '🧑‍🍳', '👩‍🍳', '👨‍🍳', '🧑‍💻', '🦸', '🧙', '🐱', '🐶', '🦊', '🐸', '🦋', '🌟', '🍕', '🥑', '🌮']

export default function Ajustes() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { perfil, guardarPerfil } = usePerfil()
  const { usuario, guardarUsuario, recargar: recargarUsuario } = useUsuario()
  const { amigos, pendientesRecibidas, totalPendientes, loading: cargandoAmigos, buscarUsuario, enviarSolicitud, aceptarSolicitud, rechazarOEliminar } = useAmigos()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [modalFeedback, setModalFeedback] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Perfil de usuario
  const [nombreDisplay, setNombreDisplay] = useState('')
  const [username, setUsername] = useState('')
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

  // Amigos
  const [busquedaAmigo, setBusquedaAmigo] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Awaited<ReturnType<typeof buscarUsuario>>>([])
  const [buscando, setBuscando] = useState(false)
  const [enviandoSolicitud, setEnviandoSolicitud] = useState<string | null>(null)
  const [errorAmigo, setErrorAmigo] = useState('')

  useEffect(() => {
    if (usuario) {
      setNombreDisplay(usuario.nombre_display ?? '')
      setUsername(usuario.username ?? '')
      setAvatarEmoji(usuario.avatar_emoji ?? '🧑')
      setAvatarUrl(usuario.avatar_url ?? null)
    }
  }, [usuario])

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
        canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.85)
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
      username: username || undefined,
      avatar_emoji: avatarEmoji,
    })
    setGuardandoUsuario(false)
    if (error) setErrorUsuario(error)
    else { setGuardadoUsuario(true); setTimeout(() => setGuardadoUsuario(false), 2000) }
  }

  async function handleBuscarAmigo(q: string) {
    setBusquedaAmigo(q)
    if (q.length < 2) { setResultadosBusqueda([]); return }
    setBuscando(true)
    const res = await buscarUsuario(q)
    setResultadosBusqueda(res)
    setBuscando(false)
  }

  async function handleEnviarSolicitud(receptorId: string) {
    setEnviandoSolicitud(receptorId)
    setErrorAmigo('')
    const { error } = await enviarSolicitud(receptorId)
    setEnviandoSolicitud(null)
    if (error) setErrorAmigo(error)
    else { setBusquedaAmigo(''); setResultadosBusqueda([]) }
  }
  // Ajustes del menú semanal (comparte localStorage con Menu.tsx)
  type DiasConfig = 'semana' | 'laboral' | 'personalizado'
  type FranjaConfig = 'ambas' | 'comida' | 'cena'
  const [diasConfig, setDiasConfigRaw] = useState<DiasConfig>(() => recuperar<DiasConfig>('menu_dias_config') ?? 'semana')
  const [diasPersonalizados, setDiasPersonalizadosRaw] = useState<Set<Dia>>(() => new Set(recuperar<Dia[]>('menu_dias_personalizados') ?? DIAS))
  const [franjaConfig, setFranjaConfigRaw] = useState<FranjaConfig>(() => recuperar<FranjaConfig>('menu_franja_config') ?? 'ambas')
  function setDiasConfig(v: DiasConfig) { setDiasConfigRaw(v); guardar('menu_dias_config', v) }
  function setDiasPersonalizados(fn: (prev: Set<Dia>) => Set<Dia>) {
    setDiasPersonalizadosRaw(prev => { const next = fn(prev); guardar('menu_dias_personalizados', Array.from(next)); return next })
  }
  function setFranjaConfig(v: FranjaConfig) { setFranjaConfigRaw(v); guardar('menu_franja_config', v) }

  const [tema, setTema] = useState<'light' | 'dark' | 'system'>(() => {
    const t = localStorage.getItem('semana-lista:theme')
    return (t === 'dark' || t === 'light') ? t : 'system'
  })

  const [tamano, setTamano] = useState<'normal' | 'mediano' | 'grande'>(() => {
    const t = localStorage.getItem('semana-lista:tamano')
    return (t === 'mediano' || t === 'grande') ? t : 'normal'
  })

  function aplicarTamano(t: 'normal' | 'mediano' | 'grande') {
    setTamano(t)
    const sizes = { normal: '100%', mediano: '112.5%', grande: '125%' }
    document.documentElement.style.fontSize = sizes[t]
    localStorage.setItem('semana-lista:tamano', t)
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

  async function guardar() {
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
      <h1 className="text-2xl font-black tracking-tight mb-6 mt-2">Ajustes</h1>

      {/* ── Perfil de usuario ────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-card shadow-card p-4 mb-6 space-y-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Perfil público</p>

        {/* Avatar: foto o emoji */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Avatar</p>
          <div className="flex items-start gap-4">
            {/* Foto actual / emoji, clic para subir */}
            <div className="relative shrink-0">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative group rounded-full overflow-hidden"
                title="Cambiar foto"
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
                  title="Quitar foto"
                >✕</button>
              )}
            </div>
            {/* Emojis */}
            <div className="flex flex-wrap gap-1.5">
              {AVATARES.map(e => (
                <button
                  key={e}
                  onClick={() => setAvatarEmoji(e)}
                  className={`text-xl w-9 h-9 rounded-xl border-2 transition-colors ${avatarEmoji === e && !avatarUrl ? 'border-green-select bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Toca el avatar para subir una foto (se redimensiona automáticamente), o elige un emoji</p>
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
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Nombre para mostrar</label>
          <input
            type="text"
            value={nombreDisplay}
            onChange={e => setNombreDisplay(e.target.value)}
            placeholder="Tu nombre o apodo"
            maxLength={40}
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-select"
          />
        </div>

        {/* Username */}
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Nombre de usuario <span className="text-gray-400">(único, para compartir listas)</span></label>
          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-green-select bg-white dark:bg-gray-900">
            <span className="px-3 text-gray-400 text-sm select-none">@</span>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
              placeholder="tu_usuario"
              maxLength={20}
              className="flex-1 py-2 pr-3 text-sm bg-transparent focus:outline-none"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Letras, números y _ · 3–20 caracteres</p>
        </div>

        {errorUsuario && <p className="text-sm text-red-500">{errorUsuario}</p>}

        <button
          onClick={guardarPerfilUsuario}
          disabled={guardandoUsuario || subiendoFoto}
          className="w-full bg-green-select text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {guardadoUsuario ? '✓ Guardado' : guardandoUsuario ? 'Guardando...' : 'Guardar perfil'}
        </button>
      </div>

      {/* ── Amigos ───────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-card shadow-card p-4 mb-6 space-y-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Amigos {totalPendientes > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{totalPendientes}</span>}
        </p>

        {/* Buscar usuario */}
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5">Buscar por @usuario o nombre</label>
          <input
            type="text"
            value={busquedaAmigo}
            onChange={e => handleBuscarAmigo(e.target.value)}
            placeholder="@usuario o nombre..."
            className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-select"
          />
          {buscando && <p className="text-xs text-gray-400 mt-1">Buscando...</p>}
          {errorAmigo && <p className="text-xs text-red-500 mt-1">{errorAmigo}</p>}
          {resultadosBusqueda.length > 0 && (
            <div className="mt-2 border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
              {resultadosBusqueda.map(u => {
                const yaAmigo = amigos.some(a => a.otro?.id === u.id)
                return (
                  <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <Avatar url={u.avatar_url} emoji={u.avatar_emoji} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.nombre_display || u.username || 'Usuario'}</p>
                      {u.username && <p className="text-xs text-gray-400">@{u.username}</p>}
                    </div>
                    {yaAmigo ? (
                      <span className="text-xs text-green-select font-medium">✓ Amigo</span>
                    ) : (
                      <button
                        onClick={() => handleEnviarSolicitud(u.id)}
                        disabled={enviandoSolicitud === u.id}
                        className="text-xs bg-green-select text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                      >
                        {enviandoSolicitud === u.id ? '...' : 'Añadir'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Solicitudes recibidas */}
        {pendientesRecibidas.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Solicitudes recibidas</p>
            <div className="space-y-2">
              {pendientesRecibidas.map(a => (
                <div key={a.id} className="flex items-center gap-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl px-3 py-2.5">
                  <Avatar url={a.otro?.avatar_url} emoji={a.otro?.avatar_emoji} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.otro?.nombre_display || a.otro?.username || 'Usuario'}</p>
                    {a.otro?.username && <p className="text-xs text-gray-400">@{a.otro.username}</p>}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => aceptarSolicitud(a.id)}
                      className="text-xs bg-green-select text-white px-2.5 py-1.5 rounded-lg font-medium"
                    >✓</button>
                    <button
                      onClick={() => rechazarOEliminar(a.id)}
                      className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1.5 rounded-lg font-medium"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de amigos */}
        {!cargandoAmigos && amigos.length === 0 && pendientesRecibidas.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-2">Busca a tus amigos por su @usuario para añadirlos</p>
        )}
        {amigos.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Tus amigos ({amigos.length})</p>
            <div className="space-y-2">
              {amigos.map(a => (
                <div key={a.id} className="flex items-center gap-3">
                  <Avatar url={a.otro?.avatar_url} emoji={a.otro?.avatar_emoji} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.otro?.nombre_display || a.otro?.username || 'Usuario'}</p>
                    {a.otro?.username && <p className="text-xs text-gray-400">@{a.otro.username}</p>}
                  </div>
                  <button
                    onClick={() => rechazarOEliminar(a.id)}
                    className="text-xs text-gray-400 hover:text-red-500 px-2 py-1"
                    title="Eliminar amigo"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <section className="space-y-5">
        {/* Personas */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Personas en el hogar</p>
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
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Presupuesto semanal (€)</p>
          <input
            type="number" min={20} max={500}
            value={draft.presupuesto}
            onChange={e => set('presupuesto', Number(e.target.value))}
            className="w-full border-2 rounded-card px-4 py-2 text-xl font-bold text-center bg-white dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:border-green-select"
          />
        </div>

        {/* CP */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Código postal</p>
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
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Objetivo nutricional</p>
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
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dificultad de las recetas</p>
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
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ingredientes favoritos</p>
          <TagInput
            tags={draft.ingredientes_si}
            onChange={tags => set('ingredientes_si', tags)}
            placeholder="pollo, lentejas, tomate..."
          />
        </div>

        {/* Ingredientes a evitar */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ingredientes a evitar</p>
          <TagInput
            tags={draft.ingredientes_no}
            onChange={tags => set('ingredientes_no', tags)}
            placeholder="marisco, cilantro..."
          />
        </div>

      </section>

      {/* Menús recientes */}
      {semanasGuardadas.length > 0 && (
        <div className="pt-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">📅 Menús recientes</p>
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

      {/* Ajustes del menú semanal */}
      <div className="pt-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">⚙️ Ajustes del menú semanal</p>
        <div className="bg-white dark:bg-gray-900 rounded-card border border-gray-100 dark:border-gray-800 p-4 space-y-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">¿Para cuántos días?</p>
            <div className="flex gap-2">
              {([
                { key: 'semana',       label: 'Semana completa' },
                { key: 'laboral',      label: 'Lun – Vie' },
                { key: 'personalizado', label: 'Personalizado' },
              ] as const).map(({ key, label }) => (
                <button key={key} onClick={() => setDiasConfig(key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${diasConfig === key ? 'border-green-select bg-green-50 dark:bg-green-900/30 text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                  {label}
                </button>
              ))}
            </div>
            {diasConfig === 'personalizado' && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {DIAS.map(d => (
                  <button key={d} onClick={() => setDiasPersonalizados(prev => { const next = new Set(prev); next.has(d) ? next.delete(d) : next.add(d); return next })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-colors ${diasPersonalizados.has(d) ? 'border-green-select bg-green-50 dark:bg-green-900/30 text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                    {DIAS_LABEL[d].slice(0, 3)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">¿Qué comidas?</p>
            <div className="flex gap-2">
              {([
                { key: 'ambas',  label: '🍽️ Comida y cena' },
                { key: 'comida', label: '☀️ Solo comida' },
                { key: 'cena',   label: '🌙 Solo cena' },
              ] as const).map(({ key, label }) => (
                <button key={key} onClick={() => setFranjaConfig(key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${franjaConfig === key ? 'border-green-select bg-green-50 dark:bg-green-900/30 text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tamaño de la app */}
      <div className="pt-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tamaño del texto</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'normal',  label: 'Normal',  emoji: 'A',  desc: '100%' },
            { value: 'mediano', label: 'Mediano', emoji: 'A',  desc: '112%' },
            { value: 'grande',  label: 'Grande',  emoji: 'A',  desc: '125%' },
          ] as const).map(({ value, label, emoji, desc }) => (
            <button
              key={value}
              onClick={() => aplicarTamano(value)}
              className={`flex flex-col items-center gap-1 py-3 rounded-card border-2 text-sm font-medium transition-colors ${
                tamano === value
                  ? 'border-green-select bg-green-50 dark:bg-green-900/30 text-green-select'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className={value === 'normal' ? 'text-base' : value === 'mediano' ? 'text-xl' : 'text-3xl'} style={{ fontWeight: 700, lineHeight: 1 }}>{emoji}</span>
              <span className="text-xs">{label}</span>
              <span className="text-[10px] text-gray-400">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Apariencia */}
      <div className="pt-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Apariencia</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'light',  label: 'Claro',   emoji: '☀️' },
            { value: 'dark',   label: 'Oscuro',  emoji: '🌙' },
            { value: 'system', label: 'Sistema', emoji: '⚙️' },
          ] as const).map(({ value, label, emoji }) => (
            <button
              key={value}
              onClick={() => aplicarTema(value)}
              className={`flex flex-col items-center gap-1 py-3 rounded-card border-2 text-sm font-medium transition-colors ${
                tema === value
                  ? 'border-green-select bg-green-50 dark:bg-green-900/30 text-green-select'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className="text-xl">{emoji}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Guardar */}
      <div className="mt-8">
        <button
          onClick={guardar}
          disabled={guardando}
          className="w-full bg-green-select text-white rounded-card py-3 font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors"
        >
          {guardado ? '✓ Guardado' : guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Feedback + Privacidad + cerrar sesión */}
      <div className="mt-6 space-y-3">
        <button
          onClick={() => setModalFeedback(true)}
          className="w-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-card py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          💬 Enviar feedback
        </button>
        <button
          onClick={() => navigate('/privacidad')}
          className="w-full text-sm text-gray-400 hover:text-gray-600 py-2"
        >
          Política de privacidad
        </button>
        <button
          onClick={cerrarSesion}
          className="w-full border border-red-200 dark:border-red-900 text-red-500 rounded-card py-3 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
        >
          Cerrar sesión
        </button>
        <button
          onClick={() => setModalEliminar(true)}
          className="w-full text-xs text-gray-400 hover:text-red-500 py-2 transition-colors"
        >
          Eliminar cuenta
        </button>
      </div>

      {/* Modal eliminar cuenta */}
      {modalEliminar && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setModalEliminar(false) }}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="text-center">
              <p className="text-4xl mb-2">⚠️</p>
              <h2 className="text-lg font-black text-red-600 mb-1">Eliminar cuenta</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Esta acción es <strong>permanente e irreversible</strong>. Se eliminarán:</p>
            </div>

            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 bg-red-50 dark:bg-red-950/40 rounded-xl p-4">
              <li>🗑️ Tu perfil y datos personales</li>
              <li>📋 Todas las listas compartidas que hayas <strong>creado</strong> (y sus artículos, para todos los miembros)</li>
              <li>👥 Tus amistades y solicitudes pendientes</li>
              <li>🍽️ Tu menú semanal y configuración</li>
            </ul>

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Las listas compartidas <strong>creadas por otros</strong> donde eras miembro seguirán existiendo.
            </p>

            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1.5">Escribe <strong>ELIMINAR</strong> para confirmar</label>
              <input
                type="text"
                value={confirmTexto}
                onChange={e => setConfirmTexto(e.target.value)}
                placeholder="ELIMINAR"
                className="w-full border-2 border-red-200 dark:border-red-800 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:border-red-500"
              />
            </div>

            {errorEliminar && <p className="text-sm text-red-500 text-center">{errorEliminar}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setModalEliminar(false); setConfirmTexto(''); setErrorEliminar('') }}
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl py-3 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarCuenta}
                disabled={confirmTexto !== 'ELIMINAR' || eliminando}
                className="flex-1 bg-red-500 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-40 transition-opacity"
              >
                {eliminando ? 'Eliminando...' : 'Eliminar todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
