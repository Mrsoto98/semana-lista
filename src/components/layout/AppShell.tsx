import { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router'
import { CosmicBackground } from '../common/CosmicBackground'
import { BottomNav } from './BottomNav'
import { TutorialOverlay } from '../ui/TutorialOverlay'
import { useAuthStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const setAuth = useAuthStore((s) => s.setAuth)
  const setTheme = useAuthStore((s) => s.setTheme)
  const [tutorialOpen, setTutorialOpen] = useState(false)

  // Keep Zustand in sync with Supabase session — handles token refresh and expiry
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        logout()
      } else if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        const storedUser = useAuthStore.getState().user
        if (storedUser) {
          setAuth(storedUser, session.access_token, session.refresh_token ?? '')
          // Fetch latest profile to sync edits from other devices
          supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => {
            if (data) {
              const current = useAuthStore.getState().user
              if (current) {
                setAuth({ ...current, ...data }, session.access_token, session.refresh_token ?? '')
                if (data.theme_id) setTheme(data.theme_id)
              }
            }
          })
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [logout, setAuth])

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
