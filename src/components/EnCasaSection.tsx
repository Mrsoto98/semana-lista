import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

interface Producto { id?: string; nombre: string; precio: number; foto?: string | null; tamaño?: number; unidad?: string }

interface Props {
  enCasa: Set<string>
  catalogo?: Record<string, Producto[]>
  onRemove: (nombre: string) => void
}

const CAT_EMOJI: Record<string, string> = {
  'Aceites y vinagres': '🫒', 'Aceite, especias y salsas': '🫒',
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

export function EnCasaSection({ enCasa, catalogo, onRemove }: Props) {
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set())

  function toggleCat(cat: string) {
    setColapsadas(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  const infoMap = useMemo(() => {
    const map = new Map<string, { foto?: string | null; categoria: string }>()
    if (!catalogo) return map
    for (const [cat, prods] of Object.entries(catalogo)) {
      for (const p of prods) {
        if (!map.has(p.nombre)) map.set(p.nombre, { foto: p.foto, categoria: cat })
      }
    }
    return map
  }, [catalogo])

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
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">🏠 En casa</h2>
        <div className="bg-white dark:bg-gray-900 shadow-card rounded-card p-3 space-y-3">
          {grupos.map(([cat, items]) => (
            <div key={cat}>
              <button
                onClick={() => toggleCat(cat)}
                className="flex items-center gap-1 w-full text-left mb-1.5 group"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {CAT_EMOJI[cat] ?? '📦'} {cat}
                </p>
                <span className="text-[9px] text-gray-400 ml-auto transition-transform duration-200" style={{ transform: colapsadas.has(cat) ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
              </button>
              {!colapsadas.has(cat) && <div className="flex flex-wrap gap-2">
                {items.map(item => {
                  const foto = infoMap.get(item)?.foto
                  return (
                    <button
                      key={item}
                      onClick={() => onRemove(item)}
                      className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium pl-0.5 pr-3 py-0.5 rounded-full border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                    >
                      {foto ? (
                        <img
                          src={foto}
                          alt=""
                          loading="lazy"
                          className="w-6 h-6 rounded-full object-cover shrink-0 bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 cursor-zoom-in"
                          onError={e => { e.currentTarget.style.display = 'none' }}
                          onClick={e => { e.stopPropagation(); setFotoAmpliada(foto) }}
                        />
                      ) : (
                        <span className="w-6 h-6 rounded-full shrink-0 bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-[10px]">🏠</span>
                      )}
                      <span className="leading-tight">{item}</span>
                      <span className="text-blue-300 dark:text-blue-600 text-[10px] leading-none ml-0.5">✕</span>
                    </button>
                  )
                })}
              </div>}
            </div>
          ))}
        </div>
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
