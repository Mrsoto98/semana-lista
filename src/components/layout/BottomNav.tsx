import { NavLink, useNavigate, useLocation } from 'react-router'
import { motion } from 'framer-motion'
import { useUnreadCounts } from '../../hooks/useUnreadCounts'

const NAV = [
  { to: '/susurros',  icon: MoonIcon,    label: 'Susurros' },
  { to: '/explorar',  icon: CompassIcon, label: 'Explorar' },
  { to: '/mensajes',  icon: ChatIcon,    label: 'Mensajes', badge: 'msg' as const },
  { to: '/perfil',    icon: UserIcon,    label: 'Perfil'   },
]

export function BottomNav() {
  const navigate      = useNavigate()
  const { pathname }  = useLocation()
  const { msgCount }  = useUnreadCounts()

  const isConversation = /^\/mensajes\/(nuevo\/|[0-9a-f-]{36})/.test(pathname)
  if (isConversation) return null

  function handleNavTap(to: string) {
    if (pathname === to) {
      window.dispatchEvent(new CustomEvent('dreamlog:scroll-top'))
    }
  }

  function getBadge(badge?: 'msg' | 'notif') {
    if (badge === 'msg') return msgCount
    return 0
  }

  return (
    <>
      {/* Floating add button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.88, rotate: -10 }}
        onClick={() => navigate('/diario/nuevo')}
        className="float-add-btn fixed z-[60] flex items-center justify-center"
        style={{
          bottom: 'calc(max(88px, env(safe-area-inset-bottom) + 72px))',
          right: 20,
          width: 52,
          height: 52,
          borderRadius: '50%',
          fontSize: 24,
          lineHeight: 1,
          fontWeight: 600,
          color: '#fff',
          background: `linear-gradient(135deg, hsl(var(--accent-h), var(--accent-s), 58%) 0%, hsl(var(--accent-h), var(--accent-s), 42%) 100%)`,
          border: '1px solid rgba(var(--glow), 0.30)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20)',
        }}
        aria-label="Añadir sueño"
        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      >
        +
      </motion.button>

      {/* Floating pill nav */}
      <div
        className="fixed bottom-0 left-0 right-0 flex justify-center z-50"
        style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}
      >
        <nav className="glass-nav-pill flex items-center rounded-[28px] px-2 py-2">
          {NAV.map(({ to, icon: Icon, label, badge }) => {
            const count = getBadge(badge)
            return (
              <NavLink key={to} to={to} onClick={() => handleNavTap(to)}>
                {({ isActive }) => (
                  <motion.div
                    whileTap={{ scale: 0.82 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                    className="relative flex flex-col items-center justify-center cursor-pointer select-none"
                    style={{ width: 66, height: 52 }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-active-bg"
                        className="absolute inset-0 rounded-[18px]"
                        style={{
                          background: `rgba(var(--glow), 0.20)`,
                          border: `1px solid rgba(var(--glow), 0.28)`,
                          boxShadow: `0 2px 16px rgba(var(--glow), 0.22), inset 0 1px 0 rgba(255,255,255,0.12)`,
                        }}
                        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                      />
                    )}
                    <motion.div
                      animate={{ scale: isActive ? 1.12 : 1, y: isActive ? -1 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                      className="relative z-10"
                      style={{
                        color: isActive
                          ? `hsl(var(--accent-h), var(--accent-s), 78%)`
                          : 'rgba(255,255,255,0.40)',
                      }}
                    >
                      <Icon active={isActive} />
                      {count > 0 && (
                        <div
                          className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white leading-none px-1"
                          style={{ background: 'rgba(var(--glow-color), 1)' }}
                        >
                          {count > 9 ? '9+' : count}
                        </div>
                      )}
                    </motion.div>
                    <span
                      className="text-[9px] font-medium relative z-10 leading-none mt-0.5"
                      style={{
                        color: isActive
                          ? `hsl(var(--accent-h), var(--accent-s), 76%)`
                          : 'rgba(255,255,255,0.28)',
                      }}
                    >
                      {label}
                    </span>
                  </motion.div>
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>
    </>
  )
}

function NavIcon({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className="transition-all duration-200"
      style={{
        color: active
          ? `hsl(var(--accent-h), var(--accent-s), 78%)`
          : 'rgba(255,255,255,0.40)',
      }}
    >
      {children}
    </div>
  )
}

function MoonIcon({ active }: { active: boolean }) {
  return (
    <NavIcon active={active}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    </NavIcon>
  )
}

function CompassIcon({ active }: { active: boolean }) {
  return (
    <NavIcon active={active}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polygon fill={active ? 'currentColor' : 'none'} points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
      </svg>
    </NavIcon>
  )
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <NavIcon active={active}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </NavIcon>
  )
}

function BellIcon({ active }: { active: boolean }) {
  return (
    <NavIcon active={active}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    </NavIcon>
  )
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <NavIcon active={active}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4" fill={active ? 'currentColor' : 'none'}/>
      </svg>
    </NavIcon>
  )
}
