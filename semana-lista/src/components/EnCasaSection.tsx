import React, { useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { expandirCatalogo } from '../lib/matchMercadona'
import { useI18n } from '../hooks/useI18n'
import { supabase } from '../lib/supabase'
import { NeveraSearch } from './ui/NeveraSearch'

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

interface ResultadoScan {
  confirmados: string[]   // nombres ya matcheados al catálogo
  dudosos: { texto: string; seleccionados: string[] }[]  // texto del ticket + lo que el usuario elige
}

export function EnCasaSection({ enCasa, catalogo, onRemove, onAddToCart, enCarrito, onAddItems }: Props) {
  const { t } = useI18n()
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoScan | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
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

  // Match por nombre + precio opcional como desempate
  function matchCatalogo(nombre: string, precio?: number): string {
    const q = nombre.toLowerCase().trim()

    // 1. Coincidencia exacta de nombre
    const exacto = catalogoNombres.find(n => n.toLowerCase() === q)
    if (exacto) return exacto

    // 2. Candidatos que contienen el término
    const candidatos = catalogoNombres.filter(n => n.toLowerCase().includes(q))
    if (candidatos.length === 1) return candidatos[0]
    if (candidatos.length > 1 && precio) {
      // Usar precio para desempatar: elegir el que tenga precio más cercano
      const catalogoExpandidoLocal = catalogoExpandido
      if (catalogoExpandidoLocal) {
        let mejorNombre = candidatos[0]
        let mejorDiff = Infinity
        for (const n of candidatos) {
          for (const prods of Object.values(catalogoExpandidoLocal)) {
            const p = prods.find(p => p.nombre === n)
            if (p?.precio) {
              const diff = Math.abs(p.precio - precio)
              if (diff < mejorDiff) { mejorDiff = diff; mejorNombre = n }
            }
          }
        }
        return mejorNombre
      }
      return candidatos[0]
    }
    if (candidatos.length > 1) return candidatos[0]

    // 3. Palabras clave con precio como desempate
    const palabras = q.split(/\s+/).filter(p => p.length > 3)
    let mejorMatch = ''
    let mejorScore = 0
    let mejorPrecioDiff = Infinity
    for (const n of catalogoNombres) {
      const nl = n.toLowerCase()
      const score = palabras.filter(p => nl.includes(p)).length
      if (score > mejorScore || (score === mejorScore && precio)) {
        if (score > mejorScore) {
          mejorScore = score; mejorMatch = n; mejorPrecioDiff = Infinity
        }
        if (precio && catalogoExpandido) {
          for (const prods of Object.values(catalogoExpandido)) {
            const prod = prods.find(p => p.nombre === n)
            if (prod?.precio) {
              const diff = Math.abs(prod.precio - precio)
              if (score === mejorScore && diff < mejorPrecioDiff) {
                mejorPrecioDiff = diff; mejorMatch = n
              }
            }
          }
        }
      }
    }
    if (mejorScore > 0) return mejorMatch
    return q
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setEscaneando(true)
    setScanError(null)
    setResultado(null)

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
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

      const confirmadosRaw: { nombre: string; precio?: number }[] = res.data?.confirmados ?? []
      const dudososRaw: string[] = res.data?.dudosos ?? []

      // Match confirmados al catálogo usando nombre + precio
      const confirmados = [...new Set(confirmadosRaw.map(p => matchCatalogo(p.nombre, p.precio)))].filter(n => !enCasa.has(n))
      // Dudosos: el usuario tiene que elegir
      const dudosos = dudososRaw.map(texto => ({ texto, seleccionados: [] as string[] }))

      if (confirmados.length === 0 && dudosos.length === 0) {
        setScanError(t.encasa_scan_vacio)
      } else {
        setResultado({ confirmados, dudosos })
        if (!abierto) setAbierto(true)
      }
    } catch (err) {
      console.error('Scan error:', err)
      setScanError(t.encasa_scan_error)
    } finally {
      setEscaneando(false)
      if (scanError) setTimeout(() => setScanError(null), 4000)
    }
  }

  function confirmarResultado() {
    if (!resultado) return
    const dudososElegidos = resultado.dudosos.flatMap(d => d.seleccionados)
    const todos = [...resultado.confirmados, ...dudososElegidos].filter(n => !enCasa.has(n))
    if (todos.length > 0) onAddItems?.(todos)
    setResultado(null)
  }

  return (
    <>
      <div data-tutorial="en-casa">
        {/* Cabecera: título | botón escanear | flecha */}
        <div className="flex items-center gap-2 mb-2">
          <button
            data-tutorial="en-casa-btn"
            onClick={() => setAbierto(v => !v)}
            className="flex-1 text-left py-1"
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t.encasa_titulo}</h2>
          </button>

          {/* Botón escanear — a la izquierda de la flecha */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={escaneando}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 shrink-0"
          >
            {escaneando
              ? <span className="animate-spin inline-block">⟳</span>
              : <span>📷</span>
            }
            <span>{escaneando ? t.encasa_escaneando : t.encasa_escanear}</span>
          </button>

          {/* Flecha desplegable — siempre al final */}
          <button
            onClick={() => setAbierto(v => !v)}
            className={`w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm transition-transform duration-200 shrink-0 ${abierto ? 'rotate-0' : '-rotate-90'}`}
          >▾</button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScan} />

        {scanError && (
          <p className="text-xs text-center py-1 px-3 rounded-full mb-2 bg-red-50 dark:bg-red-900/20 text-red-500">
            {scanError}
          </p>
        )}

        {/* Panel de revisión del ticket */}
        {resultado && (
          <div className="mb-3 bg-white dark:bg-gray-900 border border-blue-100 dark:border-blue-800 rounded-card p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Resultado del ticket</p>

            {/* Confirmados */}
            {resultado.confirmados.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 mb-1.5">✓ Reconocidos ({resultado.confirmados.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {resultado.confirmados.map((nombre, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setResultado(r => r ? {
                        ...r,
                        confirmados: r.confirmados.filter((_, j) => j !== i)
                      } : r)}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700"
                    >
                      {nombre} <span className="text-green-400 hover:text-red-400">✕</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dudosos */}
            {resultado.dudosos.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-orange-500 dark:text-orange-400 mb-1">? No reconocidos — elige el producto:</p>
                {resultado.dudosos.map((d, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-[10px] text-gray-400 font-mono bg-gray-50 dark:bg-gray-800 rounded px-2 py-0.5 inline-block">«{d.texto}»</p>
                    <NeveraSearch
                      items={d.seleccionados}
                      onChange={sel => setResultado(r => {
                        if (!r) return r
                        const dudosos = [...r.dudosos]
                        dudosos[i] = { ...dudosos[i], seleccionados: sel }
                        return { ...r, dudosos }
                      })}
                      placeholder="Buscar en catálogo..."
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={confirmarResultado}
                className="flex-1 bg-green-select text-white text-xs font-semibold py-2 rounded-xl"
              >
                Añadir a En Casa
              </button>
              <button
                onClick={() => setResultado(null)}
                className="px-3 py-2 text-xs text-gray-400 hover:text-gray-600 rounded-xl border border-gray-200 dark:border-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
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
                        <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium pl-0.5 pr-2 py-0.5">
                          {foto ? (
                            <img src={foto} alt="" loading="lazy"
                              className="w-6 h-6 rounded-full object-cover shrink-0 bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 cursor-zoom-in"
                              onError={e => { e.currentTarget.style.display = 'none' }}
                              onClick={() => setFotoAmpliada(foto)}
                            />
                          ) : (
                            <span className="w-6 h-6 rounded-full shrink-0 bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-[10px]">🏠</span>
                          )}
                          <span className="leading-tight">{item}</span>
                        </div>
                        {onAddToCart && (
                          <button onClick={() => onAddToCart(item)} title={t.encasa_anadir_carrito}
                            className={`text-xs px-2 py-0.5 border-l border-blue-100 dark:border-blue-800 transition-colors ${yaEnCarrito ? 'bg-green-500 text-white' : 'bg-blue-50 dark:bg-blue-900/40 text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60'}`}
                          >{yaEnCarrito ? '✓' : '🛒'}</button>
                        )}
                        <button onClick={() => onRemove(item)} title={t.encasa_quitar}
                          className="text-xs px-2 py-0.5 border-l border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/40 text-blue-300 dark:text-blue-600 hover:bg-red-50 hover:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                        >✕</button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setFotoAmpliada(null)}>
          <img src={fotoAmpliada} alt="" className="max-w-[80vw] max-h-[80vh] rounded-2xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>,
        document.body
      )}
    </>
  )
}
