// src/components/ui/Badge.tsx
import type { Dificultad } from '../../types'

const DIFICULTAD_STYLES: Record<Dificultad, string> = {
  'fácil':   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'media':   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'difícil': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

interface Props {
  dificultad: Dificultad
}

export function Badge({ dificultad }: Props) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${DIFICULTAD_STYLES[dificultad]}`}>
      {dificultad}
    </span>
  )
}
