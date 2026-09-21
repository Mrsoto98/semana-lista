import { Outlet, Navigate } from 'react-router'
import { CosmicBackground } from '../common/CosmicBackground'
import { BottomNav } from './BottomNav'
import { useAuthStore } from '../../lib/store'

export function AppShell() {
  const user = useAuthStore((s) => s.user)

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
    </div>
  )
}
