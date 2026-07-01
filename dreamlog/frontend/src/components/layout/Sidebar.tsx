import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { authApi } from '../../lib/queries'
import { cn } from '../../lib/utils'

const NAV = [
  { to: '/diary', icon: '📖', label: 'Mi diario' },
  { to: '/feed/friends', icon: '👥', label: 'Amigos' },
  { to: '/feed/public', icon: '🌐', label: 'Público' },
  { to: '/coincidences', icon: '✨', label: 'Coincidencias' },
  { to: '/stats', icon: '📊', label: 'Estadísticas' },
  { to: '/friends', icon: '🤝', label: 'Mis amigos' },
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
    <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col bg-slate-950/80 border-r border-white/5 p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 px-2 py-3 mb-6">
        <span className="text-2xl">🌙</span>
        <span className="text-xl font-bold text-white tracking-tight">DreamLog</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1">
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-dream-700/60 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="border-t border-white/5 pt-4 mt-4">
        <NavLink
          to="/profile"
          className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors mb-2"
        >
          <div className="w-8 h-8 rounded-full bg-dream-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
