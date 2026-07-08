import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from './components/layout/AppLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import AuthCallback from './pages/AuthCallback'
import Onboarding from './pages/Onboarding'
import Diary from './pages/Diary'
import Feed from './pages/Feed'
import Coincidences from './pages/Coincidences'
import Stats from './pages/Stats'
import Audio from './pages/Audio'
import Friends from './pages/Friends'
import Settings from './pages/Settings'
import UserProfile from './pages/UserProfile'
import LucidTechniques from './pages/LucidTechniques'

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
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Protected */}
          <Route element={<AppLayout />}>
            <Route path="/diary" element={<Diary />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/coincidences" element={<Coincidences />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/audio" element={<Audio />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile/:id" element={<UserProfile />} />
            <Route path="/techniques" element={<LucidTechniques />} />
          </Route>

          <Route path="*" element={<Navigate to="/diary" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
