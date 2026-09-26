import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from './components/layout/AppShell'
import { initReminder } from './hooks/usePushNotifications'

// Eager: auth flow needs to resolve immediately
import AuthPage from './pages/AuthPage'
import AuthCallback from './pages/AuthCallback'
import Onboarding from './pages/Onboarding'

// Lazy: every app page loads only when navigated to
const DiaryPage        = lazy(() => import('./pages/DiaryPage'))
const DreamFormPage    = lazy(() => import('./pages/DreamFormPage'))
const DreamDetailPage  = lazy(() => import('./pages/DreamDetailPage'))
const WhispersPage     = lazy(() => import('./pages/WhispersPage'))
const ExplorePage      = lazy(() => import('./pages/ExplorePage'))
const ProfilePage      = lazy(() => import('./pages/ProfilePage'))
const Settings         = lazy(() => import('./pages/Settings'))
const AppSettings      = lazy(() => import('./pages/AppSettings'))
const Audio            = lazy(() => import('./pages/Audio'))
const Friends          = lazy(() => import('./pages/Friends'))
const LucidTechniques  = lazy(() => import('./pages/LucidTechniques'))
const UserProfile      = lazy(() => import('./pages/UserProfile'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const MessagesPage     = lazy(() => import('./pages/MessagesPage'))
const ConversationPage = lazy(() => import('./pages/ConversationPage'))

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center h-svh">
      <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/60 animate-spin" />
    </div>
  )
}

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

function AppInit() {
  useEffect(() => { initReminder() }, [])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AppInit />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/entrada"       element={<AuthPage mode="login" />} />
            <Route path="/registro"      element={<AuthPage mode="register" />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Onboarding — auth required, no shell */}
            <Route path="/bienvenida" element={<Onboarding />} />

            {/* Protected — with bottom nav shell */}
            <Route element={<AppShell />}>
              <Route path="/diario"      element={<DiaryPage />} />
              <Route path="/susurros"    element={<WhispersPage />} />
              <Route path="/explorar"    element={<ExplorePage />} />
              <Route path="/perfil"              element={<ProfilePage />} />
              <Route path="/perfil/:id"          element={<UserProfile />} />
              <Route path="/amigos"              element={<Friends />} />
              <Route path="/ajustes"             element={<Settings />} />
              <Route path="/configuracion"       element={<AppSettings />} />
              <Route path="/audio"               element={<Audio />} />
              <Route path="/tecnicas"            element={<LucidTechniques />} />
              <Route path="/notificaciones"      element={<NotificationsPage />} />
              <Route path="/mensajes"                    element={<MessagesPage />} />
              <Route path="/mensajes/nuevo/:userId"      element={<ConversationPage />} />
              <Route path="/mensajes/:id"                element={<ConversationPage />} />
            </Route>

            {/* Dream form — fullscreen, no nav */}
            <Route path="/diario/nuevo"  element={<DreamFormPage />} />
            <Route path="/diario/:id"    element={<DreamFormPage />} />
            <Route path="/sueno/:id"     element={<DreamDetailPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/perfil" replace />} />
            <Route path="/"  element={<Navigate to="/perfil" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
