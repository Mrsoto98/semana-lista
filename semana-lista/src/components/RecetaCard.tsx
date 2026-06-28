import { useState } from 'react'
import { Badge } from './ui/Badge'
import type { Receta } from '../types'

interface Props {
  opciones: Receta[]
  seleccionada: number
  onSeleccionar: (i: number) => void
}

function tagEmoji(tags: string[]): string {
  if (tags.includes('pasta')) return '🍝'
  if (tags.includes('arroz')) return '🍚'
  if (tags.includes('ensalada')) return '🥗'
  if (tags.includes('sopa')) return '🍲'
  if (tags.includes('carne')) return '🥩'
  if (tags.includes('pescado')) return '🐟'
  if (tags.includes('legumbres')) return '🫘'
  if (tags.includes('huevo')) return '🥚'
  if (tags.includes('pollo')) return '🍗'
  return '🍽️'
}

export function RecetaCard({ opciones, seleccionada, onSeleccionar }: Props) {
  const [vista, setVista] = useState(seleccionada)
  const receta = opciones[vista]

  return (
    <div
      className={`rounded-card border-2 transition-colors cursor-pointer fade-slide-up ${
        vista === seleccionada
          ? 'border-green-select bg-green-50 dark:bg-green-950'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
      }`}
      onClick={() => onSeleccionar(vista)}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="font-semibold text-sm leading-tight">
            {tagEmoji(receta.tags)} {receta.nombre}
          </span>
          {vista === seleccionada && (
            <span className="shrink-0 text-green-select text-lg">✓</span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
          {receta.descripcion_corta}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge dificultad={receta.dificultad} />
          <span className="text-xs text-gray-400">⏱ {receta.tiempo_prep} min</span>
          <span className="text-xs text-gray-400">🔥 {receta.calorias_aprox} kcal</span>
        </div>
      </div>

      {opciones.length > 1 && (
        <div className="border-t border-gray-100 dark:border-gray-800 flex">
          {opciones.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setVista(i); onSeleccionar(i) }}
              className={`flex-1 py-1.5 text-xs transition-colors ${
                i === vista
                  ? 'bg-green-select text-white'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              } ${i === 0 ? 'rounded-bl-card' : ''} ${i === opciones.length - 1 ? 'rounded-br-card' : ''}`}
            >
              Opción {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
