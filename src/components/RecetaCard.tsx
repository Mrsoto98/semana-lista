import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Badge } from './ui/Badge'
import type { Receta } from '../types'

interface Props {
  opciones: Receta[]
  seleccionada: number
  onSeleccionar: (i: number) => void
  onEliminar: () => void
  esFavorita?: boolean
  onToggleFavorita?: (receta: Receta) => void
  esDislike?: boolean
  onDislike?: (receta: Receta, ingredientes: string[], motivo: string) => void
  onQuitarDislike?: (receta: Receta) => void
}

// Emoji y color de acento por categoría de tag
function categoriaInfo(tags: string[]): { emoji: string; accent: string } {
  if (tags.includes('pollo'))     return { emoji: '🍗', accent: 'border-l-orange-400' }
  if (tags.includes('carne'))     return { emoji: '🥩', accent: 'border-l-red-400' }
  if (tags.includes('pescado'))   return { emoji: '🐟', accent: 'border-l-cyan-400' }
  if (tags.includes('pasta'))     return { emoji: '🍝', accent: 'border-l-yellow-400' }
  if (tags.includes('arroz'))     return { emoji: '🍚', accent: 'border-l-amber-300' }
  if (tags.includes('ensalada'))  return { emoji: '🥗', accent: 'border-l-lime-400' }
  if (tags.includes('sopa'))      return { emoji: '🍲', accent: 'border-l-blue-400' }
  if (tags.includes('legumbres')) return { emoji: '🫘', accent: 'border-l-green-400' }
  if (tags.includes('huevo'))     return { emoji: '🥚', accent: 'border-l-yellow-300' }
  if (tags.includes('vegano') || tags.includes('vegetariano')) return { emoji: '🥦', accent: 'border-l-emerald-400' }
  return { emoji: '🍽️', accent: 'border-l-gray-300' }
}

