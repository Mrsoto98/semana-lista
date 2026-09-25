export interface Theme {
  id: string
  name: string
  emoji: string
  vars: Record<string, string>
}

export const THEMES: Theme[] = [
  {
    id: 'cosmos',
    name: 'Cosmos',
    emoji: '🔮',
    vars: {
      '--accent-h': '258',
      '--accent-s': '90%',
      '--accent-l': '66%',
      '--glow-color': '139, 92, 246',
      '--glass-tint': '88, 28, 235',
      '--bg-deep': '10, 8, 24',
      '--bg-mid': '18, 14, 40',
    },
  },
  {
    id: 'abismo',
    name: 'Abismo',
    emoji: '🌊',
    vars: {
      '--accent-h': '215',
      '--accent-s': '85%',
      '--accent-l': '60%',
      '--glow-color': '59, 130, 246',
      '--glass-tint': '29, 78, 216',
      '--bg-deep': '6, 10, 24',
      '--bg-mid': '10, 18, 42',
    },
  },
  {
    id: 'selva',
    name: 'Selva',
    emoji: '🌿',
    vars: {
      '--accent-h': '158',
      '--accent-s': '72%',
      '--accent-l': '48%',
      '--glow-color': '16, 185, 129',
      '--glass-tint': '4, 120, 87',
      '--bg-deep': '4, 14, 12',
      '--bg-mid': '6, 22, 18',
    },
  },
  {
    id: 'petalo',
    name: 'Pétalo',
    emoji: '🌸',
    vars: {
      '--accent-h': '330',
      '--accent-s': '80%',
      '--accent-l': '62%',
      '--glow-color': '236, 72, 153',
      '--glass-tint': '190, 24, 93',
      '--bg-deep': '18, 6, 14',
      '--bg-mid': '30, 10, 24',
    },
  },
]

export const DEFAULT_THEME = 'cosmos'

export function applyTheme(themeId: string) {
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]
  const root = document.documentElement
  for (const [key, val] of Object.entries(theme.vars)) {
    root.style.setProperty(key, val)
  }
  root.setAttribute('data-theme', themeId)
}
