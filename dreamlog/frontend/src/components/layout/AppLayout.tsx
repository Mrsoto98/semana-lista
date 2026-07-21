import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'
import { IOSInstallPrompt } from '../ui/IOSInstallPrompt'
import { AndroidInstallPrompt } from '../ui/AndroidInstallPrompt'
import { TutorialOverlay } from '../ui/TutorialOverlay'
import { useRef, useState, useEffect } from 'react'

const NAV_ROUTES = ['/diary', '/feed', '/coincidences', '/audio', '/friends']

export function AppLayout() {
  const { user } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  const [tutorialOpen, setTutorialOpen] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('tutorial-seen')) {
      const t = setTimeout(() => setTutorialOpen(true), 800)
      return () => clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    const handler = () => setTutorialOpen(true)
    window.addEventListener('open-tutorial', handler)
    return () => window.removeEventListener('open-tutorial', handler)
  }, [])

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchStartTime = useRef(0)

  const [animClass, setAnimClass] = useState('')
  const prevRouteIdx = useRef(-1)

  useEffect(() => {
    const currentIdx = NAV_ROUTES.indexOf(location.pathname)
    const prevIdx = prevRouteIdx.current
    if (prevIdx !== -1 && currentIdx !== -1 && prevIdx !== currentIdx) {
      const cls = currentIdx > prevIdx ? 'page-slide-right' : 'page-slide-left'
      setAnimClass(cls)
      const t = setTimeout(() => setAnimClass(''), 350)
      return () => clearTimeout(t)
    }
    prevRouteIdx.current = currentIdx
  }, [location.pathname])

  // Update prevRouteIdx after anim class set
  useEffect(() => {
    const idx = NAV_ROUTES.indexOf(location.pathname)
    if (idx !== -1) prevRouteIdx.current = idx
  }, [location.pathname])

  if (!user) return <Navigate to="/login" replace />
  if (!user.onboarding_done) return <Navigate to="/onboarding" replace />

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchStartTime.current = Date.now()
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    const dt = Date.now() - touchStartTime.current

    // Require horizontal dominance, minimum distance 60px, max 500ms
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6 || dt > 500) return

    const currentIdx = NAV_ROUTES.indexOf(location.pathname)
    if (currentIdx === -1) return

    if (dx < 0 && currentIdx < NAV_ROUTES.length - 1) {
      navigate(NAV_ROUTES[currentIdx + 1])
    } else if (dx > 0 && currentIdx > 0) {
      navigate(NAV_ROUTES[currentIdx - 1])
    }
  }

  return (
    <div className="flex flex-col min-h-screen min-h-dvh relative">
      {/* Ambient background orbs */}
      <div
        className="orb w-[500px] h-[500px] top-[-180px] left-[-120px] opacity-25"
        style={{ background: `radial-gradient(circle, rgba(var(--glow-color),0.45) 0%, transparent 70%)` }}
      />
      <div
        className="orb w-[350px] h-[350px] bottom-[80px] right-[-80px] opacity-15"
        style={{ background: `radial-gradient(circle, rgba(var(--glow-color),0.35) 0%, transparent 70%)` }}
      />
      <div
        className="orb w-[250px] h-[250px] top-[40%] left-[30%] opacity-10"
        style={{ background: `radial-gradient(circle, rgba(var(--glow-color),0.3) 0%, transparent 70%)` }}
      />

      {/* Top header */}
      <TopBar onOpenTutorial={() => setTutorialOpen(true)} />

      {/* Page content */}
      <main
        className="flex-1 overflow-y-auto relative z-10"
        style={{ paddingBottom: '80px' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div key={location.pathname} className={`max-w-lg mx-auto px-4 py-5 ${animClass}`}>
          <Outlet />
        </div>
      </main>

      {/* Bottom navigation */}
      <BottomNav />

      {/* Tutorial */}
      <TutorialOverlay open={tutorialOpen} onClose={() => setTutorialOpen(false)} />

      {/* iOS "Add to Home Screen" prompt */}
      <IOSInstallPrompt />

      {/* Android native install prompt */}
      <AndroidInstallPrompt />
    </div>
  )
}
