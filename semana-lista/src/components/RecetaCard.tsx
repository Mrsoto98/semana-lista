import React, { useState } from 'react'
import { Badge } from './ui/Badge'
import type { Receta } from '../types'

interface Props {
  opciones: Receta[]
  seleccionada: number
  onSeleccionar: (i: number) => void
  onEliminar: () => void
  esFavorita?: boolean
  onToggleFavorita?: (receta: Receta) => void
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

export function RecetaCard({ opciones, seleccionada, onSeleccionar, onEliminar, esFavorita = false, onToggleFavorita }: Props) {
  const [vista, setVista] = useState(seleccionada)
  const receta = opciones[vista]
  const [modalAbierto, setModalAbierto] = useState(false)
  const [pasos, setPasos] = useState<string[] | null>(null)
  const [cargandoPasos, setCargandoPasos] = useState(false)

  async function verReceta(e: React.MouseEvent) {
    e.stopPropagation()
    setModalAbierto(true)
    if (pasos) return
    setCargandoPasos(true)
    try {
      const { supabase } = await import('../lib/supabase')
      const { data } = await supabase.functions.invoke('generar-recetas', {
        body: { action: 'pasos', nombre: receta.nombre, ingredientes: receta.ingredientes, descripcion: receta.descripcion_corta },
      })
      setPasos((data as { pasos: string[] })?.pasos ?? [])
    } catch {
      setPasos([])
    } finally {
      setCargandoPasos(false)
    }
  }

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
          <div className="flex items-center gap-1.5 shrink-0">
            {vista === seleccionada && (
              <span className="text-green-select text-lg">✓</span>
            )}
            {onToggleFavorita && (
              <button
                onClick={e => { e.stopPropagation(); onToggleFavorita(receta) }}
                title={esFavorita ? 'Quitar de favoritas' : 'Guardar en favoritas'}
                className="text-base leading-none transition-colors"
              >
                {esFavorita ? '⭐' : '☆'}
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); onEliminar() }}
              title="Eliminar esta comida"
              className="text-gray-300 hover:text-red-400 text-base leading-none transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
          {receta.descripcion_corta}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge dificultad={receta.dificultad} />
          <span className="text-xs text-gray-400">⏱ {receta.tiempo_prep} min</span>
          <span className="text-xs text-gray-400">🔥 {receta.calorias_aprox} kcal</span>
        </div>
        <div className="mt-2">
          <button
            onClick={verReceta}
            className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
          >
            📖 Ver receta
          </button>
        </div>
      </div>

      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModalAbierto(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="font-bold text-base leading-tight pr-2">{receta.nombre}</h2>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none shrink-0"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{receta.descripcion_corta}</p>

            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Ingredientes</h3>
            <ul className="space-y-1 mb-4">
              {receta.ingredientes.map((ing, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                  {ing.cantidad} {ing.unidad} {ing.nombre}
                </li>
              ))}
            </ul>

            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Pasos</h3>
            {cargandoPasos ? (
              <p className="text-sm text-gray-400 animate-pulse">Generando pasos...</p>
            ) : pasos && pasos.length > 0 ? (
              <ol className="space-y-2">
                {pasos.map((paso, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300">{paso}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-400">No se pudieron cargar los pasos.</p>
            )}
          </div>
        </div>
      )}

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
