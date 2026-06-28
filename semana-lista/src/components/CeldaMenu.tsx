import { Skeleton } from './ui/Skeleton'
import { RecetaCard } from './RecetaCard'
import type { Dia, Franja, OpcionesSlot } from '../types'

interface Props {
  dia: Dia
  franja: Franja
  estado: 'idle' | 'cargando' | 'listo' | 'error'
  datos?: OpcionesSlot
  onReintentar: () => void
  seleccionada: number
  onSeleccionar: (i: number) => void
}

export function CeldaMenu({ estado, datos, onReintentar, seleccionada, onSeleccionar }: Props) {
  if (estado === 'idle') {
    return (
      <div className="rounded-card border-2 border-dashed border-gray-200 dark:border-gray-700 p-3 text-center text-sm text-gray-400 min-h-[80px] flex items-center justify-center">
        Pulsa "Generar mi semana"
      </div>
    )
  }

  if (estado === 'cargando') {
    return (
      <div className="rounded-card border border-gray-200 dark:border-gray-700 p-3 min-h-[80px]">
        <p className="text-xs text-gray-400 mb-2 skeleton-pulse">🍳 Cocinando...</p>
        <Skeleton lines={3} />
      </div>
    )
  }

  if (estado === 'error' || !datos) {
    return (
      <div className="rounded-card border-2 border-red-200 dark:border-red-900 p-3 min-h-[80px] flex flex-col items-center justify-center gap-2">
        <p className="text-xs text-red-500">Error al generar</p>
        <button
          onClick={onReintentar}
          className="text-xs bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full px-3 py-1 hover:bg-red-100"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <RecetaCard
      opciones={datos.opciones}
      seleccionada={seleccionada}
      onSeleccionar={onSeleccionar}
    />
  )
}