export function RecetaCard({
  opciones, seleccionada, onSeleccionar, onEliminar,
  esFavorita = false, onToggleFavorita,
  esDislike = false, onDislike, onQuitarDislike,
}: Props) {
  const [vista, setVista] = useState(seleccionada)
  // Sync local vista when external seleccionada changes (e.g. after regenerar día)
  React.useEffect(() => { setVista(seleccionada) }, [seleccionada])

  const receta = opciones[vista] ?? opciones[0]
  const [modalAbierto, setModalAbierto] = useState(false)
  const [pasos, setPasos] = useState<string[] | null>(null)
  const [cargandoPasos, setCargandoPasos] = useState(false)
  const [modalDislike, setModalDislike] = useState(false)
  const [motivoDislike, setMotivoDislike] = useState('')
  const [ingredientesSeleccionados, setIngredientesSeleccionados] = useState<Set<string>>(new Set())

  if (!receta) return null

  const { emoji, accent } = categoriaInfo(receta.tags)
  const estaSeleccionada = vista === seleccionada

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

  function abrirModalDislike(e: React.MouseEvent) {
    e.stopPropagation()
    if (esDislike) { onQuitarDislike?.(receta); return }
    setMotivoDislike('')
    setIngredientesSeleccionados(new Set())
    setModalDislike(true)
  }

  function toggleIngrediente(nombre: string) {
    setIngredientesSeleccionados(prev => {
      const next = new Set(prev)
      next.has(nombre) ? next.delete(nombre) : next.add(nombre)
      return next
    })
  }

  function confirmarDislike(e: React.MouseEvent) {
    e.stopPropagation()
    onDislike?.(receta, [...ingredientesSeleccionados], motivoDislike.trim())
    setModalDislike(false)
  }

  return (
    <div
      className={`rounded-card border-l-4 ${accent} overflow-hidden fade-slide-up transition-all duration-150 cursor-pointer
        ${estaSeleccionada
          ? 'shadow-card-md ring-2 ring-green-select/20 bg-white dark:bg-gray-900'
          : 'shadow-card bg-white dark:bg-gray-900 hover:shadow-card-md'
        }`}
      onClick={() => onSeleccionar(vista)}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="font-semibold text-sm leading-tight">
            {emoji} {receta.nombre}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {estaSeleccionada && (
              <span className="text-green-select text-base font-bold">✓</span>
            )}
            {onToggleFavorita && (
              <button
                onClick={e => { e.stopPropagation(); onToggleFavorita(receta) }}
                title={esFavorita ? 'Quitar de favoritas' : 'Guardar en favoritas'}
                className={`text-base leading-none transition-colors ${esFavorita ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
              >
                {esFavorita ? '⭐' : '☆'}
              </button>
            )}
            {onDislike && (
              <button
                onClick={abrirModalDislike}
                title={esDislike ? 'Quitar no me gusta' : 'No me gusta'}
                className={`text-base leading-none transition-colors ${esDislike ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
              >
                👎
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

        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2.5 line-clamp-2 leading-relaxed">
          {receta.descripcion_corta}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge dificultad={receta.dificultad} />
          <span className="text-xs text-gray-400">⏱ {receta.tiempo_prep} min</span>
          <span className="text-xs text-gray-400">🔥 {receta.calorias_aprox} kcal</span>
        </div>

        <div className="mt-2.5">
          <button
            onClick={verReceta}
            className="text-xs text-green-select hover:text-green-700 font-medium transition-colors"
          >
            📖 Ver receta
          </button>
        </div>
      </div>

      {/* Modal Ver receta — portal para evitar que transform del padre lo recorte */}
      {modalAbierto && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setModalAbierto(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-md shadow-card-lg max-h-[80svh] overflow-y-auto animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className={`w-full h-1 rounded-full mb-4 bg-gradient-to-r from-${accent.replace('border-l-','')} to-transparent opacity-60`} />
            <div className="flex items-start justify-between mb-3">
              <h2 className="font-bold text-base leading-tight pr-2">{emoji} {receta.nombre}</h2>
              <button onClick={() => setModalAbierto(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none shrink-0">✕</button>
            </div>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">{receta.descripcion_corta}</p>

            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Ingredientes</h3>
            <ul className="space-y-1 mb-4">
              {receta.ingredientes.map((ing, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                  <span className="text-gray-300">·</span>
                  <span>{ing.cantidad} {ing.unidad} <span className="font-medium">{ing.nombre}</span></span>
                </li>
              ))}
            </ul>

            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Pasos</h3>
            {cargandoPasos ? (
              <p className="text-sm text-gray-400 animate-pulse">Generando pasos...</p>
            ) : pasos && pasos.length > 0 ? (
              <ol className="space-y-3">
                {pasos.map((paso, i) => (
                  <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <span className="leading-relaxed">{paso.replace(/^\d+\.\s*/, '')}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-400">No se pudieron cargar los pasos.</p>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Modal No me gusta */}
      {modalDislike && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setModalDislike(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md shadow-card-lg max-h-[85vh] overflow-y-auto animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">👎 ¿Por qué no te gusta?</h2>
              <button onClick={() => setModalDislike(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Marca los ingredientes que no te gustan de <span className="font-semibold text-gray-700 dark:text-gray-300">{receta.nombre}</span>:
            </p>
            <div className="space-y-2 mb-4">
              {receta.ingredientes.map((ing, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={ingredientesSeleccionados.has(ing.nombre)}
                    onChange={() => toggleIngrediente(ing.nombre)}
                    className="w-4 h-4 rounded accent-red-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900">{ing.nombre}</span>
                </label>
              ))}
            </div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Otro motivo (opcional)</label>
            <input
              type="text" value={motivoDislike}
              onChange={e => setMotivoDislike(e.target.value)}
              placeholder="Ej: muy picante, demasiado tiempo..."
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm mb-5 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-3">
              <button onClick={() => setModalDislike(false)} className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
              <button onClick={confirmarDislike} className="flex-1 bg-red-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-600">Guardar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {opciones.length > 1 && (
        <div className="border-t border-gray-100 dark:border-gray-800 flex">
          {opciones.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setVista(i); onSeleccionar(i) }}
              className={`flex-1 py-1.5 text-xs transition-colors font-medium
                ${i === vista ? 'bg-green-select text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}
                ${i === 0 ? 'rounded-bl-card' : ''}
                ${i === opciones.length - 1 ? 'rounded-br-card' : ''}`}
            >
              Opción {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
