// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Auth from './pages/Auth'
import Onboarding from './pages/Onboarding'
import Menu from './pages/Menu'
import Lista from './pages/Lista'
import Exportar from './pages/Exportar'
import MenuPublico from './pages/MenuPublico'

function DarkToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )
  function toggle() {
    document.documentElement.classList.toggle('dark')
    setDark(d => !d)
  }
  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 z-50 rounded-full bg-gray-200 dark:bg-gray-700 px-3 py-1 text-sm"
      aria-label="Toggle dark mode"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  )
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <>
      <DarkToggle />
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
        <Route path="/menu" element={<Protected><Menu /></Protected>} />
        <Route path="/lista" element={<Protected><Lista /></Protected>} />
        <Route path="/exportar" element={<Protected><Exportar /></Protected>} />
        <Route path="/menu/:semanaId" element={<MenuPublico />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
