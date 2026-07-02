import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { MatchProducto } from '../lib/matchMercadona'
import { topMatchesMercadona } from '../lib/matchMercadona'

interface Producto { id?: string; nombre: string; precio: number; foto?: string | null; precio_kg?: number | null; tamaño?: number; unidad?: string }

interface Props {
  ingrediente: string
  opciones: MatchProducto[]
  enCasa?: boolean
  catalogo?: Record<string, Producto[]>
  onSeleccionar: (producto: MatchProducto) => void
  onCancelar: () => void
}

export function PickerProductoMercadona({ ingrediente, opciones, enCasa, catalogo, onSeleccionar, onCancelar }: Props) {
  const [customNombre, setCustomNombre] = useState('')
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelar() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancelar])

  const resultadosBusqueda = useMemo<MatchProducto[]>(() => {
    const q = busqueda.trim()
    if (!q || !catalogo) return []
    return topMatchesMercadona(q, catalogo, 8)
  }, [busqueda, catalogo])

  function añadirCustom() {
    const nombre = customNombre.trim() || ingrediente
    onSeleccionar({ nombre, precio: 0 })
  }

  const listaBase = opciones

  return (
    <>
    {fotoAmpliada && createPortal(
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6" onClick={() => setFotoAmpliada(null)}>
        <img src={fotoAmpliada} alt="" className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain" />
      </div>,
      document.body
    )}
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-12" onClick={onCancelar}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
            {enCasa ? '🏠 Añadir a en casa' : '🛒 Añadir a la lista'}
          </p>
          <h3 className="text-base font-black text-gray-800 dark:text-gray-100 mb-3">
            ¿Cuál de estos es <span className="text-green-select">"{ingrediente}"</span>?
          </h3>

          {/* Buscador del catálogo */}
          <div className="relative mb-3">
            <input
              ref={inputRef}
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar en catálogo Mercadona…"
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-green-select focus:bg-white dark:focus:bg-gray-900 transition-colors"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
            )}

            {/* Dropdown de resultados */}
            {resultadosBusqueda.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-10 max-h-60 overflow-y-auto">
                {resultadosBusqueda.map((op, i) => (
                  <button
                    key={`search_${op.nombre}_${i}`}
                    onClick={() => { onSeleccionar(op); setBusqueda('') }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    {op.foto ? (
                      <img
                        src={op.foto}
                        alt=""
                        loading="lazy"
                        className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-100 dark:bg-gray-700"
                        onError={e => { e.currentTarget.style.visibility = 'hidden' }}
                      />
                    ) : (
                      <span className="w-10 h-10 rounded-lg shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-300">🛒</span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-gray-800 dark:text-gray-100 leading-tight truncate">{op.nombre}</span>
                      {op.tamaño && op.unidad && op.unidad !== 'ud' && (
                        <span className="text-xs text-gray-400">{op.tamaño} {op.unidad}</span>
                      )}
                    </span>
                    <span className="text-sm font-bold text-green-select shrink-0">{op.precio.toFixed(2)} €</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lista de sugerencias automáticas */}
          {listaBase.length > 0 && !busqueda && (
            <div className="space-y-2 max-h-44 overflow-y-auto mb-3">
              {listaBase.map((op, i) => (
                <button
                  key={`${op.nombre}_${i}`}
                  onClick={() => onSeleccionar(op)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-green-select/60 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left"
                >
                  {op.foto ? (
                    <img
                      src={op.foto}
                      alt=""
                      loading="lazy"
                      className="w-11 h-11 rounded-lg object-cover shrink-0 bg-gray-100 dark:bg-gray-700 cursor-zoom-in"
                      onError={e => { e.currentTarget.style.visibility = 'hidden' }}
                      onClick={e => { e.stopPropagation(); setFotoAmpliada(op.foto!) }}
                    />
                  ) : (
                    <span className="w-11 h-11 rounded-lg shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-300 text-lg">🛒</span>
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-gray-800 dark:text-gray-100 leading-tight">{op.nombre}</span>
                    {op.tamaño && op.unidad && op.unidad !== 'ud' && (
                      <span className="text-xs text-gray-400">{op.tamaño} {op.unidad}</span>
                    )}
                  </span>
                  <span className="text-sm font-bold text-green-select shrink-0">{op.precio.toFixed(2)} €</span>
                </button>
              ))}
            </div>
          )}

          {/* Nombre personalizado */}
          <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
            <p className="text-xs text-gray-400 mb-2">
              {listaBase.length === 0 ? 'No hay coincidencias. Añade un nombre personalizado:' : 'O escribe un nombre personalizado:'}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customNombre}
                onChange={e => setCustomNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && añadirCustom()}
                placeholder={ingrediente}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-green-select"
              />
              <button
                onClick={añadirCustom}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-green-select text-white"
              >
                Añadir
              </button>
            </div>
          </div>

          <button
            onClick={onCancelar}
            className="w-full mt-3 py-2.5 text-sm text-gray-400 font-medium"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
