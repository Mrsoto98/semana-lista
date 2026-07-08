import { THEMES } from '../../lib/themes'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'

// Preview swatch colors per theme (accent light)
const SWATCH: Record<string, string> = {
  cosmos:  'from-violet-500 to-purple-700',
  abismo:  'from-blue-400 to-blue-700',
  selva:   'from-emerald-400 to-emerald-700',
  petalo:  'from-pink-400 to-rose-600',
}

export function ThemePicker() {
  const { themeId, setTheme } = useAuthStore()

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-white/40 uppercase tracking-wider font-medium">Tema</p>
      <div className="grid grid-cols-4 gap-2">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setTheme(theme.id)}
            title={theme.name}
            className={cn(
              'group flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all',
              themeId === theme.id
                ? 'bg-white/12 ring-1 ring-white/30'
                : 'hover:bg-white/6'
            )}
          >
            {/* Swatch circle */}
            <div
              className={cn(
                'w-7 h-7 rounded-full bg-gradient-to-br shadow-lg transition-transform group-hover:scale-110',
                SWATCH[theme.id]
              )}
              style={{
                boxShadow: themeId === theme.id
                  ? `0 0 12px 2px rgba(var(--glow-color), 0.5)`
                  : undefined,
              }}
            />
            <span className="text-[10px] text-white/50 group-hover:text-white/80 transition-colors leading-none">
              {theme.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
