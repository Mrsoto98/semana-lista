import { NavLink, useNavigate } from 'react-router'
import { motion } from 'framer-motion'

const NAV = [
  { to: '/susurros',   icon: MoonIcon,   label: 'Susurros'   },
  { to: '/explorar',   icon: CompassIcon,label: 'Explorar'   },
  { to: '/encuentros', icon: SparkIcon,  label: 'Encuentros' },
  { to: '/perfil',     icon: UserIcon,   label: 'Perfil'     },
]

export function BottomNav() {
  const navigate = useNavigate()

  return (
    <>
      {/* Floating add button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        onClick={() => navigate('/diario/nuevo')}
        className="glass-btn-primary fixed z-[60] flex items-center justify-center"
        style={{
          bottom: 'calc(max(72px, env(safe-area-inset-bottom) + 60px) + 20px)',
          right: 20,
          width: 52,
          height: 52,
          borderRadius: '50%',
          fontSize: 24,
          lineHeight: 1,
        }}
        aria-label="Añadir sueño"
      >
        +
      </motion.button>

      {/* Nav bar */}
      <nav
        className="glass-nav fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-1"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))', paddingTop: 10 }}
      >
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-[3px] px-3 py-1.5 rounded-2xl transition-all duration-200 min-w-[52px] relative ${
                isActive ? 'glass-nav-active' : ''
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon active={isActive} />
                <span
                  className="text-[9px] font-medium leading-none transition-colors"
                  style={{
                    color: isActive
                      ? `hsl(var(--accent-h), var(--accent-s), 76%)`
                      : 'rgba(255,255,255,0.35)',
                  }}
                >
                  {label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-dot"
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: `hsl(var(--accent-h), var(--accent-s), 70%)` }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

function NavIcon({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className="transition-all duration-200"
      style={{
        color: active
          ? `hsl(var(--accent-h), var(--accent-s), 76%)`
          : 'rgba(255,255,255,0.38)',
        transform: active ? 'scale(1.08)' : 'scale(1)',
      }}
    >
      {children}
    </div>
  )
}

function BookIcon({ active }: { active: boolean }) {
  return (
    <NavIcon active={active}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    </NavIcon>
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

function SparkIcon({ active }: { active: boolean }) {
  return (
    <NavIcon active={active}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
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
