import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { expandirCatalogo } from '../lib/matchMercadona'

interface Producto { id?: string; nombre: string; precio: number; foto?: string | null; tamaño?: number; unidad?: string }

interface Props {
  enCasa: Set<string>
  catalogo?: Record<string, Producto[]>
  onRemove: (nombre: string) => void
  onAddToCart?: (nombre: string) => void
  enCarrito?: Set<string>
}

const CAT_EMOJI: Record<string, string> = {
  'Aceites y vinagres': '🫒', 'Aceite, especias y salsas': '🫒',
  'Especias y condimentos': '🧂', 'Salsas y aderezos': '🥫',
  'Agua y refrescos': '💧', 'Aperitivos': '🍿',
  'Arroz, legumbres y pasta': '🍚', 'Bodega': '🍷', 'Carne': '🥩',
  'Charcutería y quesos': '🧀', 'Congelados': '🧊', 'Conservas y productos en tarro': '🥫',
  'Droguería': '🧴', 'Fruta': '🍎', 'Fruta y verdura': '🍎',
  'Huevos, leche y mantequilla': '🥛', 'Lácteos': '🥛', 'Lacteos': '🥛',
  'Limpieza': '🧹', 'Marisco y pescado': '🐟',
  'Mascotas': '🐾', 'Pan y bollería': '🍞', 'Panadería y pastelería': '🍞',
  'Postres y yogures': '🍮', 'Verduras y hortalizas': '🥦',
  'Higiene': '🧼', 'Cafés e infusiones': '☕', 'Cereales y galletas': '🥣',
  'Salsas y especias': '🧂', 'Zumos': '🍊',
}

export function EnCasaSection({ enCasa, catalogo, onRemove, onAddToCart, enCarrito }: Props) {
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)

  React.useEffect(() => {
    if (!fotoAmpliada) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFotoAmpliada(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fotoAmpliada])

  const catalogoExpandido = useMemo(() => catalogo ? expandirCatalogo(catalogo) : catalogo, [catalogo])

  const infoMap = useMemo(() => {
    const map = new Map<string, { foto?: string | null; categoria: string }>()
    if (!catalogoExpandido) return map
    for (const [cat, prods] of Object.entries(catalogoExpandido)) {
      for (const p of prods) {
        if (!map.has(p.nombre)) map.set(p.nombre, { foto: p.foto, categoria: cat })
      }
    }
    return map
  }, [catalogoExpandido])

  const grupos = useMemo(() => {
    const g = new Map<string, string[]>()
    for (const item of Array.from(enCasa).sort()) {
      const cat = infoMap.get(item)?.categoria ?? 'Otros'
      if (!g.has(cat)) g.set(cat, [])
      g.get(cat)!.push(item)
    }
    return Array.from(g.entries()).sort(([a], [b]) => {
      if (a === 'Otros') return 1
      if (b === 'Otros') return -1
      return a.localeCompare(b, 'es')
    })
  }, [enCasa, infoMap])

  return (
    <>
      <div data-tutorial="en-casa">
        <button
          data-tutorial="en-casa-btn"
          onClick={() => setAbierto(v => !v)}
          className="flex items-center gap-2 w-full text-left mb-2 py-1"
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">🏠 En casa</h2>
          <span className={`ml-auto w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm transition-transform duration-200 ${abierto ? 'rotate-0' : '-rotate-90'}`}>▾</span>
        </button>
        {abierto && (
          <div className="bg-white dark:bg-gray-900 shadow-card rounded-card p-3 space-y-3">
            {grupos.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">Nada en casa todavía 🏠</p>
            ) : grupos.map(([cat, items]) => (
              <div key={cat}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  {CAT_EMOJI[cat] ?? '📦'} {cat}
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map(item => {
                    const foto = infoMap.get(item)?.foto
                    const yaEnCarrito = enCarrito?.has(item) ?? false
                    return (
                      <div key={item} className="flex rounded-full overflow-hidden border border-blue-100 dark:border-blue-800 shadow-sm">
                        {/* foto + nombre */}
                        <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium pl-0.5 pr-2 py-0.5">
                          {foto ? (
                            <img
                              src={foto}
                              alt=""
                              loading="lazy"
                              className="w-6 h-6 rounded-full object-cover shrink-0 bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 cursor-zoom-in"
                              onError={e => { e.currentTarget.style.display = 'none' }}
                              onClick={() => setFotoAmpliada(foto)}
                            />
                          ) : (
                            <span className="w-6 h-6 rounded-full shrink-0 bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-[10px]">🏠</span>
                          )}
                          <span className="leading-tight">{item}</span>
                        </div>
                        {/* añadir al carrito */}
                        {onAddToCart && (
                          <button
                            onClick={() => onAddToCart(item)}
                            title="Añadir al carrito"
                            className={`text-xs px-2 py-0.5 border-l border-blue-100 dark:border-blue-800 transition-colors ${yaEnCarrito ? 'bg-green-500 text-white' : 'bg-blue-50 dark:bg-blue-900/40 text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60'}`}
                          >
                            {yaEnCarrito ? '✓' : '🛒'}
                          </button>
                        )}
                        {/* quitar de en casa */}
                        <button
                          onClick={() => onRemove(item)}
                          title="Quitar de En casa"
                          className="text-xs px-2 py-0.5 border-l border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/40 text-blue-300 dark:text-blue-600 hover:bg-red-50 hover:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {fotoAmpliada && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setFotoAmpliada(null)}
        >
          <img
            src={fotoAmpliada}
            alt=""
            className="max-w-[80vw] max-h-[80vh] rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </>
  )
}
