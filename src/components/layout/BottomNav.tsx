import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/utils'

const NAV = [
  { to: '/diary',        icon: BookIcon,  label: 'Diario' },
  { to: '/feed',         icon: FeedIcon,  label: 'Feed' },
  { to: '/coincidences', icon: SparkIcon, label: 'Coincide' },
  { to: '/audio',        icon: MicIcon,   label: 'Monitor' },
  { to: '/friends',      icon: UsersIcon, label: 'Amigos' },
]

export function BottomNav() {
  return (
    <nav className="glass-nav fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 pb-safe"
         style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 min-w-[56px]',
              isActive
                ? 'glass-nav-active'
                : 'text-white/35 hover:text-white/60'
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon active={isActive} />
              <span className={cn(
                'text-[10px] font-medium leading-none transition-colors',
                isActive ? 'accent-text' : 'text-white/35'
              )}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function BookIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"
      className={active ? 'accent-text' : 'text-white/35'}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  )
}

function FeedIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"
      className={active ? 'accent-text' : 'text-white/35'}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function SparkIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round"
      className={active ? 'accent-text' : 'text-white/35'}>
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
  )
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"
      className={active ? 'accent-text' : 'text-white/35'}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  )
}

function CrystalIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"
      className={active ? 'accent-text' : 'text-white/35'}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"
      className={active ? 'accent-text' : 'text-white/35'}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
