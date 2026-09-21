import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppShell } from './components/layout/AppShell'
import AuthPage from './pages/AuthPage'
import AuthCallback from './pages/AuthCallback'
import Onboarding from './pages/Onboarding'
import DiaryPage from './pages/DiaryPage'
import DreamFormPage from './pages/DreamFormPage'
import WhispersPage from './pages/WhispersPage'
import EncountersPage from './pages/EncountersPage'
import ExplorePage from './pages/ExplorePage'
import ProfilePage from './pages/ProfilePage'
import Settings from './pages/Settings'
import Audio from './pages/Audio'
import Friends from './pages/Friends'
import LucidTechniques from './pages/LucidTechniques'
import UserProfile from './pages/UserProfile'

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
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
            <Route path="/encuentros"  element={<EncountersPage />} />
            <Route path="/explorar"    element={<ExplorePage />} />
            <Route path="/perfil"      element={<ProfilePage />} />
            <Route path="/perfil/:id"  element={<UserProfile />} />
            <Route path="/amigos"      element={<Friends />} />
            <Route path="/ajustes"     element={<Settings />} />
            <Route path="/audio"       element={<Audio />} />
            <Route path="/tecnicas"    element={<LucidTechniques />} />
          </Route>

          {/* Dream form — fullscreen, no nav */}
          <Route path="/diario/nuevo"  element={<DreamFormPage />} />
          <Route path="/diario/:id"    element={<DreamFormPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/perfil" replace />} />
          <Route path="/"  element={<Navigate to="/perfil" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
