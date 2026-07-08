import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'

const PAGE_TITLES: Record<string, string> = {
  '/diary':          'Mi perfil',
  '/feed':           'Feed',
  '/coincidences':   'Coincidencias',
  '/stats':          'Estadísticas',
  '/audio':          'Monitor de sueño',
  '/friends':        'Amigos',
  '/settings':       'Ajustes',
}

interface Props {
  onOpenTutorial: () => void
}

export function TopBar({ onOpenTutorial }: Props) {
  const { user } = useAuthStore()
  const navigate  = useNavigate()
  const { pathname } = useLocation()

  const title = PAGE_TITLES[pathname] ?? 'Bitácora del Sueño'

  return (
    <header className="glass-header sticky top-0 z-40 flex items-center justify-between px-4 h-14">
      {/* Logo + title */}
      <div className="flex items-center gap-2.5">
        <span className="text-xl leading-none select-none">🌙</span>
        <span className="text-sm font-semibold text-white/90">{title}</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Tutorial button */}
        <button
          onClick={onOpenTutorial}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/70 transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
          aria-label="Ver tutorial"
        >
          <span className="text-xs font-bold leading-none">?</span>
        </button>

        {/* Avatar → settings */}
        <button
          onClick={() => navigate('/settings')}
          className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/15 hover:ring-white/30 transition-all active:scale-95 shrink-0"
          style={!user?.avatar_url ? { background: 'linear-gradient(135deg, rgba(var(--glow-color),0.9), rgba(var(--glass-tint),0.9))' } : undefined}
        >
          {user?.avatar_url
            ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
            : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-white">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </span>
          }
        </button>
      </div>
    </header>
  )
}
