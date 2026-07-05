// src/pages/Lista.tsx
import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { usePerfil } from '../hooks/usePerfil'
import { useListasCompartidas } from '../hooks/useListaCompartida'
import { recuperar, guardar } from '../lib/storage'
import {
  topMatchesMercadona, topMatchConConfianza, agruparIngredientes, resolverContraSet, etiquetaGrupo,
  nombreGuardadoComo as nombreGuardadoComoLib, expandirCatalogo, type MatchProducto,
} from '../lib/matchMercadona'
import { PickerProductoMercadona } from '../components/PickerProductoMercadona'
import { fetchLearnedOptions, fetchAllLearnedAssocs, saveLearnedOption, mergePickerOptions } from '../lib/pickerLearning'
import { EnCasaSection } from '../components/EnCasaSection'
import type { MenuSemanal } from '../types'
import { useI18n } from '../hooks/useI18n'

interface ProductoMercadona {
  id: string; nombre: string; precio: number; tamaño: number; unidad: string; foto?: string | null; precio_kg?: number | null
}
type CatalogoMercadonaData = {
  actualizado: string
  codigo_postal?: string
  total_productos: number
  categorias: Record<string, ProductoMercadona[]>
}

const TODO_CAT = 'Todo'
const PASO_KG = 0.5
const DEFECTO_KG = 1

const CAT_EMOJI: Record<string, string> = {
  'Aceite, especias y salsas':      '🫒',
  'Aceites y vinagres':             '🫒',
  'Especias, salsas y aderezos':   '🧂',
  'Agua y refrescos':               '💧',
  'Aperitivos':                     '🍿',
  'Arroz, legumbres y pasta':       '🍝',
  'Azúcar, caramelos y chocolate':  '🍫',
  'Bebé':                           '👶',
  'Bodega':                         '🍷',
  'Cacao, café e infusiones':       '☕',
  'Carne':                          '🥩',
  'Cereales y galletas':            '🥣',
  'Charcutería y quesos':           '🧀',
  'Congelados':                     '🧊',
  'Conservas, caldos y cremas':     '🥫',
  'Cuidado del cabello':            '💇',
  'Cuidado facial y corporal':      '🧴',
  'Fitoterapia y parafarmacia':     '💊',
  'Fruta y verdura':                '🥦',
  'Huevos, leche y mantequilla':    '🥛',
  'Limpieza y hogar':               '🧹',
  'Maquillaje':                     '💄',
  'Marisco y pescado':              '🐟',
  'Mascotas':                       '🐾',
  'Panadería y pastelería':         '🥖',
  'Pizzas y platos preparados':     '🍕',
  'Postres y yogures':              '🍮',
  'Zumos':                          '🍊',
}

