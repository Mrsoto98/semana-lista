// src/pages/Lista.tsx
import { useState, useMemo, useEffect } from 'react'
import { usePerfil } from '../hooks/usePerfil'
import { recuperar, guardar } from '../lib/storage'
import type { MenuSemanal } from '../types'

interface ProductoMercadona {
  id: string; nombre: string; precio: number; tamaño: number; unidad: string
}
type CatalogoMercadonaData = {
  actualizado: string
  codigo_postal?: string
  total_productos: number
  categorias: Record<string, ProductoMercadona[]>
}

const TODO_CAT = 'Todo'

export default function Lista() {
  const { perfil } = usePerfil()

  // Catálogo Mercadona — carga lazy
  const [MERCADONA, setMERCADONA] = useState<CatalogoMercadonaData | null>(null)
  useEffect(() => {
    import('../data/mercadona.json').then(m => setMERCADONA(m.default as CatalogoMercadonaData))
  }, [])
  const CATEGORIAS_MERCADONA = useMemo(() => MERCADONA ? Object.keys(MERCADONA.categorias) : [], [MERCADONA])
  const TODOS_LOS_PRODUCTOS = useMemo<ProductoMercadona[]>(() => MERCADONA ? Object.values(MERCADONA.categorias).flat() : [], [MERCADONA])

  // Estado principal
  const [comprar, setComprar] = useState<Set<string>>(() => new Set(recuperar<string[]>('lista_comprar_v3') ?? []))
  const [enCasa, setEnCasa] = useState<Set<string>>(() => new Set([...(perfil?.nevera ?? []), ...(recuperar<string[]>('lista_nevera') ?? [])]))
  const [precios, setPrecios] = useState<Record<string, number>>(() => recuperar<Record<string, number>>('lista_precios') ?? {})
  const [customItems, setCustomItems] = useState<string[]>(() => recuperar<string[]>('lista_custom_items_v2') ?? [])
  const [comprado, setComprado] = useState<Set<string>>(() => new Set(recuperar<string[]>('lista_comprado') ?? []))

  // Catálogo Mercadona UI
  const [catActiva, setCatActiva] = useState<string>(TODO_CAT)
  const [busqueda, setBusqueda] = useState('')

  // Añadir personalizado
  const [inputCustom, setInputCustom] = useState('')
  const [precioInputCustom, setPrecioInputCustom] = useState('')

  // Edición de precio inline
  const [editandoPrecio, setEditandoPrecio] = useState<string | null>(null)
  const [precioEdit, setPrecioEdit] = useState('')

  // ── Persistencia ──────────────────────────────────────────────────────────
  function saveComprar(next: Set<string>) { setComprar(next); guardar('lista_comprar_v3', Array.from(next)) }
  function saveCasa(next: Set<string>) { setEnCasa(next); guardar('lista_nevera', Array.from(next)) }
  function savePrecios(next: Record<string, number>) { setPrecios(next); guardar('lista_precios', next) }
  function saveCustom(next: string[]) { setCustomItems(next); guardar('lista_custom_items_v2', next) }
  function saveComprado(next: Set<string>) { setComprado(next); guardar('lista_comprado', Array.from(next)) }

  // ── Acciones ──────────────────────────────────────────────────────────────
  function addToComprar(nombre: string, precio?: number) {
    const c = new Set(comprar); c.add(nombre)
    const n = new Set(enCasa); n.delete(nombre)
    saveComprar(c); saveCasa(n)
    if (precio && precio > 0) savePrecios({ ...precios, [nombre]: precio })
  }
  function addToCasa(nombre: string) {
    const n = new Set(enCasa); n.add(nombre)
    const c = new Set(comprar); c.delete(nombre)
    const cp = new Set(comprado); cp.delete(nombre)
    saveCasa(n); saveComprar(c); saveComprado(cp)
  }
  function removeComprar(nombre: string) { const c = new Set(comprar); c.delete(nombre); saveComprar(c) }
  function removeCasa(nombre: string) { const n = new Set(enCasa); n.delete(nombre); saveCasa(n) }

  function guardarPrecio(nombre: string) {
    const val = parseFloat(precioEdit)
    if (!isNaN(val) && val >= 0) savePrecios({ ...precios, [nombre]: val })
    setEditandoPrecio(null)
  }

  function addCustom() {
    const nombre = inputCustom.trim(); if (!nombre) return
    const precio = parseFloat(precioInputCustom)
    if (!customItems.includes(nombre)) saveCustom([...customItems, nombre])
    addToComprar(nombre, isNaN(precio) ? undefined : precio)
    setInputCustom(''); setPrecioInputCustom('')
  }

  // ── Del menú esta semana ──────────────────────────────────────────────────
  const ingredientesMenu = useMemo(() => {
    const menu = recuperar<MenuSemanal>('menu_semana')
    if (!menu) return []
    const set = new Set<string>()
    for (const receta of Object.values(menu)) {
      if (!receta) continue
      for (const ing of receta.ingredientes)
        set.add(ing.nombre.charAt(0).toUpperCase() + ing.nombre.slice(1).toLowerCase())
    }
    return Array.from(set).sort()
  }, [])

  // ── Productos visibles: categoría activa filtrada por búsqueda ───────────
  const productosVisibles = useMemo(() => {
    if (!MERCADONA) return []
    const base = catActiva === TODO_CAT ? TODOS_LOS_PRODUCTOS : (MERCADONA.categorias[catActiva] ?? [])
    if (!busqueda || busqueda.length < 2) return base
    const q = busqueda.toLowerCase()
    const palabras = q.split(/\s+/).filter(Boolean)
    return base.filter(p => {
      const n = p.nombre.toLowerCase()
      return palabras.every((w: string) => n.includes(w))
    })
  }, [catActiva, busqueda, MERCADONA, TODOS_LOS_PRODUCTOS])

  // ── Lista de compra ───────────────────────────────────────────────────────
  const comprarArray = Array.from(comprar).sort()
  const totalEstimado = comprarArray.filter(item => !comprado.has(item)).reduce((s, item) => s + (precios[item] ?? 0), 0)
  const presupuesto = perfil?.presupuesto ?? 0
  const sobrepresupuesto = presupuesto > 0 && totalEstimado > presupuesto

  // Todos los productos conocidos (Mercadona + custom) para mostrar precio sugerido
  function precioSugerido(nombre: string): number | undefined {
    if (!MERCADONA) return undefined
    for (const prods of Object.values(MERCADONA.categorias)) {
      const p = prods.find(p => p.nombre === nombre)
      if (p) return p.precio
    }
    return undefined
  }

  function buscarEnMercadona(nombre: string): { nombre: string; precio: number } | undefined {
    if (!MERCADONA) return undefined
    const palabras = nombre.toLowerCase().split(/\s+/).filter(Boolean)
    let mejorProducto: ProductoMercadona | undefined
    let mejorScore = 0
    for (const prods of Object.values(MERCADONA.categorias)) {
      for (const prod of prods) {
        const n = prod.nombre.toLowerCase()
        const score = palabras.filter(w => n.includes(w)).length
        if (score > mejorScore) {
          mejorScore = score
          mejorProducto = prod
        }
      }
    }
    return mejorScore >= 1 ? mejorProducto : undefined
  }

  const sinCatalogo = MERCADONA !== null && CATEGORIAS_MERCADONA.length === 0

  return (
    <div className="min-h-screen max-w-lg mx-auto pb-24">

      {/* ── LISTA DE COMPRA sticky ────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-4 pb-3">
          {/* Cabecera */}
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-bold">🛒 Lista de la compra</h1>
            <div className="text-right">
              <span className={`font-bold ${sobrepresupuesto ? 'text-red-500' : 'text-green-600'}`}>
                {totalEstimado.toFixed(2)} €
              </span>
              {presupuesto > 0 && <span className="text-xs text-gray-400 block">de {presupuesto} €</span>}
            </div>
          </div>

          {sobrepresupuesto && (
            <p className="text-xs text-red-500 mb-2">⚠️ Superas el presupuesto en {(totalEstimado - presupuesto).toFixed(2)} €</p>
          )}

          {/* Items a comprar */}
          {comprarArray.length === 0
            ? <p className="text-sm text-gray-400 italic mb-2">Añade productos desde Mercadona o escribe uno abajo</p>
            : (
              <>
                <div className="max-h-48 overflow-y-auto space-y-1 mb-2">
                  {comprarArray.map(item => (
                    <div key={item} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${comprado.has(item) ? 'bg-gray-50 dark:bg-gray-900' : 'bg-green-50 dark:bg-green-950'}`}>
                      <input
                        type="checkbox"
                        checked={comprado.has(item)}
                        onChange={() => {
                          const cp = new Set(comprado)
                          if (cp.has(item)) cp.delete(item); else cp.add(item)
                          saveComprado(cp)
                        }}
                        className="shrink-0 accent-green-500"
                      />
                      <span className={`flex-1 text-sm truncate ${comprado.has(item) ? 'line-through text-gray-400' : 'text-green-800 dark:text-green-200'}`}>{item}</span>

                      {/* Precio editable */}
                      {editandoPrecio === item ? (
                        <form onSubmit={e => { e.preventDefault(); guardarPrecio(item) }} className="flex gap-1 items-center shrink-0">
                          <input autoFocus type="number" step="0.01" min="0" value={precioEdit}
                            onChange={e => setPrecioEdit(e.target.value)}
                            className="w-20 text-xs border rounded px-2 py-0.5 dark:bg-gray-800" placeholder="0.00" />
                          <button type="submit" className="text-xs text-green-600 font-bold">✓</button>
                          <button type="button" onClick={() => setEditandoPrecio(null)} className="text-xs text-gray-400">✕</button>
                        </form>
                      ) : (
                        <button
                          onClick={() => {
                            setEditandoPrecio(item)
                            setPrecioEdit(precios[item]?.toString() ?? precioSugerido(item)?.toString() ?? '')
                          }}
                          className="text-xs text-gray-400 hover:text-green-600 shrink-0 min-w-[52px] text-right">
                          {precios[item] ? `${precios[item].toFixed(2)} €` : <span className="text-gray-300">+ precio</span>}
                        </button>
                      )}

                      <button onClick={() => addToCasa(item)} title="Tengo esto en casa" className="text-base shrink-0">🏠</button>
                      <button onClick={() => removeComprar(item)} className="text-gray-400 hover:text-red-500 shrink-0">✕</button>
                    </div>
                  ))}
                </div>
                {comprado.size > 0 && (
                  <button
                    onClick={() => {
                      const cp = new Set(comprado)
                      const c = new Set(comprar)
                      cp.forEach(item => c.delete(item))
                      cp.clear()
                      saveComprar(c)
                      saveComprado(cp)
                    }}
                    className="w-full text-xs text-red-500 hover:text-red-700 py-1 mt-1 border border-red-200 rounded-lg"
                  >
                    Limpiar comprados ({comprado.size})
                  </button>
                )}
              </>
            )
          }

          {/* Añadir personalizado */}
          <div className="flex gap-1.5 mt-2">
            <input type="text" value={inputCustom} onChange={e => setInputCustom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="Producto personalizado..."
              className="flex-1 min-w-0 text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="number" step="0.01" min="0" value={precioInputCustom}
              onChange={e => setPrecioInputCustom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="€"
              className="w-16 text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500" />
            <button onClick={addCustom} className="text-sm bg-green-500 text-white px-3 py-1.5 rounded-lg shrink-0">+</button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">

        {/* ── EN CASA TENEMOS ───────────────────────────────────────────────── */}
        {enCasa.size > 0 && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-2">🏠 En casa tenemos</h2>
            <div className="bg-blue-50 dark:bg-blue-950 rounded-xl p-3 flex flex-wrap gap-2">
              {Array.from(enCasa).sort().map(item => (
                <button key={item} onClick={() => removeCasa(item)}
                  className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm px-3 py-1 rounded-full">
                  {item} <span className="text-blue-400 text-xs">✕</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── DEL MENÚ ESTA SEMANA ──────────────────────────────────────────── */}
        {ingredientesMenu.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400 mb-2">📋 Del menú esta semana</h2>
            <div className="bg-orange-50 dark:bg-orange-950 rounded-xl p-3 flex flex-wrap gap-1.5">
              {ingredientesMenu.map(item => {
                const enC = comprar.has(item); const enN = enCasa.has(item)
                return (
                  <div key={item} className="flex rounded-full overflow-hidden border border-orange-200 dark:border-orange-800">
                    <button onClick={() => enC ? removeComprar(item) : addToComprar(item, buscarEnMercadona(item)?.precio)}
                      className={`text-xs px-2.5 py-1 ${enC ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-100' : 'bg-white dark:bg-gray-900 text-orange-700 dark:text-orange-300'}`}>
                      {enC ? '✓' : '🛒'} {item}
                    </button>
                    <button onClick={() => enN ? removeCasa(item) : addToCasa(item)}
                      className={`text-xs px-2 py-1 border-l border-orange-200 dark:border-orange-800 ${enN ? 'bg-blue-200 dark:bg-blue-800' : 'bg-white dark:bg-gray-900 text-gray-400'}`}>
                      {enN ? '✓' : '🏠'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── CATÁLOGO MERCADONA ────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">🔴 Mercadona</h2>
            {MERCADONA?.actualizado && (
              <span className="text-xs text-gray-400">
                {new Date(MERCADONA.actualizado).toLocaleDateString('es-ES')} · {MERCADONA.total_productos} productos
              </span>
            )}
          </div>

          {MERCADONA === null ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
              <span className="animate-spin inline-block">⏳</span> Cargando catálogo...
            </div>
          ) : sinCatalogo ? (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center">
              <p className="text-gray-500 text-sm mb-3">El catálogo de Mercadona aún no se ha generado.</p>
              <code className="block bg-gray-800 text-green-400 text-xs rounded-lg px-4 py-2 text-left select-all">
                node scripts/scrape-mercadona.mjs
              </code>
              <p className="text-xs text-gray-400 mt-3">Ejecuta este comando en la carpeta del proyecto y luego vuelve a hacer build.</p>
            </div>
          ) : (
            <>
              {/* Buscador único */}
              <input
                type="text"
                placeholder={`🔍 Buscar${catActiva === TODO_CAT ? ' en Mercadona' : ` en ${catActiva}`}...`}
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2 text-sm mb-3 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
              />

              {/* Pills de categorías — Todo primero */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {[TODO_CAT, ...CATEGORIAS_MERCADONA].map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setCatActiva(cat); setBusqueda('') }}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                      catActiva === cat
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-red-400 hover:text-red-500'
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Lista de productos — key fuerza remount al cambiar categoría */}
              <ListaProductos
                key={catActiva}
                productos={productosVisibles}
                comprar={comprar} enCasa={enCasa} precios={precios}
                onAddComprar={addToComprar} onAddCasa={addToCasa}
                onRemoveComprar={removeComprar} onRemoveCasa={removeCasa}
                vacio={busqueda.length >= 2 ? `Sin resultados para "${busqueda}"` : 'Sin productos'}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const PAGINA = 60

// ── Subcomponente: lista de productos ────────────────────────────────────────
function ListaProductos({ productos, comprar, enCasa, precios, onAddComprar, onAddCasa, onRemoveComprar, onRemoveCasa, vacio }: {
  productos: { id: string; nombre: string; precio: number; tamaño: number; unidad: string }[]
  comprar: Set<string>; enCasa: Set<string>; precios: Record<string, number>
  onAddComprar: (nombre: string, precio: number) => void
  onAddCasa: (nombre: string) => void
  onRemoveComprar: (nombre: string) => void
  onRemoveCasa: (nombre: string) => void
  vacio: string
}) {
  const [limite, setLimite] = useState(PAGINA)
  const visibles = productos.slice(0, limite)

  if (productos.length === 0) return <p className="text-sm text-gray-400 text-center py-4">{vacio}</p>

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {visibles.map(prod => {
          const enC = comprar.has(prod.nombre); const enN = enCasa.has(prod.nombre)
          return (
            <div key={prod.id} className="flex items-center gap-2 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${enC || enN ? 'text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>{prod.nombre}</p>
                <p className="text-xs text-gray-400">{prod.tamaño > 0 ? `${prod.tamaño} ${prod.unidad}` : prod.unidad}</p>
              </div>
              <span className="text-sm font-semibold text-red-600 shrink-0">{(precios[prod.nombre] ?? prod.precio).toFixed(2)} €</span>
              {enN && <span className="text-xs text-blue-500 shrink-0">casa</span>}
              {enC && <span className="text-xs text-green-500 shrink-0">lista</span>}
              <button onClick={() => enC ? onRemoveComprar(prod.nombre) : onAddComprar(prod.nombre, prod.precio)}
                className={`text-xs px-2.5 py-1 rounded-full border shrink-0 transition-colors ${enC ? 'bg-green-100 border-green-400 text-green-700' : 'border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600'}`}>
                {enC ? '✓' : '🛒'}
              </button>
              <button onClick={() => enN ? onRemoveCasa(prod.nombre) : onAddCasa(prod.nombre)}
                className={`text-xs px-2.5 py-1 rounded-full border shrink-0 transition-colors ${enN ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600'}`}>
                {enN ? '✓' : '🏠'}
              </button>
            </div>
          )
        })}
      </div>
      {limite < productos.length && (
        <button onClick={() => setLimite(l => l + PAGINA)}
          className="w-full mt-2 py-2 text-sm text-gray-500 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900">
          Ver más ({productos.length - limite} restantes)
        </button>
      )}
    </>
  )
}
