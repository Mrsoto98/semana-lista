// src/App.tsx
import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { I18nProvider, useI18n } from './hooks/useI18n'
import { usePerfil } from './hooks/usePerfil'
import { useListasCompartidas, ListasCompartidasProvider, type ListaCompartida } from './hooks/useListaCompartida'
import { guardar, recuperar } from './lib/storage'
import { setInstallPrompt, getInstallPrompt, clearInstallPrompt } from './lib/installPrompt'
import { ErrorBoundary } from './components/ErrorBoundary'
import { OfflineBanner } from './components/OfflineBanner'
import { Tutorial } from './components/Tutorial'
import { supabase } from './lib/supabase'
import { esNativo } from './lib/ads'



const Landing      = lazy(() => import('./pages/Landing'))
const Auth         = lazy(() => import('./pages/Auth'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
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
              className="w-full flex items-center justify-between bg-accent-light border border-green-select/30 rounded-2xl px-4 py-3.5 mb-6">
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

  const hidden = ['/', '/login', '/onboarding', '/privacidad'].includes(location.pathname) || location.pathname.startsWith('/menu/')
  if (!user || hidden) return null

  const listaActivaId = recuperar<string>('lista_compartida_principal')

  function handleCompartidaClick() {
    if (listas.length === 0) { setModalCrear(true); return }
    const principalId = recuperar<string>('lista_compartida_principal') ?? listas[0]?.id
    if (principalId) navigate(`/lista-compartida/${principalId}`)
  }

  const isCompartidaActive = location.pathname.startsWith('/lista-compartida')

  const ACCENT = 'rgb(var(--accent))'

  const TAB_ICONS: Record<string, (active: boolean) => React.ReactNode> = {
    exportar: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" style={{ fill: active ? ACCENT : 'currentColor' }}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.558 4.13 1.532 5.862L.057 23.571a.5.5 0 00.611.61l5.794-1.463A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.892 0-3.665-.497-5.197-1.367l-.372-.215-3.862.976.998-3.77-.235-.387A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
      </svg>
    ),
    ajustes: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: active ? ACCENT : 'currentColor' }}>
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
    lista: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: active ? ACCENT : 'currentColor' }}>
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 01-8 0"/>
      </svg>
    ),
    compartida: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: active ? ACCENT : 'currentColor' }}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/>
        <path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    menu: (active) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: active ? ACCENT : 'currentColor' }}>
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

  const { t } = useI18n()
  const tabs = [
    { key: 'ajustes',    path: '/ajustes',  label: t.nav_ajustes },
    { key: 'exportar',   path: '/exportar', label: t.nav_exportar },
    { key: 'menu',       path: '/menu',     label: t.nav_menu },
    { key: 'lista',      path: '/lista',    label: t.nav_lista },
    { key: 'compartida', path: '',          label: t.nav_compartida },
  ] as const

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center max-w-lg mx-auto pointer-events-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)', paddingTop: '0' }}
      >
        <div className="flex gap-2 pointer-events-auto px-3 py-2 rounded-2xl glass shadow-glass mx-3 mb-1">
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
                <span className={`relative inline-block ${active ? 'tab-active-icon text-green-select' : 'text-gray-400 dark:text-gray-500'}`}>
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

      {/* Modal selector de listas compartidas — ahora solo se usa si no hay lista principal */}
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
                        {esPrincipal && <span className="text-xs text-green-select font-bold bg-accent-light px-2 py-0.5 rounded-full">Principal</span>}
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


