import React, { useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { expandirCatalogo } from '../lib/matchMercadona'
import { useI18n } from '../hooks/useI18n'
import { supabase } from '../lib/supabase'

interface Producto { id?: string; nombre: string; precio: number; foto?: string | null; tamaño?: number; unidad?: string }

interface Props {
  enCasa: Set<string>
  catalogo?: Record<string, Producto[]>
  onRemove: (nombre: string) => void
  onAddToCart?: (nombre: string) => void
  enCarrito?: Set<string>
  onAddItems?: (nombres: string[]) => void
}

const CAT_EMOJI: Record<string, string> = {
  'Aceites y vinagres': '🫒', 'Aceite, especias y salsas': '🫒',
  'Especias, salsas y aderezos': '🧂',
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

export function EnCasaSection({ enCasa, catalogo, onRemove, onAddToCart, enCarrito, onAddItems }: Props) {
  const { t } = useI18n()
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  // Índice de nombres del catálogo en minúsculas para matching rápido
  const catalogoNombres = useMemo(() => {
    if (!catalogoExpandido) return []
    const nombres: string[] = []
    for (const prods of Object.values(catalogoExpandido)) {
      for (const p of prods) nombres.push(p.nombre)
    }
    return nombres
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

  // Busca el mejor match del catálogo para un nombre extraído del ticket
  function matchCatalogo(nombre: string): string {
    const q = nombre.toLowerCase().trim()
    // 1. Coincidencia exacta
    const exacto = catalogoNombres.find(n => n.toLowerCase() === q)
    if (exacto) return exacto
    // 2. El nombre del catálogo contiene el término del ticket
    const contiene = catalogoNombres.find(n => n.toLowerCase().includes(q))
    if (contiene) return contiene
    // 3. El término del ticket contiene palabras del catálogo (palabra más larga que coincida)
    const palabras = q.split(/\s+/).filter(p => p.length > 3)
    let mejorMatch = ''
    let mejorScore = 0
    for (const n of catalogoNombres) {
      const nl = n.toLowerCase()
      const score = palabras.filter(p => nl.includes(p)).length
      if (score > mejorScore) { mejorScore = score; mejorMatch = n }
    }
    if (mejorScore > 0) return mejorMatch
    // 4. Sin match — devolver el nombre tal cual en minúsculas
    return q
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setEscaneando(true)
    setScanMsg(null)

    try {
      // Convertir imagen a base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          // Quitar el prefijo "data:image/jpeg;base64,"
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Sin sesión')

      const res = await supabase.functions.invoke('escanear-ticket', {
        body: { imagen: base64, tipo: file.type || 'image/jpeg' },
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.error) throw res.error

      const productos: string[] = res.data?.productos ?? []

      if (productos.length === 0) {
        setScanMsg(t.encasa_scan_vacio)
        return
      }

      // Hacer match con el catálogo de Mercadona
      const matched = productos.map(p => matchCatalogo(p))
      // Filtrar duplicados y los que ya están en casa
      const nuevos = [...new Set(matched)].filter(n => !enCasa.has(n))

      if (nuevos.length === 0) {
        setScanMsg(t.encasa_scan_vacio)
        return
      }

      onAddItems?.(nuevos)
      setScanMsg(typeof t.encasa_scan_ok === 'function' ? t.encasa_scan_ok(nuevos.length) : '')
      if (!abierto) setAbierto(true)
    } catch (err) {
      console.error('Scan error:', err)
      setScanMsg(t.encasa_scan_error)
    } finally {
      setEscaneando(false)
      setTimeout(() => setScanMsg(null), 4000)
    }
  }

  return (
    <>
      <div data-tutorial="en-casa">
        <div className="flex items-center gap-2 mb-2">
          <button
            data-tutorial="en-casa-btn"
            onClick={() => setAbierto(v => !v)}
            className="flex items-center gap-2 flex-1 text-left py-1"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t.encasa_titulo}</h2>
            <span className={`ml-auto w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm transition-transform duration-200 ${abierto ? 'rotate-0' : '-rotate-90'}`}>▾</span>
          </button>

          {/* Botón escanear ticket */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={escaneando}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 shrink-0"
          >
            {escaneando ? (
              <span className="animate-spin text-sm">⟳</span>
            ) : (
              <span className="text-sm">📷</span>
            )}
            {escaneando ? t.encasa_escaneando : t.encasa_escanear}
          </button>

          {/* Input oculto para la cámara — funciona en web (iOS/Android/desktop) */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleScan}
          />
        </div>

        {/* Mensaje de resultado del escaneo */}
        {scanMsg && (
          <p className="text-xs text-center py-1 px-3 rounded-full mb-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300">
            {scanMsg}
          </p>
        )}

        {abierto && (
          <div className="bg-white dark:bg-gray-900 shadow-card rounded-card p-3 space-y-3">
            {grupos.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">{t.encasa_vacio}</p>
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
                            title={t.encasa_anadir_carrito}
                            className={`text-xs px-2 py-0.5 border-l border-blue-100 dark:border-blue-800 transition-colors ${yaEnCarrito ? 'bg-green-500 text-white' : 'bg-blue-50 dark:bg-blue-900/40 text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60'}`}
                          >
                            {yaEnCarrito ? '✓' : '🛒'}
                          </button>
                        )}
                        {/* quitar de en casa */}
                        <button
                          onClick={() => onRemove(item)}
                          title={t.encasa_quitar}
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
