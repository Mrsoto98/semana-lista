// src/App.tsx
import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { usePerfil } from './hooks/usePerfil'
import { useListasCompartidas, ListasCompartidasProvider, type ListaCompartida } from './hooks/useListaCompartida'
import { guardar, recuperar } from './lib/storage'
import { ErrorBoundary } from './components/ErrorBoundary'
import { OfflineBanner } from './components/OfflineBanner'
import { Tutorial } from './components/Tutorial'


const Auth       = lazy(() => import('./pages/Auth'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Menu       = lazy(() => import('./pages/Menu'))
const Lista      = lazy(() => import('./pages/Lista'))
const Exportar   = lazy(() => import('./pages/Exportar'))
const Ajustes    = lazy(() => import('./pages/Ajustes'))
const Privacidad = lazy(() => import('./pages/Privacidad'))
const MenuPublico     = lazy(() => import('./pages/MenuPublico'))
const ListaCompartida = lazy(() => import('./pages/ListaCompartida'))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-3xl animate-spin">🥗</div>
    </div>
  )
}

function ModalCrearLista({ onClose, onCreada, modoInicial = 'crear', crearLista, unirseConCodigo }: {
  onClose: () => void
  onCreada: (lista: ListaCompartida) => void
  modoInicial?: 'crear' | 'unirse'
  crearLista: (nombre: string) => Promise<{ lista: ListaCompartida | null; error?: string }>
  unirseConCodigo: (codigo: string) => Promise<{ ok: boolean; pendiente?: boolean; error?: string; lista?: ListaCompartida }>
}) {
  const [modo, setModo] = useState<'crear' | 'unirse'>(modoInicial)
  const [paso, setPaso] = useState<1 | 2>(1)
  const [nombreNueva, setNombreNueva] = useState('')
  const [codigoUnirse, setCodigoUnirse] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [listaCreada, setListaCreada] = useState<ListaCompartida | null>(null)
  const [copiado, setCopiado] = useState(false)

  async function handleCrear() {
    if (!nombreNueva.trim()) { setError('Escribe un nombre para la lista'); return }
    setCargando(true); setError('')
    const { lista, error: err } = await crearLista(nombreNueva.trim())
    setCargando(false)
    if (err || !lista) { setError(err ?? 'No se pudo crear la lista'); return }
    setListaCreada(lista)
    setPaso(2)
  }

  const [solicitudEnviada, setSolicitudEnviada] = useState(false)

  async function handleUnirse() {
    if (!codigoUnirse.trim()) { setError('Introduce el código de la lista'); return }
    setCargando(true); setError('')
    const { ok, pendiente, error: err } = await unirseConCodigo(codigoUnirse.trim())
    setCargando(false)
    if (!ok) { setError(err ?? 'Código incorrecto o lista no encontrada'); return }
    if (pendiente) { setSolicitudEnviada(true); return }
  }

  function copiarCodigo() {
    if (!listaCreada) return
    navigator.clipboard.writeText(listaCreada.codigo)
    setCopiado(true); setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={paso === 1 ? onClose : undefined}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-5" />

        {paso === 1 ? (
          <>
            <p className="text-3xl text-center mb-3">👥</p>
            <h2 className="text-xl font-black text-gray-800 dark:text-gray-100 text-center mb-1">Listas compartidas</h2>
            <p className="text-sm text-gray-400 text-center mb-5">Comparte la compra con tu pareja, familia o compañeros de piso.</p>

            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1 mb-5">
              <button onClick={() => { setModo('crear'); setError('') }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${modo === 'crear' ? 'bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-gray-100' : 'text-gray-400'}`}>
                Crear lista
              </button>
              <button onClick={() => { setModo('unirse'); setError('') }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${modo === 'unirse' ? 'bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-gray-100' : 'text-gray-400'}`}>
                Unirme con código
              </button>
            </div>

            {solicitudEnviada ? (
              <div className="text-center py-4">
                <p className="text-4xl mb-3">⏳</p>
                <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 mb-2">Solicitud enviada</h3>
                <p className="text-sm text-gray-400 mb-6">El administrador de la lista tiene que aceptarte. Te aparecerá automáticamente cuando lo haga.</p>
                <button onClick={onClose} className="w-full bg-green-select text-white rounded-2xl py-3 font-bold">Entendido</button>
              </div>
            ) : modo === 'crear' ? (
              <>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">Nombre de la lista</label>
                <input autoFocus type="text" value={nombreNueva}
                  onChange={e => { setNombreNueva(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleCrear()}
                  placeholder="Ej: Casa, Piso, Familia..."
                  className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-base bg-white dark:bg-gray-800 focus:outline-none focus:border-green-select mb-2"
                />
                {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
                <button onClick={handleCrear} disabled={cargando || !nombreNueva.trim()}
                  className="w-full bg-green-select text-white rounded-2xl py-3.5 font-black text-base shadow-lg disabled:opacity-50 mb-3">
                  {cargando ? 'Creando...' : 'Siguiente →'}
                </button>
              </>
            ) : (
              <>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5">Código de la lista</label>
                <input autoFocus type="text" value={codigoUnirse}
                  onChange={e => { setCodigoUnirse(e.target.value.toUpperCase()); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleUnirse()}
                  placeholder="Ej: AB12CD"
                  className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-base font-mono tracking-widest bg-white dark:bg-gray-800 focus:outline-none focus:border-green-select mb-2"
                />
                {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
                <button onClick={handleUnirse} disabled={cargando || !codigoUnirse.trim()}
                  className="w-full bg-green-select text-white rounded-2xl py-3.5 font-black text-base shadow-lg disabled:opacity-50 mb-3">
                  {cargando ? 'Uniéndome...' : 'Unirme a la lista'}
                </button>
              </>
            )}
            {!solicitudEnviada && <button onClick={onClose} className="w-full text-sm text-gray-400 py-2">Cancelar</button>}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-select text-xl">✓</span>
              <h2 className="text-xl font-black text-gray-800 dark:text-gray-100">¡Lista creada!</h2>
            </div>
            <p className="text-sm text-gray-400 mb-5">Comparte el código con quien quieras. Podrás invitar amigos también desde dentro de la lista.</p>

            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Código para compartir</p>
            <button onClick={copiarCodigo}
              className="w-full flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-select/30 rounded-2xl px-4 py-3.5 mb-6">
              <span className="text-2xl font-black tracking-widest text-green-select">{listaCreada?.codigo}</span>
              <span className="text-sm text-green-select font-semibold">{copiado ? '✓ Copiado' : 'Copiar'}</span>
            </button>

            <button onClick={() => listaCreada && onCreada(listaCreada)}
              className="w-full bg-green-select text-white rounded-2xl py-3.5 font-black text-base shadow-lg mb-2">
              Ir a la lista
            </button>
            <button onClick={onClose} className="w-full text-sm text-gray-400 py-2">
              Hacer esto más tarde
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { listas, abandonarLista, solicitudesPendientes, crearLista, unirseConCodigo } = useListasCompartidas()
  const [modalListas, setModalListas] = useState(false)
  const [modalCrear, setModalCrear] = useState(false)
  const [modoModalCrear, setModoModalCrear] = useState<'crear' | 'unirse'>('crear')
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null)

  const hidden = ['/', '/onboarding', '/privacidad'].includes(location.pathname) || location.pathname.startsWith('/menu/')
  if (!user || hidden) return null

  const listaActivaId = recuperar<string>('lista_compartida_principal')

  function handleCompartidaClick() {
    if (listas.length === 0) { setModalCrear(true); return }
    setModalListas(true)
  }

  const isCompartidaActive = location.pathname.startsWith('/lista-compartida')

  const TAB_ICONS: Record<string, (active: boolean) => React.ReactNode> = {
    exportar: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#22c55e' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v10m0-10L8.5 6.5M12 3l3.5 3.5"/>
        <path d="M4 14v5a1 1 0 001 1h14a1 1 0 001-1v-5"/>
      </svg>
    ),
    ajustes: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#22c55e' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
    lista: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#22c55e' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 01-8 0"/>
      </svg>
    ),
    compartida: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#22c55e' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/>
        <path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    menu: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#22c55e' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="8" y1="14" x2="8" y2="14"/>
        <line x1="12" y1="14" x2="12" y2="14"/>
        <line x1="16" y1="14" x2="16" y2="14"/>
        <line x1="8" y1="18" x2="8" y2="18"/>
        <line x1="12" y1="18" x2="12" y2="18"/>
      </svg>
    ),
  }

  const tabs = [
    { key: 'exportar',   path: '/exportar', label: 'Exportar' },
    { key: 'ajustes',    path: '/ajustes',  label: 'Ajustes' },
    { key: 'lista',      path: '/lista',    label: 'Lista' },
    { key: 'compartida', path: '',          label: 'Compartida' },
    { key: 'menu',       path: '/menu',     label: 'Menú' },
  ] as const

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center max-w-lg mx-auto pointer-events-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)', paddingTop: '0' }}
      >
        <div className="flex gap-2 pointer-events-auto px-3">
          {tabs.map(({ key, path, label }) => {
            const active = key === 'compartida' ? isCompartidaActive : location.pathname === path
            return (
              <button
                key={key}
                {...(key === 'compartida' ? { 'data-tutorial': 'nav-compartida' } : {})}
                onClick={() => key === 'compartida' ? handleCompartidaClick() : navigate(path)}
                className={`flex flex-col items-center gap-1.5 w-[64px] py-3 rounded-2xl border transition-all duration-200 ${
                  active
                    ? 'bg-white/85 dark:bg-gray-800/85 border-white/80 dark:border-gray-600/60 shadow-xl shadow-black/15 scale-105'
                    : 'bg-white/50 dark:bg-gray-900/50 border-white/40 dark:border-gray-700/40 shadow-md shadow-black/8'
                }`}
                style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
              >
                <span className={`relative inline-block transition-transform duration-200 ${active ? 'scale-110' : ''} ${active ? 'text-green-select' : 'text-gray-400 dark:text-gray-500'}`}>
                  {TAB_ICONS[key](active)}
                  {key === 'compartida' && solicitudesPendientes > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">
                      {solicitudesPendientes}
                    </span>
                  )}
                </span>
                <span className={`text-[11.5px] font-semibold tracking-wide ${active ? 'text-green-select' : 'text-gray-400 dark:text-gray-500'}`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Modal crear / unirse lista */}
      {modalCrear && (
        <ModalCrearLista
          modoInicial={modoModalCrear}
          crearLista={crearLista}
          unirseConCodigo={unirseConCodigo}
          onClose={() => setModalCrear(false)}
          onCreada={lista => { setModalCrear(false); navigate(`/lista-compartida/${lista.id}`) }}
        />
      )}

      {/* Modal selector de listas compartidas */}
      {modalListas && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => setModalListas(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-black text-gray-800 dark:text-gray-100 mb-1">Listas compartidas</h2>
            <p className="text-xs text-gray-400 mb-4">Toca una para abrirla. Mantén pulsado para marcarla como principal.</p>
            <div className="space-y-2 mb-4">
              {listas.map(lista => {
                const esPrincipal = lista.id === listaActivaId || (!listaActivaId && lista.id === listas[0]?.id)
                const confirmando = confirmEliminar === lista.id
                return (
                  <div key={lista.id} className="rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button onClick={() => setConfirmEliminar(confirmando ? null : lista.id)}
                        className="text-red-400 hover:text-red-600 transition-colors p-1 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                      <button className="flex-1 flex items-center gap-3 text-left min-w-0"
                        onClick={() => { setModalListas(false); setConfirmEliminar(null); navigate(`/lista-compartida/${lista.id}`) }}
                        onContextMenu={e => { e.preventDefault(); guardar('lista_compartida_principal', lista.id); setModalListas(false) }}>
                        <span className="text-2xl">👥</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{lista.nombre}</p>
                          <p className="text-xs text-gray-400">{lista.codigo}</p>
                        </div>
                        {esPrincipal && <span className="text-xs text-green-select font-bold bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Principal</span>}
                      </button>
                    </div>
                    {confirmando && (
                      <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 bg-red-50 dark:bg-red-900/20">
                        <p className="text-xs text-red-600 dark:text-red-400 mb-2">¿Salir de esta lista? Perderás el acceso.</p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmEliminar(null)}
                            className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500">
                            Cancelar
                          </button>
                          <button onClick={async () => {
                            await abandonarLista(lista.id)
                            setConfirmEliminar(null)
                            if (listas.length <= 1) setModalListas(false)
                          }}
                            className="flex-1 text-xs py-1.5 rounded-lg bg-red-500 text-white font-semibold">
                            Salir de la lista
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2">
              {listas.length < 2 && (
                <button
                  onClick={() => { setModalListas(false); setModoModalCrear('crear'); setModalCrear(true) }}
                  className="flex-1 flex items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl py-3 text-sm text-gray-400 hover:border-green-select/50 hover:text-green-select transition-colors">
                  <span>+</span> Nueva lista
                </button>
              )}
              <button
                onClick={() => { setModalListas(false); setModoModalCrear('unirse'); setModalCrear(true) }}
                className="flex-1 flex items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl py-3 text-sm text-gray-400 hover:border-green-select/50 hover:text-green-select transition-colors">
                🔑 Unirme con código
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-4">Mantén pulsado para cambiar la lista principal</p>
          </div>
        </div>
      )}
    </>
  )
}


function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function ProtectedConPerfil({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { perfil, loading: perfilLoading } = usePerfil()

  if (authLoading || perfilLoading) return null
  if (!user) return <Navigate to="/" replace />
  if (!perfil) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { perfil, loading: perfilLoading } = usePerfil()

  if (authLoading || perfilLoading) return null
  if (!user) return <Navigate to="/" replace />
  if (perfil) return <Navigate to="/menu" replace />
  return <>{children}</>
}

function IosBanner() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const esStandalone = ('standalone' in navigator) && (navigator as { standalone?: boolean }).standalone
    const yaVisto = localStorage.getItem('ios-install-banner-visto')
    if (esIos && !esStandalone && !yaVisto) setVisible(true)
  }, [])
  if (!visible) return null
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-3 shadow-xl">
      <div className="flex items-start gap-3 max-w-lg mx-auto">
        <span className="text-2xl shrink-0">📲</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Instalar Semana Lista</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Toca <strong>compartir</strong> <span className="inline-block">⎋</span> y luego <strong>"Añadir a pantalla de inicio"</strong>
          </p>
        </div>
        <button
          onClick={() => { setVisible(false); localStorage.setItem('ios-install-banner-visto', '1') }}
          className="text-gray-400 hover:text-gray-600 text-lg shrink-0 leading-none"
        >✕</button>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <>
      <OfflineBanner />
      <IosBanner />
      <Tutorial />
      <Navbar />
      <div style={{ paddingBottom: user ? 'calc(3.5rem + env(safe-area-inset-bottom))' : '0' }}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"           element={<Auth />} />
            <Route path="/onboarding" element={<OnboardingGuard><Onboarding /></OnboardingGuard>} />
            <Route path="/menu"       element={<ProtectedConPerfil><Menu /></ProtectedConPerfil>} />
            <Route path="/lista"      element={<ProtectedConPerfil><Lista /></ProtectedConPerfil>} />
            <Route path="/exportar"   element={<ProtectedConPerfil><Exportar /></ProtectedConPerfil>} />
            <Route path="/ajustes"    element={<Protected><Ajustes /></Protected>} />
            <Route path="/privacidad" element={<Privacidad />} />
            <Route path="/menu/:semanaId" element={<MenuPublico />} />
            <Route path="/lista-compartida/:id" element={<Protected><ListaCompartida /></Protected>} />
          </Routes>
        </Suspense>
      </div>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ListasCompartidasProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ListasCompartidasProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
