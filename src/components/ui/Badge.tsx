import type { Dificultad } from '../../types'

const STYLES: Record<Dificultad, string> = {
  'fácil':   'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'media':   'bg-amber-50  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
  'difícil': 'bg-red-50    text-red-700    dark:bg-red-900/40    dark:text-red-300',
}

export function Badge({ dificultad }: { dificultad: Dificultad }) {
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide ${STYLES[dificultad]}`}>
      {dificultad}
    </span>
  )
}
