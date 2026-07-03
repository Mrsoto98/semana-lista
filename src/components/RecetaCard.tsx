import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Badge } from './ui/Badge'
import type { Receta } from '../types'
import { obtenerImagenReceta, fotoUrlPollinations } from '../lib/recetasCache'

function FotoReceta({ nombre }: { nombre: string }) {
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando')
  const [src, setSrc] = useState<string | null>(null)
  const divRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = divRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    obtenerImagenReceta(nombre).then(url => setSrc(url))
  }, [visible, nombre])

  return (
    <div ref={divRef} className="w-full h-28 rounded-t-card overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
      {estado === 'cargando' && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
      )}
      {src && estado !== 'error' && (
        <img
          src={src}
          alt={nombre}
          className={`w-full h-full object-cover transition-opacity duration-300 ${estado === 'ok' ? 'opacity-100' : 'opacity-0'}`}
          style={{ objectPosition: 'center 30%' }}
          onLoad={() => setEstado('ok')}
          onError={() => { setSrc(fotoUrlPollinations(nombre)); setEstado('cargando') }}
        />
      )}
    </div>
  )
}

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
  puedeAnadirExtra?: boolean
  cargandoExtra?: boolean
  onAnadirOpcionExtra?: () => void
}

// Emoji, border color y color CSS para el gradiente decorativo
function categoriaInfo(tags: string[]): { emoji: string; accent: string; color: string } {
  if (tags.includes('pollo'))     return { emoji: '🍗', accent: 'border-l-orange-400',  color: '#fb923c' }
  if (tags.includes('carne'))     return { emoji: '🥩', accent: 'border-l-red-400',     color: '#f87171' }
  if (tags.includes('pescado'))   return { emoji: '🐟', accent: 'border-l-cyan-400',    color: '#22d3ee' }
  if (tags.includes('pasta'))     return { emoji: '🍝', accent: 'border-l-yellow-400',  color: '#facc15' }
  if (tags.includes('arroz'))     return { emoji: '🍚', accent: 'border-l-amber-300',   color: '#fcd34d' }
  if (tags.includes('ensalada'))  return { emoji: '🥗', accent: 'border-l-lime-400',    color: '#a3e635' }
  if (tags.includes('sopa'))      return { emoji: '🍲', accent: 'border-l-blue-400',    color: '#60a5fa' }
  if (tags.includes('legumbres')) return { emoji: '🫘', accent: 'border-l-green-400',   color: '#4ade80' }
  if (tags.includes('huevo'))     return { emoji: '🥚', accent: 'border-l-yellow-300',  color: '#fde047' }
  if (tags.includes('vegano') || tags.includes('vegetariano')) return { emoji: '🥦', accent: 'border-l-emerald-400', color: '#34d399' }
  return { emoji: '🍽️', accent: 'border-l-gray-300', color: '#d1d5db' }
}

export function RecetaCard({
  opciones, seleccionada, onSeleccionar, onEliminar,
  esFavorita = false, onToggleFavorita,
  esDislike = false, onDislike, onQuitarDislike,
  puedeAnadirExtra = false, cargandoExtra = false, onAnadirOpcionExtra,
}: Props) {
  const [vista, setVista] = useState(seleccionada)
  // Sync local vista when external seleccionada changes (e.g. after regenerar día)
  React.useEffect(() => { setVista(seleccionada) }, [seleccionada])

  const receta = opciones[vista] ?? opciones[0]
  const [modalAbierto, setModalAbierto] = useState(false)
  const [pasos, setPasos] = useState<string[] | null>(null)
  const [cargandoPasos, setCargandoPasos] = useState(false)
  const [modalDislike, setModalDislike] = useState(false)

  React.useEffect(() => {
    if (!modalAbierto && !modalDislike) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setModalAbierto(false); setModalDislike(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [modalAbierto, modalDislike])
  const [motivoDislike, setMotivoDislike] = useState('')
  const [ingredientesSeleccionados, setIngredientesSeleccionados] = useState<Set<string>>(new Set())

  if (!receta) return null

  const { emoji, accent } = categoriaInfo(receta.tags)
  const estaSeleccionada = vista === seleccionada

  async function cargarPasos() {
    if (cargandoPasos) return
    setCargandoPasos(true)
    try {
      const { supabase } = await import('../lib/supabase')
      const { data } = await supabase.functions.invoke('generar-recetas', {
        body: { action: 'pasos', nombre: receta.nombre, ingredientes: receta.ingredientes, descripcion: receta.descripcion_corta },
      })
      setPasos((data as { pasos: string[] })?.pasos ?? [])
    } catch {
      setPasos(null)
    } finally {
      setCargandoPasos(false)
    }
  }

  async function verReceta(e: React.MouseEvent) {
    e.stopPropagation()
    setModalAbierto(true)
    if (pasos && pasos.length > 0) return
    cargarPasos()
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
      className={`rounded-card border-l-4 ${accent} overflow-hidden fade-slide-up transition-all duration-150 cursor-pointer card
        ${estaSeleccionada
          ? 'shadow-card-md ring-2 ring-green-select/20'
          : 'hover:shadow-card-md hover:-translate-y-0.5'
        }`}
      onClick={() => onSeleccionar(vista)}
    >
      <FotoReceta nombre={receta.nombre} />
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="font-semibold text-sm leading-tight">
            {emoji} {receta.nombre}
          </span>
          <div data-tutorial="receta-acciones" className="flex items-center gap-1 shrink-0">
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
          <span className="text-xs text-gray-400" title="Estimación por persona">🔥 {receta.calorias_aprox} kcal/p</span>
        </div>

        <div className="mt-2.5 flex items-center gap-3">
          <button
            data-tutorial="ver-receta"
            onClick={verReceta}
            className="text-xs text-green-select hover:text-green-700 font-medium transition-colors"
          >
            📖 Ver receta
          </button>
          {opciones.length === 1 && onAnadirOpcionExtra && (
            <button
              onClick={e => { e.stopPropagation(); onAnadirOpcionExtra() }}
              disabled={!puedeAnadirExtra || cargandoExtra}
              title={puedeAnadirExtra ? 'Genera una segunda opción para elegir' : 'Límite de días con opción extra alcanzado'}
              className="text-xs text-gray-400 hover:text-green-select font-medium transition-colors disabled:opacity-30 disabled:hover:text-gray-400"
            >
              {cargandoExtra ? '⏳ Generando...' : '➕ Otra opción'}
            </button>
          )}
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
            <div className="-mx-5 -mt-5 mb-4 h-44 overflow-hidden rounded-t-2xl">
              <FotoReceta nombre={receta.nombre} />
            </div>
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
                    <span className="leading-relaxed">{paso.replace(/^\d+\.?\s*/, '')}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <button
                onClick={cargarPasos}
                className="text-sm text-gray-400 hover:text-green-select transition-colors"
              >
                Reintentar ↺
              </button>
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
