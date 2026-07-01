// src/App.tsx
import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { usePerfil } from './hooks/usePerfil'
import { useListasCompartidas } from './hooks/useListaCompartida'
import { guardar, recuperar } from './lib/storage'
import { ErrorBoundary } from './components/ErrorBoundary'
import { OfflineBanner } from './components/OfflineBanner'

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

function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { listas } = useListasCompartidas()
  const [modalListas, setModalListas] = useState(false)

  const hidden = ['/', '/onboarding', '/privacidad'].includes(location.pathname) || location.pathname.startsWith('/menu/')
  if (!user || hidden) return null

  const listaActivaId = recuperar<string>('lista_compartida_principal')

  function handleCompartidaClick() {
    if (listas.length === 0) { navigate('/lista'); return }
    if (listas.length === 1) { navigate(`/lista-compartida/${listas[0].id}`); return }
    setModalListas(true)
  }

  const isCompartidaActive = location.pathname.startsWith('/lista-compartida')

  const tabs = [
    { key: 'exportar', path: '/exportar', emoji: '📤', label: 'Exportar' },
    { key: 'ajustes',  path: '/ajustes',  emoji: '⚙️', label: 'Ajustes' },
    { key: 'lista',    path: '/lista',    emoji: '🛒', label: 'Lista' },
    { key: 'compartida', path: '', emoji: '👥', label: 'Compartida' },
    { key: 'menu',     path: '/menu',     emoji: '📅', label: 'Menú' },
  ] as const

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center max-w-lg mx-auto pointer-events-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)', paddingTop: '0' }}
      >
        <div className="flex gap-2 pointer-events-auto px-3">
          {tabs.map(({ key, path, emoji, label }) => {
            const active = key === 'compartida' ? isCompartidaActive : location.pathname === path
            return (
              <button
                key={key}
                onClick={() => key === 'compartida' ? handleCompartidaClick() : navigate(path)}
                className={`flex flex-col items-center gap-1.5 w-[64px] py-3 rounded-2xl border transition-all duration-200 ${
                  active
                    ? 'bg-white/85 dark:bg-gray-800/85 border-white/80 dark:border-gray-600/60 shadow-xl shadow-black/15 scale-105'
                    : 'bg-white/50 dark:bg-gray-900/50 border-white/40 dark:border-gray-700/40 shadow-md shadow-black/8'
                }`}
                style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
              >
                <span className={`text-2xl leading-none transition-transform duration-200 ${active ? 'scale-110' : ''}`}>{emoji}</span>
                <span className={`text-[10px] font-semibold tracking-wide ${active ? 'text-green-select' : 'text-gray-400 dark:text-gray-500'}`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Modal selector de lista compartida principal */}
      {modalListas && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => setModalListas(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-5" />
            <h2 className="text-lg font-black text-gray-800 dark:text-gray-100 mb-1">Listas compartidas</h2>
            <p className="text-xs text-gray-400 mb-4">Toca una para ir a ella. Mantén para hacerla principal.</p>
            <div className="space-y-2">
              {listas.map(lista => {
                const esPrincipal = lista.id === listaActivaId || (!listaActivaId && lista.id === listas[0]?.id)
                return (
                  <button key={lista.id}
                    onClick={() => { setModalListas(false); navigate(`/lista-compartida/${lista.id}`) }}
                    onContextMenu={e => { e.preventDefault(); guardar('lista_compartida_principal', lista.id); setModalListas(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-colors border-gray-200 dark:border-gray-700 hover:border-green-select/60 bg-white dark:bg-gray-800">
                    <span className="text-2xl">👥</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{lista.nombre}</p>
                      <p className="text-xs text-gray-400">{lista.codigo}</p>
                    </div>
                    {esPrincipal && <span className="text-xs text-green-select font-bold bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Principal</span>}
                  </button>
                )
              })}
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

function AppRoutes() {
  const { user } = useAuth()

  return (
    <>
      <OfflineBanner />
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
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
