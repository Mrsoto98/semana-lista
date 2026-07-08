import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { authApi } from '../../lib/queries'
import { ThemePicker } from '../ui/ThemePicker'
import { cn } from '../../lib/utils'

const NAV = [
  { to: '/diary',           icon: '📖', label: 'Mi diario' },
  { to: '/feed/friends',    icon: '👥', label: 'Amigos' },
  { to: '/feed/public',     icon: '🌐', label: 'Público' },
  { to: '/coincidences',    icon: '✨', label: 'Coincidencias' },
  { to: '/stats',           icon: '📊', label: 'Estadísticas' },
  { to: '/friends',         icon: '🤝', label: 'Mis amigos' },
  { to: '/techniques',      icon: '🔮', label: 'Técnicas lúcidas' },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    await authApi.logout().catch(() => {})
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col glass-sidebar p-4 gap-2">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 py-3 mb-2">
        <span className="text-2xl animate-float">🌙</span>
        <div>
          <p className="text-sm font-bold text-white leading-tight">Bitácora del Sueño</p>
          <p className="text-[10px] text-white/30 leading-tight">diario onírico</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5">
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'glass-nav-active text-white'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/5'
              )
            }
          >
            <span className="text-base w-5 text-center">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Theme picker */}
      <div className="border-t border-white/6 pt-4 pb-2">
        <ThemePicker />
      </div>

      {/* User */}
      <div className="border-t border-white/6 pt-3">
        <NavLink
          to="/profile"
          className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors mb-1"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, rgba(var(--glow-color),0.8), rgba(var(--glass-tint),0.9))' }}
          >
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/80 truncate">{user?.name}</p>
            <p className="text-[10px] text-white/30 truncate">{user?.email}</p>
          </div>
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-1.5 text-xs text-white/25 hover:text-red-400/80 transition-colors rounded-lg hover:bg-white/5"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
