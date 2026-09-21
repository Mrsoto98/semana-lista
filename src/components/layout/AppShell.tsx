import { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router'
import { CosmicBackground } from '../common/CosmicBackground'
import { BottomNav } from './BottomNav'
import { TutorialOverlay } from '../ui/TutorialOverlay'
import { useAuthStore } from '../../lib/store'

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const [tutorialOpen, setTutorialOpen] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('tutorial-seen')) {
      const t = setTimeout(() => setTutorialOpen(true), 900)
      return () => clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    const handler = () => setTutorialOpen(true)
    window.addEventListener('open-tutorial', handler)
    return () => window.removeEventListener('open-tutorial', handler)
  }, [])

  if (!user) return <Navigate to="/entrada" replace />
  if (!user.onboarding_done) return <Navigate to="/bienvenida" replace />

  return (
    <div className="relative min-h-svh" style={{ background: 'rgb(var(--bg-deep))' }}>
      <CosmicBackground />

      {/* Page content */}
      <main className="relative" style={{ zIndex: 1 }}>
        <Outlet />
      </main>

      <BottomNav />

      <TutorialOverlay open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </div>
  )
}
