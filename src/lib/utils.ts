export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export function formatDateShort(date: string) {
  return new Date(date).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function scoreToPercent(score: number) {
  return Math.round(score * 100)
}

export const VISIBILITY_LABELS = {
  private: { label: 'Privado', icon: '🔒', color: 'text-slate-400' },
  friends: { label: 'Amigos', icon: '👥', color: 'text-blue-400' },
  public: { label: 'Público', icon: '🌐', color: 'text-green-400' },
} as const

export const EMOTION_COLORS: Record<string, string> = {
  alegría: 'bg-yellow-500/20 text-yellow-300',
  miedo: 'bg-red-500/20 text-red-300',
  tristeza: 'bg-blue-500/20 text-blue-300',
  confusión: 'bg-purple-500/20 text-purple-300',
  calma: 'bg-teal-500/20 text-teal-300',
  euforia: 'bg-orange-500/20 text-orange-300',
  angustia: 'bg-pink-500/20 text-pink-300',
  default: 'bg-white/10 text-slate-300',
}

export function emotionColor(emotion: string) {
  return EMOTION_COLORS[emotion.toLowerCase()] ?? EMOTION_COLORS.default
}
