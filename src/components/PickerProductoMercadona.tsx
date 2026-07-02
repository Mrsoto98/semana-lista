import { useState } from 'react'
import type { MatchProducto } from '../lib/matchMercadona'

interface Props {
  ingrediente: string
  opciones: MatchProducto[]
  enCasa?: boolean
  onSeleccionar: (producto: MatchProducto) => void
  onCancelar: () => void
}

export function PickerProductoMercadona({ ingrediente, opciones, enCasa, onSeleccionar, onCancelar }: Props) {
  const [customNombre, setCustomNombre] = useState('')

  function añadirCustom() {
    const nombre = customNombre.trim() || ingrediente
    onSeleccionar({ nombre, precio: 0 })
  }

  return (
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
          <h3 className="text-base font-black text-gray-800 dark:text-gray-100 mb-4">
            ¿Cuál de estos es <span className="text-green-select">"{ingrediente}"</span>?
          </h3>

          {opciones.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
              {opciones.map(op => (
                <button
                  key={op.nombre}
                  onClick={() => onSeleccionar(op)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-green-select/60 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left"
                >
                  {op.foto ? (
                    <img
                      src={op.foto}
                      alt=""
                      loading="lazy"
                      className="w-11 h-11 rounded-lg object-cover shrink-0 bg-gray-100 dark:bg-gray-700"
                      onError={e => { e.currentTarget.style.visibility = 'hidden' }}
                    />
                  ) : (
                    <span className="w-11 h-11 rounded-lg shrink-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-300 text-lg">🛒</span>
                  )}
                  <span className="flex-1 text-sm text-gray-800 dark:text-gray-100 leading-tight">{op.nombre}</span>
                  <span className="text-sm font-bold text-green-select shrink-0">{op.precio.toFixed(2)} €</span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
            <p className="text-xs text-gray-400 mb-2">
              {opciones.length === 0 ? 'No hay coincidencias en Mercadona. Añade un nombre personalizado:' : 'O escribe un nombre personalizado:'}
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
  )
}