function CategoriasSelector({ categorias, catActiva, onSelect }: {
  categorias: string[]; catActiva: string; onSelect: (cat: string) => void
}) {
  const { t } = useI18n()
  const [abierto, setAbierto] = useState(false)
  const esActiva = catActiva !== TODO_CAT
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => { onSelect(TODO_CAT); setAbierto(false) }}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            !esActiva ? 'bg-green-select text-white shadow-sm' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
          }`}
        >{t.lista_todo}</button>
        <button
          onClick={() => setAbierto(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1 ${
            esActiva ? 'bg-green-select text-white shadow-sm' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
          }`}
        >
          {esActiva ? `${CAT_EMOJI[catActiva] ?? ''} ${catActiva}` : t.lista_categorias}
          <span className={`transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}>▾</span>
        </button>
      </div>
      {abierto && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => { onSelect(cat); setAbierto(false) }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                catActiva === cat
                  ? 'bg-green-select text-white shadow-sm'
                  : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-green-select hover:text-green-select'
              }`}
            >
              {CAT_EMOJI[cat] ?? ''} {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AnadirProducto({ inputCustom, setInputCustom, precioInputCustom, setPrecioInputCustom, onAdd }: {
  inputCustom: string; setInputCustom: (v: string) => void
  precioInputCustom: string; setPrecioInputCustom: (v: string) => void
  onAdd: () => void
}) {
  const { t } = useI18n()
  const [abierto, setAbierto] = useState(false)
  return abierto ? (
    <div className="flex gap-2 mt-3">
      <input
        autoFocus
        type="text" value={inputCustom} onChange={e => setInputCustom(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onAdd()}
        placeholder={t.lista_nombre_producto}
        className="flex-1 min-w-0 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-select"
      />
      <input
        type="number" step="0.01" min="0" value={precioInputCustom}
        onChange={e => setPrecioInputCustom(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onAdd()}
        placeholder="€"
        className="w-16 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-select"
      />
      <button onClick={onAdd} className="text-sm bg-green-select text-white px-3 py-2 rounded-xl font-semibold shrink-0 hover:bg-green-700 transition-colors">+</button>
      <button onClick={() => setAbierto(false)} className="text-sm text-gray-400 px-2 py-2 rounded-xl hover:text-gray-600 transition-colors">✕</button>
    </div>
  ) : (
    <button
      onClick={() => setAbierto(true)}
      className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 hover:text-green-select transition-colors py-1"
    >
      <span className="text-base leading-none">+</span> {t.lista_producto_personalizado}
    </button>
  )
}

export default function Lista() {
  const { t } = useI18n()
  const { perfil, guardarPerfil } = usePerfil()
  const navigate = useNavigate()
  const { listas, crearLista, unirseConCodigo } = useListasCompartidas()
  const [modalCompartida, setModalCompartida] = useState(false)
  const [abiertoMenu, setAbiertoMenu] = useState(false)
  const [modoModal, setModoModal] = useState<'elegir' | 'crear' | 'unirse'>('elegir')
  const [pickerIngrediente, setPickerIngrediente] = useState<{ nombre: string; enCasa: boolean } | null>(null)
  const [pickerOpciones, setPickerOpciones] = useState<MatchProducto[]>([])
  const savedScrollY = useRef<number>(0)
  const [learnedAssocs, setLearnedAssocs] = useState<Map<string, Set<string>>>(new Map())
  const [nombreNueva, setNombreNueva] = useState('')
  const [codigoUnirse, setCodigoUnirse] = useState('')
  const [errorCompartida, setErrorCompartida] = useState('')
  const [cargandoCompartida, setCargandoCompartida] = useState(false)

  // Catálogo Mercadona — carga lazy
  const [MERCADONA, setMERCADONA] = useState<CatalogoMercadonaData | null>(null)
  useEffect(() => {
    import('../data/mercadona.json').then(m => {
      const raw = m.default as CatalogoMercadonaData
      setMERCADONA({ ...raw, categorias: expandirCatalogo(raw.categorias) as typeof raw.categorias })
    })
  }, [])
  const CATEGORIAS_MERCADONA = useMemo(() => MERCADONA ? Object.keys(MERCADONA.categorias) : [], [MERCADONA])
  const TODOS_LOS_PRODUCTOS = useMemo<ProductoMercadona[]>(() => {
    if (!MERCADONA) return []
    const seen = new Set<string>()
    return Object.values(MERCADONA.categorias).flat().filter(p => {
      if (seen.has(p.id)) return false
      seen.add(p.id); return true
    })
  }, [MERCADONA])

  // Estado principal
  const [comprar, setComprar] = useState<Set<string>>(() => new Set(recuperar<string[]>('lista_comprar_v3') ?? []))
  const [cantidades, setCantidades] = useState<Record<string, number>>(() => recuperar<Record<string, number>>('lista_cantidades') ?? {})
  const [unidades, setUnidades] = useState<Record<string, string>>(() => recuperar<Record<string, string>>('lista_unidades') ?? {})
  const [enCasa, setEnCasa] = useState<Set<string>>(() => new Set(recuperar<string[]>('lista_nevera') ?? []))

  // Sincronizar enCasa desde el perfil cuando carga (fuente de verdad: DB)
  useEffect(() => {
    if (perfil?.nevera) {
      const merged = new Set([...perfil.nevera, ...(recuperar<string[]>('lista_nevera') ?? [])])
      setEnCasa(merged)
      guardar('lista_nevera', Array.from(merged))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(perfil?.nevera)])
  const [precios, setPrecios] = useState<Record<string, number>>(() => recuperar<Record<string, number>>('lista_precios') ?? {})
  const [customItems, setCustomItems] = useState<string[]>(() => recuperar<string[]>('lista_custom_items_v2') ?? [])
  const [comprado, setComprado] = useState<Set<string>>(() => new Set(recuperar<string[]>('lista_comprado') ?? []))

  // Catálogo Mercadona UI
  const [catActiva, setCatActiva] = useState<string>(TODO_CAT)
  const [busqueda, setBusqueda] = useState('')

  // Añadir personalizado
  const [inputCustom, setInputCustom] = useState('')
  const [precioInputCustom, setPrecioInputCustom] = useState('')

  // Foto ampliada (sección del menú)
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)

  // Edición de precio inline
  const [editandoPrecio, setEditandoPrecio] = useState<string | null>(null)
  const [precioEdit, setPrecioEdit] = useState('')

  // Presupuesto
  const [editandoPresupuesto, setEditandoPresupuesto] = useState(false)
  const [presupuestoDraft, setPresupuestoDraft] = useState('')

  // Lista colapsable
  const [listaColapsada, setListaColapsada] = useState(false)

  // Divisor arrastrable del menú (% columna izquierda, 30-80)
  const [menuSplitRatio, setMenuSplitRatio] = useState<number>(() => recuperar<number>('menu_split_ratio') ?? 60)
  const menuContainerRef = useRef<HTMLDivElement>(null)

  function onDividerPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startRatio = menuSplitRatio
    const containerW = menuContainerRef.current?.getBoundingClientRect().width ?? 400
    let lastRatio = startRatio
    function onMove(ev: PointerEvent) {
      lastRatio = Math.min(80, Math.max(25, startRatio + ((ev.clientX - startX) / containerW) * 100))
      setMenuSplitRatio(lastRatio)
    }
    function onUp() {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      guardar('menu_split_ratio', lastRatio)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  // ── Persistencia ──────────────────────────────────────────────────────────
  function saveComprar(next: Set<string>) { setComprar(next); guardar('lista_comprar_v3', Array.from(next)) }
  function saveCantidades(next: Record<string, number>) { setCantidades(next); guardar('lista_cantidades', next) }
  function saveUnidades(next: Record<string, string>) { setUnidades(next); guardar('lista_unidades', next) }
  function saveCasa(next: Set<string>) {
    setEnCasa(next)
    const arr = Array.from(next)
    guardar('lista_nevera', arr)
    if (perfil) guardarPerfil({ ...perfil, nevera: arr })
  }
  function savePrecios(next: Record<string, number>) { setPrecios(next); guardar('lista_precios', next) }
  function saveCustom(next: string[]) { setCustomItems(next); guardar('lista_custom_items_v2', next) }
  function saveComprado(next: Set<string>) { setComprado(next); guardar('lista_comprado', Array.from(next)) }

  // ── Acciones ──────────────────────────────────────────────────────────────
  function addToComprar(nombre: string, precio?: number, _unidad?: string, precioKg?: number) {
    const c = new Set(comprar); c.add(nombre)
    const n = new Set(enCasa); n.delete(nombre)
    saveComprar(c); saveCasa(n)
    if (precio && precio > 0) savePrecios({ ...precios, [nombre]: precio })
    // Guardar precio_kg para uso futuro si el usuario cambia a modo kg
    if (precioKg) saveUnidades({ ...unidades, [nombre]: JSON.stringify({ modo: 'ud', precioKg }) })
    // Siempre arrancar en modo ud
    saveCantidades({ ...cantidades, [nombre]: (cantidades[nombre] ?? 0) + 1 })
  }

  function toggleModoKg(nombre: string) {
    let info: { modo: string; precioKg: number } | null = null
    try { info = unidades[nombre] ? JSON.parse(unidades[nombre]) : null } catch { info = null }
    if (!info?.precioKg) return
    const nuevoModo = info.modo === 'ud' ? 'kg' : 'ud'
    saveUnidades({ ...unidades, [nombre]: JSON.stringify({ ...info, modo: nuevoModo }) })
    // Al cambiar de modo reiniciar cantidad
    if (nuevoModo === 'kg') {
      saveCantidades({ ...cantidades, [nombre]: DEFECTO_KG })
      savePrecios({ ...precios, [nombre]: info.precioKg })
    } else {
      saveCantidades({ ...cantidades, [nombre]: 1 })
      // Restaurar precio por unidad desde el catálogo no lo tenemos aquí, dejar que el usuario lo edite
    }
  }

  function getModoInfo(nombre: string): { modo: 'ud' | 'kg'; precioKg: number | null } {
    try {
      const raw = unidades[nombre]
      if (!raw) return { modo: 'ud', precioKg: null }
      const info = JSON.parse(raw)
      return { modo: info?.modo ?? 'ud', precioKg: info?.precioKg ?? null }
    } catch {
      return { modo: 'ud', precioKg: null }
    }
  }

  function incrementarCantidad(nombre: string) {
    const { modo } = getModoInfo(nombre)
    if (modo === 'kg') {
      saveCantidades({ ...cantidades, [nombre]: Math.round(((cantidades[nombre] ?? DEFECTO_KG) + PASO_KG) * 100) / 100 })
    } else {
      saveCantidades({ ...cantidades, [nombre]: (cantidades[nombre] ?? 1) + 1 })
    }
  }

  function decrementarCantidad(nombre: string) {
    const { modo } = getModoInfo(nombre)
    if (modo === 'kg') {
      const actual = cantidades[nombre] ?? DEFECTO_KG
      const next = Math.round((actual - PASO_KG) * 100) / 100
      if (next <= 0) removeComprar(nombre)
      else saveCantidades({ ...cantidades, [nombre]: next })
    } else {
      const actual = cantidades[nombre] ?? 1
      if (actual <= 1) removeComprar(nombre)
      else saveCantidades({ ...cantidades, [nombre]: actual - 1 })
    }
  }
  function addToCasa(nombre: string) {
    const n = new Set(enCasa); n.add(nombre)
    const c = new Set(comprar); c.delete(nombre)
    const cp = new Set(comprado); cp.delete(nombre)
    saveCasa(n); saveComprar(c); saveComprado(cp)
  }
  function removeComprar(nombre: string) {
    const c = new Set(comprar); c.delete(nombre); saveComprar(c)
    const q = { ...cantidades }; delete q[nombre]; saveCantidades(q)
    const u = { ...unidades }; delete u[nombre]; saveUnidades(u)
  }
  function removeCasa(nombre: string) { const n = new Set(enCasa); n.delete(nombre); saveCasa(n) }
  function addCasaToCart(nombre: string) {
    const c = new Set(comprar); c.add(nombre); saveComprar(c)
    saveCantidades({ ...cantidades, [nombre]: (cantidades[nombre] ?? 0) + 1 })
    // Intentar recuperar precio del catálogo
    if (MERCADONA?.categorias) {
      for (const prods of Object.values(MERCADONA.categorias)) {
        const p = prods.find(p => p.nombre === nombre)
        if (p?.precio) { savePrecios({ ...precios, [nombre]: p.precio }); break }
      }
    }
  }

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
  const [menuKey, setMenuKey] = useState(0)
  const ingredientesMenu = useMemo(() => {
    const menu = recuperar<MenuSemanal>('menu_semana')
    if (!menu) return []
    const set = new Set<string>()
    for (const receta of Object.values(menu)) {
      if (!receta) continue
      for (const ing of receta.ingredientes)
        if (ing.nombre) set.add(ing.nombre.charAt(0).toUpperCase() + ing.nombre.slice(1).toLowerCase())
    }
    return Array.from(set).sort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuKey])

  function vaciarMenu() {
    if (!confirm('¿Vaciar el menú de la semana de la lista?')) return
    localStorage.removeItem('semana-lista:menu_semana')
    setMenuKey(k => k + 1)
  }

  // Agrupa variantes del mismo ingrediente base (distintos grados/tipos que
  // pidieron distintas recetas) en un solo elemento con un solo botón.
  const gruposMenu = useMemo(() => agruparIngredientes(ingredientesMenu), [ingredientesMenu])

  const infoIngredienteMenu = useMemo(() => {
    const map = new Map<string, { foto: string | null; categoria: string }>()
    if (!MERCADONA?.categorias) return map
    const catMap = new Map<string, string>()
    for (const [cat, prods] of Object.entries(MERCADONA.categorias)) {
      for (const p of prods) { if (!catMap.has(p.nombre)) catMap.set(p.nombre, cat) }
    }
    for (const ing of ingredientesMenu) {
      if (map.has(ing)) continue
      const top = topMatchesMercadona(ing, MERCADONA.categorias, 1)
      const match = top[0]
      map.set(ing, { foto: match?.foto ?? null, categoria: catMap.get(match?.nombre ?? '') ?? 'Otros' })
    }
    return map
  }, [ingredientesMenu, MERCADONA])

  const gruposMenuPorCategoria = useMemo(() => {
    const g = new Map<string, typeof gruposMenu>()
    for (const grupo of gruposMenu) {
      const cat = grupo.items.map(i => infoIngredienteMenu.get(i)?.categoria).find(c => c && c !== 'Otros') ?? 'Otros'
      if (!g.has(cat)) g.set(cat, [])
      g.get(cat)!.push(grupo)
    }
    return Array.from(g.entries()).sort(([a], [b]) => {
      if (a === 'Otros') return 1; if (b === 'Otros') return -1
      return a.localeCompare(b, 'es')
    })
  }, [gruposMenu, infoIngredienteMenu])

  // Cargar asociaciones aprendidas para todos los ingredientes del menú
  useEffect(() => {
    if (!ingredientesMenu.length) return
    fetchAllLearnedAssocs(ingredientesMenu).then(setLearnedAssocs)
  }, [ingredientesMenu])

  // También recargar al confirmar picker (para que el tick aparezca al instante)
  const recargarLearnedAssocs = () => {
    if (ingredientesMenu.length) fetchAllLearnedAssocs(ingredientesMenu).then(setLearnedAssocs)
  }

  const menuEnCasa = useMemo(
    () => resolverContraSet(ingredientesMenu, enCasa, MERCADONA?.categorias, learnedAssocs),
    [ingredientesMenu, enCasa, MERCADONA, learnedAssocs],
  )
  const menuEnComprar = useMemo(
    () => resolverContraSet(ingredientesMenu, comprar, MERCADONA?.categorias, learnedAssocs),
    [ingredientesMenu, comprar, MERCADONA, learnedAssocs],
  )

  function nombreGuardadoComo(item: string, set: Set<string>): string {
    return nombreGuardadoComoLib(item, set, MERCADONA?.categorias)
  }

  // Quita de golpe todos los productos resueltos para un grupo de variantes
  // (ej. al desmarcar el botón fusionado "Aceite de oliva").
  function quitarGrupoDeComprar(items: string[]) {
    const nombresReales = items.map(item => nombreGuardadoComo(item, comprar))
    const c = new Set(comprar); nombresReales.forEach(n => c.delete(n))
    saveComprar(c)
    const q = { ...cantidades }; const u = { ...unidades }
    nombresReales.forEach(n => { delete q[n]; delete u[n] })
    saveCantidades(q); saveUnidades(u)
  }
  function quitarGrupoDeCasa(items: string[]) {
    const nombresReales = items.map(item => nombreGuardadoComo(item, enCasa))
    const n = new Set(enCasa); nombresReales.forEach(x => n.delete(x))
    saveCasa(n)
  }

  // ── Productos visibles: categoría activa filtrada por búsqueda ───────────
  const productosVisibles = useMemo(() => {
    if (!MERCADONA) return []
    const rawBase = catActiva === TODO_CAT ? TODOS_LOS_PRODUCTOS : (MERCADONA.categorias[catActiva] ?? [])
    // Dedup por id Y por nombre — productos con mismo nombre pero distinto id
    // generan selección múltiple confusa porque el carrito usa nombre como clave
    const seenId = new Set<string>()
    const seenNombre = new Set<string>()
    const base = rawBase.filter(p => {
      if (seenId.has(p.id)) return false
      seenId.add(p.id)
      if (seenNombre.has(p.nombre)) return false
      seenNombre.add(p.nombre)
      return true
    })
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

  // Lookup foto+categoría para items de la lista de compra
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const infoItem = useMemo(() => {
    const map = new Map<string, { foto: string | null; categoria: string }>()
    if (!MERCADONA?.categorias) return map
    const catMap = new Map<string, string>()
    for (const [cat, prods] of Object.entries(MERCADONA.categorias)) {
      for (const p of prods) { if (!catMap.has(p.nombre)) catMap.set(p.nombre, cat) }
    }
    for (const item of comprarArray) {
      if (map.has(item)) continue
      const top = topMatchesMercadona(item, MERCADONA.categorias, 1)
      map.set(item, { foto: top[0]?.foto ?? null, categoria: catMap.get(top[0]?.nombre ?? '') ?? 'Otros' })
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(comprarArray), MERCADONA])

  // Agrupa items de la lista por categoría Mercadona
  const comprarPorCategoria = useMemo(() => {
    const g = new Map<string, string[]>()
    for (const item of comprarArray) {
      const cat = infoItem.get(item)?.categoria ?? 'Otros'
      if (!g.has(cat)) g.set(cat, [])
      g.get(cat)!.push(item)
    }
    return Array.from(g.entries()).sort(([a], [b]) => {
      if (a === 'Otros') return 1; if (b === 'Otros') return -1
      return a.localeCompare(b, 'es')
    })
  }, [comprarArray, infoItem])


  const totalEstimado = comprarArray.filter(item => !comprado.has(item)).reduce((s, item) => {
    const { modo, precioKg } = getModoInfo(item)
    const precio = modo === 'kg' ? (precioKg ?? precios[item] ?? 0) : (precios[item] ?? 0)
    return s + precio * (cantidades[item] ?? 1)
  }, 0)
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

  const PRECIO_MAX_PICKER = 50

  async function abrirPickerMenu(nombreOGrupo: string | string[], enCasa: boolean) {
    savedScrollY.current = window.scrollY
    const nombres = Array.isArray(nombreOGrupo) ? nombreOGrupo : [nombreOGrupo]
    const etiqueta = nombres.length > 1 ? etiquetaGrupo(nombres) : nombres[0]

    // Mostrar el picker inmediatamente con opciones IA
    let opcionesAI: MatchProducto[] = []
    if (MERCADONA) {
      const vistos = new Set<string>()
      for (const nombre of nombres) {
        for (const op of topMatchesMercadona(nombre, MERCADONA.categorias, 6)) {
          const key = `${op.nombre}__${op.precio}`
          if (vistos.has(key)) continue
          vistos.add(key)
          opcionesAI.push(op)
        }
      }
      const filtradas = opcionesAI.filter(op => op.precio <= PRECIO_MAX_PICKER)
      if (filtradas.length > 0) opcionesAI = filtradas
    }
    setPickerOpciones(opcionesAI)
    setPickerIngrediente({ nombre: etiqueta, enCasa })

    // Enriquecer con opciones aprendidas por la comunidad (en segundo plano)
    fetchLearnedOptions(etiqueta).then(learned => {
      if (learned.length > 0) {
        setPickerOpciones(prev => mergePickerOptions(prev, learned, etiqueta))
      }
    })
  }

  function cerrarPicker() {
    setPickerIngrediente(null)
    // Restaurar posición de scroll: el unmount del modal mueve el foco al body
    // lo que hace que el browser haga scroll al inicio de la página.
    requestAnimationFrame(() => { window.scrollTo({ top: savedScrollY.current, behavior: 'instant' }) })
  }

  function confirmarPicker(producto: MatchProducto) {
    if (!pickerIngrediente) return
    if (pickerIngrediente.enCasa) {
      addToCasa(producto.nombre)
    } else {
      addToComprar(producto.nombre, producto.precio, undefined, producto.precio_kg ?? undefined)
    }
    // Guardar elección en el sistema de aprendizaje colectivo y recargar para que el tick aparezca
    saveLearnedOption(pickerIngrediente.nombre, producto).then(recargarLearnedAssocs)
    cerrarPicker()
  }

  const sinCatalogo = MERCADONA !== null && CATEGORIAS_MERCADONA.length === 0

  // Precio estimado de los ingredientes del menú (mejor match Mercadona)
  // Solo incluye los que NO están ya en casa
  const precioEstimadoMenu = useMemo(() => {
    if (!MERCADONA?.categorias || gruposMenu.length === 0) return 0
    let total = 0
    const PRECIO_MAX_INGREDIENTE = 18 // cap: ningún ingrediente individual supera este precio
    const CONFIANZA_MIN = 0.4         // solo incluir si el match cubre ≥40% de los tokens
    for (const { items } of gruposMenu) {
      const estaEnCasa = items.some(item => menuEnCasa.has(item))
      if (estaEnCasa) continue
      const res = topMatchConConfianza(items[0], MERCADONA.categorias)
      if (!res) continue
      if (res.coverage < CONFIANZA_MIN) continue   // match poco fiable → omitir
      if (res.match.precio > PRECIO_MAX_INGREDIENTE) continue  // precio anómalo → omitir
      total += res.match.precio
    }
    return Math.round(total * 100) / 100
  }, [gruposMenu, menuEnCasa, MERCADONA])

  async function handleCrearLista() {
    setCargandoCompartida(true)
    setErrorCompartida('')
    const { lista, error } = await crearLista(nombreNueva.trim() || 'Lista compartida')
    setCargandoCompartida(false)
    if (lista) { setModalCompartida(false); navigate(`/lista-compartida/${lista.id}`) }
    else setErrorCompartida(error ?? 'No se pudo crear la lista')
  }

  async function handleUnirse() {
    setCargandoCompartida(true)
    setErrorCompartida('')
    const res = await unirseConCodigo(codigoUnirse)
    setCargandoCompartida(false)
    if (res.ok && res.lista) { setModalCompartida(false); navigate(`/lista-compartida/${res.lista.id}`) }
    else setErrorCompartida(res.error ?? 'Error desconocido')
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto pb-24 page-enter">

      {/* ── MODAL LISTAS COMPARTIDAS ────────────────────────────────────── */}
      {modalCompartida && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-16"
          onClick={() => { setModalCompartida(false); setModoModal('elegir'); setNombreNueva(''); setCodigoUnirse(''); setErrorCompartida('') }}>
          <div data-tutorial="compartida-modal" className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-xl p-6" onClick={e => e.stopPropagation()}>
            {modoModal === 'elegir' && (
              <>
                <h2 className="text-lg font-black tracking-tight mb-1">{t.compartidas_titulo}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{t.compartidas_desc}</p>

                {listas.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">{t.compartidas_tus_listas}</p>
                    {listas.map(l => (
                      <button key={l.id} onClick={() => { setModalCompartida(false); navigate(`/lista-compartida/${l.id}`) }}
                        className="w-full flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-select/20 rounded-xl px-4 py-3 hover:border-green-select transition-colors">
                        <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">{l.nombre}</span>
                        <span className="text-xs font-bold text-green-select tracking-widest">{l.codigo}</span>
                      </button>
                    ))}
                  </div>
                )}

                {listas.length >= 2 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2 mb-3 text-center">
                    {t.compartidas_limite}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setModoModal('crear')} disabled={listas.length >= 2}
                    className="flex flex-col items-center gap-1.5 border-2 border-green-select bg-green-50 dark:bg-green-900/20 rounded-xl py-4 font-semibold text-sm text-green-select hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed">
                    <span className="text-2xl">✨</span>
                    {t.compartidas_crear}
                  </button>
                  <button onClick={() => setModoModal('unirse')} disabled={listas.length >= 2}
                    className="flex flex-col items-center gap-1.5 border-2 border-gray-200 dark:border-gray-700 rounded-xl py-4 font-semibold text-sm text-gray-700 dark:text-gray-300 hover:border-green-select disabled:opacity-40 disabled:cursor-not-allowed">
                    <span className="text-2xl">🔑</span>
                    {t.compartidas_unirse_codigo}
                  </button>
                </div>
                <button onClick={() => setModalCompartida(false)} className="w-full mt-3 text-sm text-gray-400 py-2">{t.btn_cancelar}</button>
              </>
            )}

            {modoModal === 'crear' && (
              <>
                <button onClick={() => setModoModal('elegir')} className="text-gray-400 mb-3 text-sm">{t.btn_volver}</button>
                <h2 className="text-lg font-black tracking-tight mb-4">{t.compartidas_nueva}</h2>
                <input
                  autoFocus
                  type="text"
                  value={nombreNueva}
                  onChange={e => setNombreNueva(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCrearLista()}
                  placeholder={t.compartidas_nombre_placeholder}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm mb-4 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-select"
                />
                {errorCompartida && <p className="text-sm text-red-500 mb-3">{errorCompartida}</p>}
                <button onClick={handleCrearLista} disabled={cargandoCompartida}
                  className="w-full bg-green-select text-white rounded-xl py-3 font-bold text-sm disabled:opacity-50">
                  {cargandoCompartida ? t.compartidas_creando : t.compartidas_crear_abrir}
                </button>
              </>
            )}

            {modoModal === 'unirse' && (
              <>
                <button onClick={() => { setModoModal('elegir'); setErrorCompartida('') }} className="text-gray-400 mb-3 text-sm">{t.btn_volver}</button>
                <h2 className="text-lg font-black tracking-tight mb-2">{t.compartidas_unirse_codigo}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t.compartidas_pide_codigo}</p>
                <input
                  autoFocus
                  type="text"
                  value={codigoUnirse}
                  onChange={e => setCodigoUnirse(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleUnirse()}
                  placeholder="ABCD12"
                  maxLength={6}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-center text-2xl font-black tracking-widest mb-2 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-select"
                />
                {errorCompartida && <p className="text-sm text-red-500 mb-3">{errorCompartida}</p>}
                <button onClick={handleUnirse} disabled={cargandoCompartida || codigoUnirse.length < 4}
                  className="w-full bg-green-select text-white rounded-xl py-3 font-bold text-sm disabled:opacity-50">
                  {cargandoCompartida ? t.compartidas_buscando : t.compartidas_unirse}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── LISTA DE COMPRA sticky ────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 glass-header border-b border-white/40 dark:border-white/10">
        <div className="p-4 pb-3">
          {/* Cabecera */}
          <div data-tutorial="lista-cabecera" className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">Lista</h1>
              <button
                data-tutorial="compartida-btn"
                onClick={() => { setModoModal('elegir'); setModalCompartida(true) }}
                className="flex items-center gap-1.5 bg-green-select text-white text-xs font-bold px-2.5 py-1.5 rounded-full shadow-sm hover:bg-green-600 transition-colors"
              >
                <span>👥</span>
                <span>{t.nav_compartida}{listas.length > 0 ? ` (${listas.length})` : ''}</span>
              </button>
            </div>
            <button data-tutorial="presupuesto" className="text-right" onClick={() => { setPresupuestoDraft(presupuesto > 0 ? presupuesto.toString() : ''); setEditandoPresupuesto(true) }}>
              {totalEstimado > 0 && (
                <span className={`text-xl font-black block ${sobrepresupuesto ? 'text-red-500' : 'text-green-select'}`}>
                  {totalEstimado.toFixed(2)} €
                </span>
              )}
              <span className={`text-xs block mt-0.5 ${sobrepresupuesto ? 'text-red-400' : 'text-gray-400'}`}>
                {sobrepresupuesto ? `⚠️ +${(totalEstimado - presupuesto).toFixed(2)} ${t.lc_del_limite}` : presupuesto > 0 ? `de ${presupuesto} €` : t.lc_mas_limite}
              </span>
            </button>
          </div>

          {/* Items a comprar */}
          {comprarArray.length === 0
            ? <p className="text-sm text-gray-400 mb-3">Añade productos desde el catálogo o escribe uno abajo</p>
            : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => { if (comprar.size > 0 && confirm('¿Borrar todos los artículos de la lista?')) { saveComprar(new Set()) } }}
                    className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                  >
                    🗑 Borrar todo
                  </button>
                  <button
                    onClick={() => setListaColapsada(v => !v)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className={`inline-block transition-transform duration-200 text-base ${listaColapsada ? '-rotate-90' : ''}`}>▾</span>
                    {listaColapsada ? t.lista_mostrar(comprarArray.length) : t.lista_esconder}
                  </button>
                </div>
                {!listaColapsada && (
                <div className="max-h-72 overflow-y-auto mb-2 space-y-3">
                  {comprarPorCategoria.map(([cat, items]) => (
                    <div key={cat}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1 px-1">
                        {CAT_EMOJI[cat] ?? '📦'} {cat}
                      </p>
                      <div className="space-y-0.5">
                        {items.map(item => {
                          const { modo, precioKg } = getModoInfo(item)
                          const enKg = modo === 'kg'
                          const foto = infoItem.get(item)?.foto ?? null
                          return (
                            <div key={item} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors ${
                              comprado.has(item) ? 'bg-gray-50 dark:bg-gray-900 opacity-60' : 'bg-green-50 dark:bg-green-950/50'
                            }`}>
                              <input
                                data-tutorial="list-checkbox"
                                type="checkbox"
                                checked={comprado.has(item)}
                                onChange={() => {
                                  const cp = new Set(comprado)
                                  if (cp.has(item)) cp.delete(item); else cp.add(item)
                                  saveComprado(cp)
                                }}
                                className="shrink-0 accent-green-select w-4 h-4"
                              />
                              {foto
                                ? <img src={foto} alt="" loading="lazy" onClick={() => setFotoAmpliada(foto)} className="w-7 h-7 rounded-lg object-cover shrink-0 cursor-zoom-in bg-gray-100 dark:bg-gray-800" onError={e => { e.currentTarget.style.display = 'none' }} />
                                : <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0 flex items-center justify-center text-sm">🛒</div>
                              }
                              <span className={`flex-1 text-xs font-medium truncate ${comprado.has(item) ? 'line-through text-gray-300' : 'text-gray-800 dark:text-gray-200'}`}>
                                {item}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {precioKg != null && (
                                  <div className="flex rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 text-[9px] font-bold">
                                    <button onClick={() => modo !== 'ud' && toggleModoKg(item)} className={`px-1.5 py-0.5 ${modo === 'ud' ? 'bg-green-select text-white' : 'text-gray-400'}`}>ud</button>
                                    <button onClick={() => modo !== 'kg' && toggleModoKg(item)} className={`px-1.5 py-0.5 ${modo === 'kg' ? 'bg-green-select text-white' : 'text-gray-400'}`}>kg</button>
                                  </div>
                                )}
                                <button onClick={() => decrementarCantidad(item)} className="w-4 h-4 rounded-full border border-green-select text-green-select font-bold text-[10px] flex items-center justify-center leading-none">−</button>
                                <span className="text-[10px] font-bold text-green-select min-w-[1.8rem] text-center">
                                  {enKg ? `${cantidades[item] ?? DEFECTO_KG}kg` : `×${cantidades[item] ?? 1}`}
                                </span>
                                <button onClick={() => incrementarCantidad(item)} className="w-4 h-4 rounded-full border border-green-select text-green-select font-bold text-[10px] flex items-center justify-center leading-none">+</button>
                              </div>
                              {editandoPrecio === item ? (
                                <form onSubmit={e => { e.preventDefault(); guardarPrecio(item) }} className="flex gap-1 items-center shrink-0">
                                  <input autoFocus type="number" step="0.01" min="0" value={precioEdit}
                                    onChange={e => setPrecioEdit(e.target.value)}
                                    className="w-16 text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-0.5 bg-white dark:bg-gray-800" placeholder="0.00" />
                                  <button type="submit" className="text-xs text-green-select font-bold">✓</button>
                                  <button type="button" onClick={() => setEditandoPrecio(null)} className="text-xs text-gray-400">✕</button>
                                </form>
                              ) : (
                                <button onClick={() => { setEditandoPrecio(item); setPrecioEdit(precios[item]?.toString() ?? precioSugerido(item)?.toString() ?? '') }}
                                  className="text-[10px] font-semibold text-gray-500 hover:text-green-select shrink-0 min-w-[40px] text-right">
                                  {precios[item] ? `${precios[item].toFixed(2)} €` : <span className="text-gray-300">+€</span>}
                                </button>
                              )}
                              <button onClick={() => addToCasa(item)} title={t.lista_tengo_casa} className="text-sm shrink-0 opacity-40 hover:opacity-100 transition-opacity">🏠</button>
                              <button onClick={() => removeComprar(item)} className="text-gray-300 hover:text-red-400 shrink-0 text-xs transition-colors">✕</button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                )}
                {!listaColapsada && comprado.size > 0 && (
                  <button
                    onClick={() => {
                      const cp = new Set(comprado); const c = new Set(comprar)
                      cp.forEach(item => c.delete(item)); cp.clear()
                      saveComprar(c); saveComprado(cp)
                    }}
                    className="w-full text-xs text-red-400 hover:text-red-600 py-1.5 mt-1 border border-red-100 dark:border-red-900 rounded-xl transition-colors"
                  >
                    {t.lista_limpiar_comprados} ({comprado.size})
                  </button>
                )}
                {listaColapsada && <div className="mb-1" />}
              </>
            )
          }

          {/* Añadir personalizado — solo visible cuando la lista está expandida */}
          {!listaColapsada && <AnadirProducto inputCustom={inputCustom} setInputCustom={setInputCustom} precioInputCustom={precioInputCustom} setPrecioInputCustom={setPrecioInputCustom} onAdd={addCustom} />}
        </div>
      </div>

      <div className="p-4 space-y-6">

        {/* ── DEL MENÚ ESTA SEMANA ──────────────────────────────────────────── */}
        <div>
          <div className="flex items-center mb-2 gap-2">
            <button data-tutorial="menu-semana-btn" onClick={() => setAbiertoMenu(v => !v)} className="flex items-center flex-1 text-left gap-2 py-1">
              <h2 data-tutorial="menu-semana" className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t.lista_del_menu}</h2>
              {precioEstimadoMenu > 0 && (
                <span className="text-xs font-bold text-green-select">~{precioEstimadoMenu.toFixed(2)} €{t.lista_aprox}</span>
              )}
              <span className={`ml-auto w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm transition-transform duration-200 ${abiertoMenu ? 'rotate-0' : '-rotate-90'}`}>▾</span>
            </button>
            {ingredientesMenu.length > 0 && (
              <button onClick={vaciarMenu} title="Vaciar menú de la semana"
                className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shrink-0">
                🗑
              </button>
            )}
          </div>
          {abiertoMenu && (
            <div className="bg-white dark:bg-gray-900 shadow-card rounded-card p-3">
              {gruposMenuPorCategoria.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">{t.lista_vacia_menu}</p>
              ) : (
                <div className="flex items-start" ref={menuContainerRef}>
                  {/* ── Columna izquierda: pendientes / en lista ── */}
                  <div style={{ width: `${menuSplitRatio}%` }} className="min-w-0 shrink-0 space-y-3 pr-1">
                    {gruposMenuPorCategoria.map(([cat, grupos]) => {
                      const gruposFiltrados = grupos.filter(({ items }) => !items.some(i => menuEnCasa.has(i)))
                      if (!gruposFiltrados.length) return null
                      return (
                        <div key={cat}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                            {CAT_EMOJI[cat] ?? '📦'} {cat}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {gruposFiltrados.map(({ key, items, etiqueta }) => {
                              const enC = items.some(i => menuEnComprar.has(i))
                              const foto = items.map(i => infoIngredienteMenu.get(i)?.foto).find(f => f != null) ?? null
                              return (
                                <div key={key} className="flex rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                                  {foto && (
                                    <button onClick={() => setFotoAmpliada(foto)}
                                      className="flex items-center pl-1 pr-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
                                      <img src={foto} alt="" loading="lazy"
                                        className="w-6 h-6 rounded-full object-cover shrink-0 cursor-zoom-in"
                                        onError={e => { e.currentTarget.parentElement!.style.display = 'none' }} />
                                    </button>
                                  )}
                                  <button onClick={() => enC ? quitarGrupoDeComprar(items) : abrirPickerMenu(items, false)}
                                    className={`text-xs px-3 py-1.5 font-medium transition-colors ${enC ? 'bg-green-select text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50'}`}>
                                    {enC ? '✓' : '🛒'} {etiqueta}
                                  </button>
                                  <button data-tutorial="en-casa" onClick={() => abrirPickerMenu(items, true)}
                                    className="text-xs px-2.5 py-1.5 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-400 hover:bg-gray-50 transition-colors">
                                    🏠
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* ── Divisor arrastrable ── */}
                  {gruposMenu.some(({ items }) => items.some(i => menuEnCasa.has(i))) && (
                    <div
                      onPointerDown={onDividerPointerDown}
                      className="w-3 shrink-0 self-stretch cursor-col-resize flex items-center justify-center group select-none"
                      style={{ touchAction: 'none' }}
                    >
                      <div className="w-px h-full bg-gray-200 dark:bg-gray-700 group-hover:bg-green-select transition-colors relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-6 bg-gray-300 dark:bg-gray-600 group-hover:bg-green-select rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors">
                          <span className="w-0.5 h-0.5 rounded-full bg-white block" />
                          <span className="w-0.5 h-0.5 rounded-full bg-white block" />
                          <span className="w-0.5 h-0.5 rounded-full bg-white block" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Columna derecha: en casa ── */}
                  {gruposMenu.some(({ items }) => items.some(i => menuEnCasa.has(i))) && (
                    <div style={{ width: `${100 - menuSplitRatio}%` }} className="min-w-0 shrink-0 space-y-3 pl-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 text-right">🏠 En casa</p>
                      {gruposMenuPorCategoria.map(([cat, grupos]) => {
                        const gruposCasa = grupos.filter(({ items }) => items.some(i => menuEnCasa.has(i)))
                        if (!gruposCasa.length) return null
                        return (
                          <div key={cat}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5 text-right truncate">
                              {CAT_EMOJI[cat] ?? '📦'} {cat}
                            </p>
                            <div className="flex flex-col gap-1 items-end">
                              {gruposCasa.map(({ key, items, etiqueta }) => (
                                <button key={key}
                                  onClick={() => quitarGrupoDeCasa(items)}
                                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors max-w-full">
                                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">{etiqueta}</span>
                                  <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                                    <span className="text-white text-[9px] font-bold">✓</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── EN CASA TENEMOS ───────────────────────────────────────────────── */}
        <EnCasaSection
            enCasa={enCasa}
            catalogo={MERCADONA?.categorias}
            onRemove={removeCasa}
            enCarrito={comprar}
            onAddToCart={addCasaToCart}
          />

        {/* ── CATÁLOGO MERCADONA ────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t.catalogo_titulo}</h2>
            {MERCADONA?.actualizado && (
              <span className="text-xs text-gray-400">
                {new Date(MERCADONA.actualizado).toLocaleDateString('es-ES')} · {MERCADONA.total_productos} productos
              </span>
            )}
          </div>

          {MERCADONA === null ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
              <span className="animate-spin inline-block">⏳</span> {t.catalogo_cargando}
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
                data-tutorial="add-custom"
                type="text"
                placeholder={`${t.catalogo_buscar}${catActiva === TODO_CAT ? '' : ` en ${catActiva}`}...`}
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm mb-3 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-select"
              />

              {/* Pills de categorías */}
              <CategoriasSelector
                categorias={CATEGORIAS_MERCADONA}
                catActiva={catActiva}
                onSelect={cat => { setCatActiva(cat); setBusqueda('') }}
              />

              {/* Lista de productos — key fuerza remount al cambiar categoría */}
              <ListaProductos
                key={catActiva}
                productos={productosVisibles}
                comprar={comprar} enCasa={enCasa} precios={precios} cantidades={cantidades}
                onAddComprar={addToComprar} onAddCasa={addToCasa}
                onRemoveCasa={removeCasa}
                onIncrementar={incrementarCantidad} onDecrementar={decrementarCantidad}
                onToggleModo={toggleModoKg} getModoInfo={getModoInfo}
                vacio={busqueda.length >= 2 ? `${t.catalogo_sin_resultados} "${busqueda}"` : t.catalogo_sin_productos}
              />
            </>
          )}
        </div>
      </div>

      {/* ── MODAL PRESUPUESTO ─────────────────────────────────────────────── */}
      {editandoPresupuesto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setEditandoPresupuesto(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6" />
            <h2 className="text-lg font-black text-gray-800 dark:text-gray-100 mb-1">{t.lista_presupuesto}</h2>
            <p className="text-sm text-gray-400 mb-6">{t.lc_presupuesto_desc}</p>
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={presupuestoDraft}
              onChange={e => setPresupuestoDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { const v = parseFloat(presupuestoDraft.replace(',','.')); if (perfil) guardarPerfil({ ...perfil, presupuesto: isNaN(v) || v <= 0 ? 0 : v }); setEditandoPresupuesto(false) }}}
              placeholder="0.00"
              className="w-full text-4xl font-black text-center text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-5 mb-6 focus:outline-none focus:border-green-select"
            />
            <div className="flex gap-3">
              {presupuesto > 0 && (
                <button onClick={() => { if (perfil) guardarPerfil({ ...perfil, presupuesto: 0 }); setEditandoPresupuesto(false) }}
                  className="flex-1 py-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-gray-500 font-semibold text-sm">
                  {t.lc_quitar_limite}
                </button>
              )}
              <button onClick={() => { const v = parseFloat(presupuestoDraft.replace(',','.')); if (perfil) guardarPerfil({ ...perfil, presupuesto: isNaN(v) || v <= 0 ? 0 : v }); setEditandoPresupuesto(false) }}
                className="flex-1 py-4 rounded-2xl bg-green-select text-white font-black text-lg shadow-lg active:scale-95 transition-transform">
                {t.btn_guardar}
              </button>
            </div>
          </div>
        </div>
      )}

      {fotoAmpliada && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6" onClick={() => setFotoAmpliada(null)}>
          <img src={fotoAmpliada} alt="" className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain" />
        </div>,
        document.body
      )}

      {pickerIngrediente && (
        <PickerProductoMercadona
          ingrediente={pickerIngrediente.nombre}
          opciones={pickerOpciones}
          enCasa={pickerIngrediente.enCasa}
          catalogo={MERCADONA?.categorias}
          onSeleccionar={confirmarPicker}
          onCancelar={cerrarPicker}
        />
      )}
    </div>
  )
}

const PAGINA = 60

// ── Subcomponente: lista de productos ────────────────────────────────────────
function ListaProductos({ productos, comprar, enCasa, precios, cantidades, onAddComprar, onAddCasa, onRemoveCasa, onIncrementar, onDecrementar, onToggleModo, getModoInfo, vacio }: {
  productos: { id: string; nombre: string; precio: number; tamaño: number; unidad: string; foto?: string | null; precio_kg?: number | null }[]
  comprar: Set<string>; enCasa: Set<string>; precios: Record<string, number>; cantidades: Record<string, number>
  onAddComprar: (nombre: string, precio: number, unidad?: string, precioKg?: number) => void
  onAddCasa: (nombre: string) => void
  onRemoveCasa: (nombre: string) => void
  onIncrementar: (nombre: string) => void
  onDecrementar: (nombre: string) => void
  onToggleModo: (nombre: string) => void
  getModoInfo: (nombre: string) => { modo: 'ud' | 'kg'; precioKg: number | null }
  vacio: string
}) {
  const { t } = useI18n()
  const [limite, setLimite] = useState(PAGINA)
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)
  const visibles = productos.slice(0, limite)

  if (productos.length === 0) return <p className="text-sm text-gray-400 text-center py-4">{vacio}</p>

  return (
    <>
      {fotoAmpliada && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6" onClick={() => setFotoAmpliada(null)}>
          <img src={fotoAmpliada} alt="" className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain" />
        </div>,
        document.body
      )}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {visibles.map(prod => {
          const enC = comprar.has(prod.nombre); const enN = enCasa.has(prod.nombre)
          return (
            <div key={prod.id} className="flex items-center gap-2 px-3 py-2">
              {prod.foto
                ? <img src={prod.foto} alt={prod.nombre} onClick={() => setFotoAmpliada(prod.foto!)} className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-100 dark:bg-gray-800 cursor-zoom-in" loading="lazy" />
                : <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0 flex items-center justify-center text-lg">🛒</div>
              }
              {(() => {
                const { modo, precioKg } = getModoInfo(prod.nombre)
                const enKg = enC && modo === 'kg'
                const kgActual = cantidades[prod.nombre] ?? DEFECTO_KG
                const precioMostrado = enKg
                  ? (precioKg ?? 0) * kgActual
                  : (precios[prod.nombre] ?? prod.precio) * (cantidades[prod.nombre] ?? 1)
                return (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${enC || enN ? 'text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>{prod.nombre}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <span>{prod.tamaño > 0 ? `${prod.tamaño} ${prod.unidad}` : prod.unidad}</span>
                        {prod.precio_kg && <span className="text-gray-400">· {prod.precio_kg.toFixed(2)} €/kg</span>}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-red-600 shrink-0">
                      {precioMostrado.toFixed(2)} €
                    </span>
                    {enN && <span className="text-xs text-blue-500 shrink-0">casa</span>}
                    {enC ? (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {prod.precio_kg && (
                          <div className="flex rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 text-[10px] font-bold">
                            <button
                              onClick={() => modo !== 'ud' && onToggleModo(prod.nombre)}
                              className={`px-2 py-0.5 transition-colors ${modo === 'ud' ? 'bg-green-select text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                              ud
                            </button>
                            <button
                              onClick={() => modo !== 'kg' && onToggleModo(prod.nombre)}
                              className={`px-2 py-0.5 transition-colors ${modo === 'kg' ? 'bg-green-select text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                              kg
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <button onClick={() => onDecrementar(prod.nombre)}
                            className="w-7 h-7 rounded-full border-2 border-green-select text-green-select font-bold text-base flex items-center justify-center leading-none hover:bg-green-50 transition-colors">
                            −
                          </button>
                          <span className="text-center text-sm font-bold text-green-select min-w-[2.5rem]">
                            {enKg ? `${kgActual} kg` : cantidades[prod.nombre] ?? 1}
                          </span>
                          <button onClick={() => onIncrementar(prod.nombre)}
                            className="w-7 h-7 rounded-full border-2 border-green-select text-green-select font-bold text-base flex items-center justify-center leading-none hover:bg-green-50 transition-colors">
                            +
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => onAddComprar(prod.nombre, prod.precio, prod.unidad, prod.precio_kg ?? undefined)}
                        className="text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600 shrink-0 transition-colors">
                        🛒
                      </button>
                    )}
                  </>
                )
              })()}
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
          {t.ver_mas} ({productos.length - limite} restantes)
        </button>
      )}
    </>
  )
}
