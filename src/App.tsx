import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from './components/layout/AppLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import Diary from './pages/Diary'
import FriendsFeed from './pages/FriendsFeed'
import PublicFeed from './pages/PublicFeed'
import Coincidences from './pages/Coincidences'
import Stats from './pages/Stats'
import Friends from './pages/Friends'

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

          {/* Protected */}
          <Route element={<AppLayout />}>
            <Route path="/diary" element={<Diary />} />
            <Route path="/feed/friends" element={<FriendsFeed />} />
            <Route path="/feed/public" element={<PublicFeed />} />
            <Route path="/coincidences" element={<Coincidences />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/friends" element={<Friends />} />
          </Route>

          <Route path="*" element={<Navigate to="/diary" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