function PageSkeleton() {
  return (
    <div className="skeleton-page px-4 pt-6 space-y-4 max-w-lg mx-auto">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-2xl skeleton-pulse" />
      <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-3xl skeleton-pulse" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-3xl skeleton-pulse" style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
      <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-3xl skeleton-pulse" style={{ animationDelay: '0.3s' }} />
    </div>
  )
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageSkeleton />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function ProtectedConPerfil({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { perfil, loading: perfilLoading } = usePerfil()

  if (authLoading || perfilLoading) return <PageSkeleton />
  if (!user) return <Navigate to="/login" replace />
  if (!perfil) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { perfil, loading: perfilLoading } = usePerfil()

  if (authLoading || perfilLoading) return <PageSkeleton />
  if (!user) return <Navigate to="/login" replace />
  if (perfil) return <Navigate to="/menu" replace />
  return <>{children}</>
}


function AndroidInstallBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const esStandalone = window.matchMedia('(display-mode: standalone)').matches
    if (esStandalone) return

    // Solo ocultar permanentemente si ya está instalada, no si solo cerró el banner
    const yaInstalada = localStorage.getItem('pwa-instalada')
    if (yaInstalada) return

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      // Solo mostrar banner si no lo cerró en esta sesión
      const cerradoEnSesion = sessionStorage.getItem('install-banner-cerrado')
      if (!cerradoEnSesion) {
        setTimeout(() => setVisible(true), 3000)
      }
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Detectar instalación exitosa
    const instaladoHandler = () => {
      localStorage.setItem('pwa-instalada', '1')
      clearInstallPrompt()
      setVisible(false)
    }
    window.addEventListener('appinstalled', instaladoHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', instaladoHandler)
    }
  }, [])

  async function instalar() {
    const p = getInstallPrompt()
    if (!p) return
    await p.prompt()
    setVisible(false)
  }

  function cerrar() {
    setVisible(false)
    // Solo bloquear en esta sesión, no permanentemente
    sessionStorage.setItem('install-banner-cerrado', '1')
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-24 left-0 right-0 z-[90] flex justify-center px-4 pointer-events-none">
      <div
        className="w-full max-w-sm pointer-events-auto fade-slide-up"
        style={{
          background: 'rgba(15,25,45,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(52,211,153,0.35)',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(52,211,153,0.15)',
        }}
      >
        <div className="flex items-center gap-3 p-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl"
            style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>
            🥗
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight">Instala Semana Lista</p>
            <p className="text-gray-400 text-xs mt-0.5">Añádela a tu pantalla de inicio</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={instalar}
              className="bg-green-500 text-white text-xs font-black px-3 py-2 rounded-xl shadow-lg shadow-green-500/30 active:scale-95 transition-all"
            >
              Instalar
            </button>
            <button
              onClick={cerrar}
              className="text-gray-500 hover:text-gray-300 text-lg leading-none w-7 h-7 flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function IosTutorial() {
  const [visible, setVisible] = useState(false)
  const [paso, setPaso] = useState(0)

  useEffect(() => {
    const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const esStandalone = ('standalone' in navigator) && (navigator as { standalone?: boolean }).standalone
    const yaVisto = localStorage.getItem('ios-install-visto')
    // Mostrar 3s después de cargar para no interrumpir
    if (esIos && !esStandalone && !yaVisto) {
      const t = setTimeout(() => setVisible(true), 3000)
      return () => clearTimeout(t)
    }
  }, [])

  function cerrar() {
    setVisible(false)
    localStorage.setItem('ios-install-visto', '1')
  }

  const pasos = [
    {
      icon: (
        <svg viewBox="0 0 24 24" className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
      ),
      title: 'Toca el botón compartir',
      desc: 'Pulsa el icono de compartir en la barra inferior de Safari',
      hint: '⬆️ El cuadrado con la flecha hacia arriba',
    },
    {
      icon: <span className="text-5xl">➕</span>,
      title: 'Añadir a pantalla de inicio',
      desc: 'Desplázate hacia abajo en el menú y toca "Añadir a pantalla de inicio"',
      hint: '📱 Aparece con un icono de + en un cuadrado',
    },
    {
      icon: <span className="text-5xl">🥗</span>,
      title: '¡Ya está instalada!',
      desc: 'Semana Lista aparecerá en tu pantalla de inicio como una app nativa',
      hint: '✅ Sin navegador, sin barra de URL',
    },
  ]

  if (!visible) return null

  const p = pasos[paso]

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={cerrar}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl pb-10 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-4 mb-5" />

        {/* Cerrar */}
        <button onClick={cerrar} className="absolute top-4 right-4 text-gray-400 text-xl leading-none">✕</button>

        {/* Encabezado */}
        <div className="px-6 mb-6">
          <p className="text-xs font-bold text-green-500 uppercase tracking-widest mb-1">Instala la app</p>
          <h2 className="text-xl font-black text-gray-900 dark:text-gray-100">Añádela a tu pantalla de inicio</h2>
          <p className="text-xs text-gray-400 mt-1">Paso {paso + 1} de {pasos.length}</p>
        </div>

        {/* Paso actual */}
        <div className="mx-5 bg-gray-50 dark:bg-gray-800 rounded-3xl p-6 flex flex-col items-center text-center gap-3 mb-5">
          <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-white dark:bg-gray-700 shadow-md">
            {p.icon}
          </div>
          <p className="text-lg font-black text-gray-900 dark:text-gray-100">{p.title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{p.desc}</p>
          <p className="text-xs text-gray-400 bg-white dark:bg-gray-700 px-3 py-1.5 rounded-full">{p.hint}</p>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mb-5">
          {pasos.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === paso ? 'w-6 bg-green-500' : 'w-1.5 bg-gray-300 dark:bg-gray-700'}`} />
          ))}
        </div>

        {/* Botones */}
        <div className="px-5 flex gap-3">
          {paso > 0 && (
            <button onClick={() => setPaso(p => p - 1)}
              className="flex-1 py-3 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-500">
              Anterior
            </button>
          )}
          {paso < pasos.length - 1 ? (
            <button onClick={() => setPaso(p => p + 1)}
              className="flex-1 bg-green-500 text-white py-3 rounded-2xl font-black text-sm shadow-lg shadow-green-500/30">
              Siguiente →
            </button>
          ) : (
            <button onClick={cerrar}
              className="flex-1 bg-green-500 text-white py-3 rounded-2xl font-black text-sm shadow-lg shadow-green-500/30">
              ¡Entendido!
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const { listas } = useListasCompartidas()

  useEffect(() => {
    if (!esNativo()) return

    async function handleOAuthUrl(url: string) {
      if (!url.startsWith('com.semanalista.app://auth/')) return
      try {
        const parsed = new URL(url.replace('com.semanalista.app://', 'https://localhost/'))
        const hash = new URLSearchParams(parsed.hash.slice(1))
        const access_token = hash.get('access_token') ?? parsed.searchParams.get('access_token')
        const refresh_token = hash.get('refresh_token') ?? parsed.searchParams.get('refresh_token')
        const code = parsed.searchParams.get('code')

        let userId: string | null = null
        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (error) throw error
          userId = data.user?.id ?? null
        } else if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          userId = data.user?.id ?? null
        }

        if (!userId) throw new Error('Sin usuario tras OAuth')
        const { data: perfil } = await supabase.from('perfiles').select('id').eq('usuario_id', userId).maybeSingle()
        window.location.href = perfil ? '/menu' : '/onboarding'
      } catch (err) {
        console.error('OAuth callback error:', err)
        window.location.href = '/login?oauth_error=1'
      }
    }

    let removeListener: (() => void) | undefined
    // @ts-ignore
    import('@capacitor/app').then(({ App }: { App: any }) => {
      // Caso 1: app ya estaba en memoria, Android llama onNewIntent
      App.addListener('appUrlOpen', ({ url }: { url: string }) => handleOAuthUrl(url))
        .then((h: any) => { removeListener = () => h.remove() })

      // Caso 2: Android mató la app y la relanzó via deep link (onCreate)
      App.getLaunchUrl()
        .then(({ url }: { url: string }) => { if (url) handleOAuthUrl(url) })
        .catch(() => {})
    }).catch(() => {})

    return () => { removeListener?.() }
  }, [])

  const NAV_PATHS = ['/ajustes', '/exportar', '/menu', '/lista', '/lista-compartida']

  function navigateTo(path: string) {
    if (path === '/lista-compartida') {
      const principalId = recuperar<string>('lista_compartida_principal') ?? listas[0]?.id
      if (principalId) navigate(`/lista-compartida/${principalId}`)
    } else {
      navigate(path)
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!swipeStart.current) return
    const dx = e.changedTouches[0].clientX - swipeStart.current.x
    const dy = e.changedTouches[0].clientY - swipeStart.current.y
    swipeStart.current = null
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return
    const idx = NAV_PATHS.findIndex(p => location.pathname.startsWith(p))
    if (idx === -1) return
    if (dx < 0 && idx < NAV_PATHS.length - 1) navigateTo(NAV_PATHS[idx + 1])
    else if (dx > 0 && idx > 0) navigateTo(NAV_PATHS[idx - 1])
  }

  return (
    <>
      <OfflineBanner />
      <AndroidInstallBanner />
      <IosTutorial />
      <Tutorial />
      <Navbar />
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ paddingBottom: user ? 'calc(3.5rem + env(safe-area-inset-bottom))' : '0' }}
      >
        <Suspense fallback={<PageLoader />}>
          <div key={location.pathname} className="page-enter">
          <Routes>
            <Route path="/"           element={user ? <Navigate to="/menu" replace /> : <Landing />} />
            <Route path="/login"      element={user ? <Navigate to="/menu" replace /> : <Auth />} />
            <Route path="/onboarding" element={<OnboardingGuard><Onboarding /></OnboardingGuard>} />
            <Route path="/menu"       element={<ProtectedConPerfil><Menu /></ProtectedConPerfil>} />
            <Route path="/lista"      element={<ProtectedConPerfil><Lista /></ProtectedConPerfil>} />
            <Route path="/exportar"   element={<ProtectedConPerfil><Exportar /></ProtectedConPerfil>} />
            <Route path="/ajustes"    element={<Protected><Ajustes /></Protected>} />
            <Route path="/privacidad" element={<Privacidad />} />
            <Route path="/menu/:semanaId" element={<MenuPublico />} />
            <Route path="/lista-compartida/:id" element={<Protected><ListaCompartida /></Protected>} />
            <Route path="/auth/callback" element={<AuthCallback />} />
          </Routes>
          </div>
        </Suspense>
      </div>
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <AuthProvider>
          <ListasCompartidasProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </ListasCompartidasProvider>
        </AuthProvider>
      </I18nProvider>
    </ErrorBoundary>
  )
}
