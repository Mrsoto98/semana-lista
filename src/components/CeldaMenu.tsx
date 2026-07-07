import { Skeleton } from './ui/Skeleton'
import { RecetaCard } from './RecetaCard'
import type { Dia, Franja, OpcionesSlot, Receta } from '../types'

interface Props {
  dia: Dia
  franja: Franja
  estado: 'idle' | 'cargando' | 'listo' | 'error' | 'vacio'
  datos?: OpcionesSlot
  onReintentar: () => void
  onEliminar: () => void
  seleccionada: number
  onSeleccionar: (i: number) => void
  favoritasNombres: Set<string>
  onToggleFavorita: (receta: Receta) => void
  dislikesNombres: Set<string>
  onDislike: (receta: Receta, ingredientes: string[], motivo: string) => void
  onQuitarDislike: (receta: Receta) => void
  puedeAnadirExtra?: boolean
  cargandoExtra?: boolean
  onAnadirOpcionExtra?: () => void
}

export function CeldaMenu({
  estado, datos, onReintentar, onEliminar, seleccionada, onSeleccionar,
  favoritasNombres, onToggleFavorita,
  dislikesNombres, onDislike, onQuitarDislike,
  puedeAnadirExtra, cargandoExtra, onAnadirOpcionExtra,
}: Props) {
  if (estado === 'idle') {
    return (
      <div className="rounded-card border-2 border-dashed border-gray-200 dark:border-gray-700 p-3 text-center text-sm text-gray-300 dark:text-gray-600 min-h-[80px] flex items-center justify-center">
        —
      </div>
    )
  }

  if (estado === 'cargando') {
    return (
      <div className="rounded-card bg-white dark:bg-gray-900 shadow-card p-3 min-h-[80px]">
        <p className="text-xs text-gray-400 mb-2 skeleton-pulse">🍳 Cocinando...</p>
        <Skeleton lines={3} />
      </div>
    )
  }

  if (estado === 'error' || !datos) {
    return (
      <div className="rounded-card bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 p-3 min-h-[80px] flex flex-col items-center justify-center gap-2">
        <p className="text-xs text-red-400">Error al generar</p>
        <button
          onClick={onReintentar}
          className="text-xs bg-white dark:bg-gray-900 text-red-500 border border-red-200 dark:border-red-800 rounded-full px-3 py-1 hover:bg-red-50 shadow-sm transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const recetaActual = datos.opciones[seleccionada]

  return (
    <RecetaCard
      opciones={datos.opciones}
      seleccionada={seleccionada}
      onSeleccionar={onSeleccionar}
      onEliminar={onEliminar}
      esFavorita={recetaActual ? favoritasNombres.has(recetaActual.nombre) : false}
      onToggleFavorita={onToggleFavorita}
      esDislike={recetaActual ? dislikesNombres.has(recetaActual.nombre) : false}
      onDislike={onDislike}
      onQuitarDislike={onQuitarDislike}
      puedeAnadirExtra={puedeAnadirExtra}
      cargandoExtra={cargandoExtra}
      onAnadirOpcionExtra={onAnadirOpcionExtra}
    />
  )
}
