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
        whileTap={{ scale: 0.88, rotate: -10 }}
        onClick={() => navigate('/diario/nuevo')}
        className="glass-btn-primary fixed z-[60] flex items-center justify-center"
        style={{
          bottom: 'calc(max(88px, env(safe-area-inset-bottom) + 72px))',
          right: 20,
          width: 52,
          height: 52,
          borderRadius: '50%',
          fontSize: 24,
          lineHeight: 1,
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
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}>
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
          ))}
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
