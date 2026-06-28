// src/components/IngredienteRow.tsx
import type { ResultadoPrecio } from '../types'

interface Props {
  resultado: ResultadoPrecio
  checked: boolean
  onToggle: () => void
}

export function IngredienteRow({ resultado, checked, onToggle }: Props) {
  return (
    <label className={`flex items-start gap-3 py-2 cursor-pointer ${checked ? 'opacity-50' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 w-4 h-4 rounded accent-green-select"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`font-medium text-sm ${checked ? 'line-through' : ''}`}>
            {resultado.ingrediente}
          </span>
          <span className="text-xs text-gray-400">
            {resultado.cantidad_necesaria} {resultado.unidad}
          </span>
          {resultado.sin_precio && (
            <span title="Precio no encontrado" className="text-xs text-orange-accent">⚠️</span>
          )}
        </div>
        {resultado.producto_mercadona && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {resultado.producto_mercadona} · {resultado.envases_a_comprar} ud.
            {resultado.sobrante ? ` (sobran ${resultado.sobrante} ${resultado.unidad_envase})` : ''}
          </p>
        )}
      </div>
      {resultado.coste_real !== undefined && (
        <span className="text-sm font-semibold shrink-0">
          {resultado.coste_real.toFixed(2)} €
        </span>
      )}
    </label>
  )
}
