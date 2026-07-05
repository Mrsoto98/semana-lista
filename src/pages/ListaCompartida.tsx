import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useListaCompartida, useListasCompartidas } from '../hooks/useListaCompartida'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from '../components/Avatar'
import { supabase } from '../lib/supabase'
import { recuperar, guardar } from '../lib/storage'
import {
  topMatchesMercadona, topMatchConConfianza, agruparIngredientes, resolverContraSet, etiquetaGrupo, nombreGuardadoComo as nombreGuardadoComoLib,
  expandirCatalogo, type MatchProducto,
} from '../lib/matchMercadona'
import { PickerProductoMercadona } from '../components/PickerProductoMercadona'
import { fetchLearnedOptions, fetchAllLearnedAssocs, saveLearnedOption, mergePickerOptions } from '../lib/pickerLearning'
import { EnCasaSection } from '../components/EnCasaSection'
import type { MenuSemanal } from '../types'
import { useI18n } from '../hooks/useI18n'

interface ProductoMercadona {
  id: string; nombre: string; precio: number; tamaño: number; unidad: string; foto?: string | null; precio_kg?: number | null
}
type CatalogoData = { actualizado: string; total_productos: number; categorias: Record<string, ProductoMercadona[]> }

const TODO_CAT = 'Todo'
const PASO_KG = 0.5
const DEFECTO_KG = 1
const PAGINA = 50

const CAT_EMOJI: Record<string, string> = {
  'Aceite, especias y salsas':'🫒','Aceites y vinagres':'🫒','Especias, salsas y aderezos':'🧂',
  'Agua y refrescos':'💧','Aperitivos':'🍿',
  'Arroz, legumbres y pasta':'🍝','Azúcar, caramelos y chocolate':'🍫','Bebé':'👶',
  'Bodega':'🍷','Cacao, café e infusiones':'☕','Carne':'🥩','Cereales y galletas':'🥣',
  'Charcutería y quesos':'🧀','Congelados':'🧊','Conservas, caldos y cremas':'🥫',
  'Cuidado del cabello':'💇','Cuidado facial y corporal':'🧴','Fitoterapia y parafarmacia':'💊',
  'Fruta y verdura':'🥦','Huevos, leche y mantequilla':'🥛','Limpieza y hogar':'🧹',
  'Maquillaje':'💄','Marisco y pescado':'🐟','Mascotas':'🐾','Panadería y pastelería':'🥖',
  'Pizzas y platos preparados':'🍕','Postres y yogures':'🍮','Zumos':'🍊',
}

function ArticuloPersonalizado({ inputRef, onAñadir }: {
  inputRef: React.RefObject<HTMLInputElement | null>
  onAñadir: (nombre: string) => void
}) {
  const { t } = useI18n()
  const [abierto, setAbierto] = useState(false)
  const [valor, setValor] = useState('')
  function confirmar() {
    if (!valor.trim()) return
    onAñadir(valor)
    setValor('')
    setAbierto(false)
  }
  return (
    <div className="mt-2">
      {!abierto ? (
        <button
          onClick={() => setAbierto(true)}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-green-select transition-colors flex items-center gap-1"
        >{t.lista_articulo_personalizado}</button>
      ) : (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={valor}
            onChange={e => setValor(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setAbierto(false) }}
            placeholder={t.lista_nombre_articulo}
            className="flex-1 min-w-0 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-select"
          />
          <button onClick={confirmar} disabled={!valor.trim()}
            className="text-sm bg-green-select text-white px-4 py-2 rounded-xl font-semibold shrink-0 hover:bg-green-700 transition-colors disabled:opacity-40">+</button>
          <button onClick={() => setAbierto(false)}
            className="text-sm text-gray-400 px-2 py-2 rounded-xl hover:text-gray-600 transition-colors">✕</button>
        </div>
      )}
    </div>
  )
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
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${!esActiva ? 'bg-green-select text-white shadow-sm' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-green-select hover:text-green-select'}`}
        >{t.lista_todo}</button>
        <button
          onClick={() => setAbierto(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1 ${esActiva ? 'bg-green-select text-white shadow-sm' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-green-select hover:text-green-select'}`}
        >
          {esActiva ? `${CAT_EMOJI[catActiva] ?? ''} ${catActiva}` : t.lista_categorias}
          <span className={`transition-transform duration-200 inline-block ${abierto ? 'rotate-180' : ''}`}>▾</span>
        </button>
      </div>
      {abierto && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {categorias.map(cat => (
            <button key={cat}
              onClick={() => { onSelect(cat); setAbierto(false) }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${catActiva === cat ? 'bg-green-select text-white shadow-sm' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-green-select hover:text-green-select'}`}
            >{CAT_EMOJI[cat] ?? ''} {cat}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ListaCompartida() {
  const { t } = useI18n()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    lista, items, miembros, loading, error, recargar,
    añadirItem, toggleComprado, toggleEnCasa,
    actualizarPrecio, actualizarCantidad, actualizarUnidadYCantidad, eliminarItem, renombrarLista, actualizarPresupuesto,
  } = useListaCompartida(id ?? null)

  const [perfilesMiembros, setPerfilesMiembros] = useState<Record<string, { nombre_display?: string; avatar_emoji?: string; avatar_url?: string }>>({})

  // Solicitudes pendientes (solo visible para admins)
  const [solicitudes, setSolicitudes] = useState<{ id: string; usuario_id: string; nombre_display?: string; avatar_emoji?: string }[]>([])
  const esAdmin = miembros.find(m => m.usuario_id === user?.id)?.rol === 'admin'
  const { listas, recargar: recargarListas, abandonarLista, crearLista, unirseConCodigo } = useListasCompartidas()
  const [modalGestionar, setModalGestionar] = useState(false)
  const [sheetVisible, setSheetVisible] = useState(false)
  const [confirmEliminarLista, setConfirmEliminarLista] = useState<string | null>(null)
  const [modoCrear, setModoCrear] = useState<'crear' | 'unirse' | null>(null)
  const [nombreNuevaLista, setNombreNuevaLista] = useState('')
  const [codigoUnirse, setCodigoUnirse] = useState('')
  const [errorCrear, setErrorCrear] = useState('')
  const [cargandoCrear, setCargandoCrear] = useState(false)
  const listaActivaId = recuperar<string>('lista_compartida_principal') ?? listas[0]?.id

  function abrirGestionar() { setModalGestionar(true); setTimeout(() => setSheetVisible(true), 10) }
  function cerrarGestionar() { setSheetVisible(false); setTimeout(() => { setModalGestionar(false); setConfirmEliminarLista(null); setModoCrear(null); setErrorCrear('') }, 320) }

  async function handleCrearLista() {
    if (!nombreNuevaLista.trim()) return
    setCargandoCrear(true); setErrorCrear('')
    const { lista: nueva, error } = await crearLista(nombreNuevaLista.trim())
    setCargandoCrear(false)
    if (error) { setErrorCrear(error); return }
    if (nueva) { cerrarGestionar(); navigate(`/lista-compartida/${nueva.id}`) }
  }

  async function handleUnirse() {
    if (!codigoUnirse.trim()) return
    setCargandoCrear(true); setErrorCrear('')
    const { ok, error } = await unirseConCodigo(codigoUnirse.trim())
    setCargandoCrear(false)
    if (!ok) { setErrorCrear(error ?? 'Error desconocido'); return }
    setErrorCrear(''); cerrarGestionar()
  }

  const cargarSolicitudes = useCallback(async () => {
    if (!id || !esAdmin) { setSolicitudes([]); return }
    const { data } = await supabase.from('solicitudes_lista').select('id, usuario_id').eq('lista_id', id)
    if (!data?.length) { setSolicitudes([]); return }
    // Filtrar solicitudes de usuarios que ya son miembros
    const miembroIds = new Set(miembros.map(m => m.usuario_id))
    const pendientes = data.filter(s => !miembroIds.has(s.usuario_id))
    // Limpiar solicitudes de miembros ya aceptados de la DB
    const yaAceptados = data.filter(s => miembroIds.has(s.usuario_id))
    if (yaAceptados.length) {
      supabase.from('solicitudes_lista').delete().in('id', yaAceptados.map(s => s.id)).then(({ error }) => {
        if (error) console.warn('limpieza solicitudes antiguas:', error.message)
      })
    }
    if (!pendientes.length) { setSolicitudes([]); return }
    const { data: perfiles } = await supabase.from('usuarios').select('id, nombre_display, avatar_emoji').in('id', pendientes.map(s => s.usuario_id))
    const map: Record<string, { nombre_display?: string; avatar_emoji?: string }> = {}
    perfiles?.forEach((p: { id: string; nombre_display?: string; avatar_emoji?: string }) => { map[p.id] = p })
    setSolicitudes(pendientes.map(s => ({ ...s, ...map[s.usuario_id] })))
  }, [id, esAdmin, miembros])

  useEffect(() => { cargarSolicitudes() }, [cargarSolicitudes])

  useEffect(() => {
    if (!id || !esAdmin) return
    const canal = supabase.channel(`solicitudes-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_lista', filter: `lista_id=eq.${id}` }, cargarSolicitudes)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [id, esAdmin, cargarSolicitudes])

  async function aceptarSolicitud(solicitudId: string, usuarioIdSolicitante: string) {
    const { error: errInsert } = await supabase.from('lista_compartida_miembros')
      .upsert({ lista_id: id, usuario_id: usuarioIdSolicitante, rol: 'miembro' }, { onConflict: 'lista_id,usuario_id' })
    if (errInsert) { console.error('insert miembro:', errInsert.message); return }
    // Ocultar inmediatamente de la UI
    setSolicitudes(prev => prev.filter(s => s.id !== solicitudId))
    // Intentar borrar de DB (puede fallar por RLS; cargarSolicitudes la filtrará si queda)
    supabase.from('solicitudes_lista').delete().eq('id', solicitudId).then(({ error }) => {
      if (error) console.warn('delete solicitud:', error.message)
    })
    recargar()
    recargarListas()
  }

  async function expulsarMiembro(usuarioId: string) {
    const { error } = await supabase.rpc('expulsar_miembro', { p_lista_id: id, p_usuario_id: usuarioId })
    if (error) { console.error('expulsarMiembro:', error); return }
    recargar()
    recargarListas()
  }

  async function rechazarSolicitud(solicitudId: string) {
    const { error } = await supabase.from('solicitudes_lista').delete().eq('id', solicitudId)
    if (error) { console.error('rechazarSolicitud:', error); return }
    setSolicitudes(prev => prev.filter(s => s.id !== solicitudId))
    recargarListas()
  }

  // Catálogo
  const [catalogo, setCatalogo] = useState<CatalogoData | null>(null)
  const [catActiva, setCatActiva] = useState(TODO_CAT)
  const [busqueda, setBusqueda] = useState('')
  const [busquedaDebounced, setBusquedaDebounced] = useState('')
  const [limite, setLimite] = useState(PAGINA)

  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda), 200)
    return () => clearTimeout(t)
  }, [busqueda])
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)
  const [abiertoMenu, setAbiertoMenu] = useState(false)
  const [listaColapsada, setListaColapsada] = useState(false)
  const [learnedAssocs, setLearnedAssocs] = useState<Map<string, Set<string>>>(new Map())
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

  // UI
  const [, setInputCustom] = useState('')
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nombreDraft, setNombreDraft] = useState('')
  const [editandoPrecio, setEditandoPrecio] = useState<string | null>(null)
  const [precioDraft, setPrecioDraft] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [editandoPresupuesto, setEditandoPresupuesto] = useState(false)
  const [presupuestoDraft, setPresupuestoDraft] = useState('')
  const [pickerIngrediente, setPickerIngrediente] = useState<{ nombre: string; enCasa: boolean } | null>(null)
  const [pickerOpciones, setPickerOpciones] = useState<MatchProducto[]>([])
  const savedScrollY = useRef<number>(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    import('../data/mercadona.json').then(m => {
      const raw = m.default as CatalogoData
      setCatalogo({ ...raw, categorias: expandirCatalogo(raw.categorias) as typeof raw.categorias })
    })
  }, [])

  useEffect(() => {
    if (!miembros.length) return
    supabase.from('usuarios').select('id, nombre_display, avatar_emoji, avatar_url').in('id', miembros.map(m => m.usuario_id))
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, { nombre_display?: string; avatar_emoji?: string; avatar_url?: string }> = {}
        data.forEach((u: { id: string; nombre_display?: string; avatar_emoji?: string; avatar_url?: string }) => { map[u.id] = u })
        setPerfilesMiembros(map)
      })
  }, [miembros])

  // ── Catálogo ──────────────────────────────────────────────────────────────
  const categorias = useMemo(() => catalogo ? Object.keys(catalogo.categorias) : [], [catalogo])


  const todosDedup = useMemo<ProductoMercadona[]>(() => {
    if (!catalogo) return []
    const seenId = new Set<string>(); const seenN = new Set<string>()
    return Object.values(catalogo.categorias).flat().filter(p => {
      if (seenId.has(p.id) || seenN.has(p.nombre)) return false
      seenId.add(p.id); seenN.add(p.nombre); return true
    })
  }, [catalogo])

  const productosVisibles = useMemo<ProductoMercadona[]>(() => {
    if (!catalogo) return []
    const rawBase = catActiva === TODO_CAT ? todosDedup : (() => {
      const seenId = new Set<string>(); const seenN = new Set<string>()
      return (catalogo.categorias[catActiva] ?? []).filter(p => {
        if (seenId.has(p.id) || seenN.has(p.nombre)) return false
        seenId.add(p.id); seenN.add(p.nombre); return true
      })
    })()
    if (!busquedaDebounced || busquedaDebounced.length < 2) return rawBase
    const palabras = busquedaDebounced.toLowerCase().split(/\s+/).filter(Boolean)
    return rawBase.filter(p => palabras.every(w => p.nombre.toLowerCase().includes(w)))
  }, [catalogo, catActiva, busquedaDebounced, todosDedup])

  // Mapa nombre → item para saber si está en lista
  const itemPorNombre = useMemo(() => {
    const map: Record<string, typeof items[0]> = {}
    items.forEach(i => { if (!i.en_casa) map[i.nombre] = i })
    return map
  }, [items])

  // Precio/kg de un producto por nombre exacto, buscando en el catálogo aunque
  // el item se haya añadido desde el picker (no desde el navegador de catálogo).
  function precioKgDe(nombre: string): number | undefined {
    if (!catalogo) return undefined
    for (const prods of Object.values(catalogo.categorias)) {
      const p = prods.find(p => p.nombre === nombre)
      if (p?.precio_kg) return p.precio_kg
    }
    return undefined
  }

  // ── Acciones ──────────────────────────────────────────────────────────────
  async function añadir(nombre: string, precio?: number, unidad?: string) {
    const n = nombre.trim(); if (!n) return
    await añadirItem(n, { precio, cantidad: 1, unidad: unidad ?? 'ud' })
    setBusqueda(''); setInputCustom('')
    inputRef.current?.focus()
  }

  async function añadirItemEnCasa(nombre: string, precio?: number) {
    const n = nombre.trim(); if (!n) return
    await añadirItem(n, { precio, cantidad: 1, unidad: 'ud' }, true)
  }

  async function incrementar(item: typeof items[0], precioKg?: number | null) {
    const esKg = item.unidad === 'kg'
    const nueva = esKg
      ? Math.round(((item.cantidad ?? DEFECTO_KG) + PASO_KG) * 100) / 100
      : (item.cantidad ?? 1) + 1
    await actualizarCantidad(item.id, nueva)
    if (esKg && precioKg) await actualizarPrecio(item.id, precioKg)
  }

  async function decrementar(item: typeof items[0]) {
    const esKg = item.unidad === 'kg'
    const siguiente = esKg
      ? Math.round(((item.cantidad ?? DEFECTO_KG) - PASO_KG) * 100) / 100
      : (item.cantidad ?? 1) - 1
    await actualizarCantidad(item.id, siguiente)
  }

  async function toggleModoKg(item: typeof items[0], precioKg: number, precioUd: number) {
    const esKg = item.unidad === 'kg'
    if (esKg) {
      await actualizarUnidadYCantidad(item.id, 'ud', 1, precioUd)
    } else {
      await actualizarUnidadYCantidad(item.id, 'kg', DEFECTO_KG, precioKg)
    }
  }

  async function guardarNombre() {
    if (nombreDraft.trim()) await renombrarLista(nombreDraft.trim())
    setEditandoNombre(false)
  }

  async function guardarPrecio(itemId: string) {
    const v = parseFloat(precioDraft.replace(',', '.'))
    if (!isNaN(v) && v >= 0) await actualizarPrecio(itemId, v)
    setEditandoPrecio(null)
  }

  async function guardarPresupuesto() {
    const v = parseFloat(presupuestoDraft.replace(',', '.'))
    await actualizarPresupuesto(isNaN(v) || v <= 0 ? null : v)
    setEditandoPresupuesto(false)
  }

  function copiarCodigo() {
    if (!lista) return
    navigator.clipboard.writeText(lista.codigo).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) })
  }

  // ── Derivados ─────────────────────────────────────────────────────────────
  const porComprar = items.filter(i => !i.comprado && !i.en_casa)
  const comprados  = items.filter(i => i.comprado)
  const enCasa     = items.filter(i => i.en_casa)

  const PRECIO_MAX_PICKER = 50

  // ── Picker de producto Mercadona ──────────────────────────────────────────
  async function abrirPicker(nombreOGrupo: string | string[], enCasa: boolean) {
    savedScrollY.current = window.scrollY
    const nombres = Array.isArray(nombreOGrupo) ? nombreOGrupo : [nombreOGrupo]
    const etiqueta = nombres.length > 1 ? etiquetaGrupo(nombres) : nombres[0]

    let opcionesAI: MatchProducto[] = []
    if (catalogo) {
      const vistos = new Set<string>()
      for (const nombre of nombres) {
        for (const op of topMatchesMercadona(nombre, catalogo.categorias, 6)) {
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

    fetchLearnedOptions(etiqueta).then(learned => {
      if (learned.length > 0) {
        setPickerOpciones(prev => mergePickerOptions(prev, learned, etiqueta))
      }
    })
  }

  function cerrarPicker() {
    setPickerIngrediente(null)
    requestAnimationFrame(() => { window.scrollTo({ top: savedScrollY.current, behavior: 'instant' }) })
  }

  function confirmarPicker(producto: MatchProducto) {
    if (!pickerIngrediente) return
    añadirItem(producto.nombre, { precio: producto.precio }, pickerIngrediente.enCasa)
    saveLearnedOption(pickerIngrediente.nombre, producto).then(recargarLearnedAssocs)
    cerrarPicker()
  }

  // ── Del menú esta semana ──────────────────────────────────────────────────
  const [menuKey, setMenuKey] = useState(0)
  const ingredientesMenu = useMemo(() => {
    const menu = recuperar<MenuSemanal>('menu_semana')
    if (!menu) return []
    const nombres = new Set<string>()
    for (const receta of Object.values(menu)) {
      if (!receta) continue
      for (const ing of receta.ingredientes)
        if (ing.nombre) nombres.add(ing.nombre.charAt(0).toUpperCase() + ing.nombre.slice(1).toLowerCase())
    }
    return Array.from(nombres).sort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuKey])

  function vaciarMenu() {
    if (!confirm('¿Vaciar el menú de la semana de la lista?')) return
    localStorage.removeItem('semana-lista:menu_semana')
    setMenuKey(k => k + 1)
  }

  const gruposMenu = useMemo(() => agruparIngredientes(ingredientesMenu), [ingredientesMenu])

  const infoIngredienteMenu = useMemo(() => {
    const map = new Map<string, { foto: string | null; categoria: string }>()
    if (!catalogo?.categorias) return map
    const catMap = new Map<string, string>()
    for (const [cat, prods] of Object.entries(catalogo.categorias)) {
      for (const p of prods) { if (!catMap.has(p.nombre)) catMap.set(p.nombre, cat) }
    }
    for (const ing of ingredientesMenu) {
      if (map.has(ing)) continue
      const top = topMatchesMercadona(ing, catalogo.categorias, 1)
      const match = top[0]
      map.set(ing, { foto: match?.foto ?? null, categoria: catMap.get(match?.nombre ?? '') ?? 'Otros' })
    }
    return map
  }, [ingredientesMenu, catalogo])

  // Foto+categoría para cada item de la lista de compra compartida
  const infoItemLC = useMemo(() => {
    const map = new Map<string, { foto: string | null; categoria: string }>()
    if (!catalogo?.categorias) return map
    const catMap = new Map<string, string>()
    for (const [cat, prods] of Object.entries(catalogo.categorias)) {
      for (const p of prods) { if (!catMap.has(p.nombre)) catMap.set(p.nombre, cat) }
    }
    for (const item of items) {
      if (map.has(item.nombre)) continue
      const top = topMatchesMercadona(item.nombre, catalogo.categorias, 1)
      map.set(item.nombre, { foto: top[0]?.foto ?? null, categoria: catMap.get(top[0]?.nombre ?? '') ?? 'Otros' })
    }
    return map
  }, [items, catalogo])

  // Agrupa items por categoría (pendientes primero, comprados al final)
  const itemsPorCategoria = useMemo(() => {
    const allItems = [...porComprar, ...comprados]
    const g = new Map<string, typeof allItems>()
    for (const item of allItems) {
      const cat = infoItemLC.get(item.nombre)?.categoria ?? 'Otros'
      if (!g.has(cat)) g.set(cat, [])
      g.get(cat)!.push(item)
    }
    return Array.from(g.entries()).sort(([a], [b]) => {
      if (a === 'Otros') return 1; if (b === 'Otros') return -1
      return a.localeCompare(b, 'es')
    })
  }, [porComprar, comprados, infoItemLC])

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

  // Nombres reales tal como están guardados en la lista compartida, separados
  // por si están para comprar o marcados en casa (mismo criterio que Lista.tsx).
  const comprarNombres = useMemo(() => new Set(items.filter(i => !i.en_casa).map(i => i.nombre)), [items])
  const enCasaNombres = useMemo(() => new Set(items.filter(i => i.en_casa).map(i => i.nombre)), [items])

  const recargarLearnedAssocs = useCallback(() => {
    if (ingredientesMenu.length) fetchAllLearnedAssocs(ingredientesMenu).then(setLearnedAssocs)
  }, [ingredientesMenu])

  useEffect(() => { recargarLearnedAssocs() }, [recargarLearnedAssocs])

  const menuEnComprar = useMemo(
    () => resolverContraSet(ingredientesMenu, comprarNombres, catalogo?.categorias, learnedAssocs),
    [ingredientesMenu, comprarNombres, catalogo, learnedAssocs],
  )
  const menuEnCasa = useMemo(
    () => resolverContraSet(ingredientesMenu, enCasaNombres, catalogo?.categorias, learnedAssocs),
    [ingredientesMenu, enCasaNombres, catalogo, learnedAssocs],
  )

  const precioEstimadoMenu = useMemo(() => {
    if (!catalogo?.categorias || gruposMenu.length === 0) return 0
    let total = 0
    const PRECIO_MAX_INGREDIENTE = 18
    const CONFIANZA_MIN = 0.4
    for (const { items: grupoItems } of gruposMenu) {
      const estaEnCasa = grupoItems.some(i => menuEnCasa.has(i))
      if (estaEnCasa) continue
      const res = topMatchConConfianza(grupoItems[0], catalogo.categorias)
      if (!res) continue
      if (res.coverage < CONFIANZA_MIN) continue
      if (res.match.precio > PRECIO_MAX_INGREDIENTE) continue
      total += res.match.precio
    }
    return Math.round(total * 100) / 100
  }, [gruposMenu, menuEnCasa, catalogo])

  // Quita de golpe todos los productos resueltos para un grupo de variantes
  // (ej. al desmarcar el botón fusionado "Aceite de oliva").
  function quitarGrupoDeComprar(nombresGrupo: string[]) {
    for (const generico of nombresGrupo) {
      const real = nombreGuardadoComoLib(generico, comprarNombres, catalogo?.categorias)
      const encontrado = items.find(i => i.nombre === real && !i.en_casa)
      if (encontrado) eliminarItem(encontrado.id)
    }
  }
  function quitarGrupoDeCasa(nombresGrupo: string[]) {
    for (const generico of nombresGrupo) {
      const real = nombreGuardadoComoLib(generico, enCasaNombres, catalogo?.categorias)
      const encontrado = items.find(i => i.nombre === real && i.en_casa)
      if (encontrado) toggleEnCasa(encontrado.id, false)
    }
  }

  const totalEst   = items.filter(i => !i.en_casa && !i.comprado).reduce((s, i) => {
    const precio = i.precio ?? 0
    const cant = i.cantidad ?? 1
    return s + precio * cant
  }, 0)

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="text-3xl animate-spin">🛒</div></div>
  if (error || !lista) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-4xl">😕</p>
      <p className="text-gray-600 dark:text-gray-400 text-center">{error || 'Lista no encontrada'}</p>
      <button onClick={() => navigate('/lista')} className="text-green-select font-semibold">{t.btn_volver}</button>
    </div>
  )

  return (
    <div className="min-h-screen max-w-lg mx-auto pb-24 page-enter">
      {fotoAmpliada && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6" onClick={() => setFotoAmpliada(null)}>
          <img src={fotoAmpliada} alt="" className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain" />
        </div>,
        document.body
      )}

      {/* ── STICKY HEADER ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 glass-header border-b border-white/40 dark:border-white/10">
        <div className="p-4 pb-3">

          {/* Título + código */}
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => navigate('/lista')} className="text-gray-400 hover:text-gray-600 text-xl shrink-0">←</button>
            {editandoNombre ? (
              <input autoFocus value={nombreDraft} onChange={e => setNombreDraft(e.target.value)}
                onBlur={guardarNombre} onKeyDown={e => e.key === 'Enter' && guardarNombre()}
                className="flex-1 text-xl font-black tracking-tight bg-transparent border-b-2 border-green-select focus:outline-none" />
            ) : (
              <h1 className="flex-1 text-xl font-black tracking-tight truncate cursor-pointer"
                onClick={() => { setNombreDraft(lista.nombre); setEditandoNombre(true) }}>
                {lista.nombre}
              </h1>
            )}
            {listas.length > 0 && (
              <button onClick={abrirGestionar}
                className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-full px-2.5 py-1 text-xs font-semibold shrink-0 hover:border-green-select/50 hover:text-green-select transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
                {listas.length > 1 ? `${listas.findIndex(l => l.id === id) + 1}/${listas.length}` : 'Listas'}
              </button>
            )}
            <button onClick={copiarCodigo}
              className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/30 border border-green-select/30 text-green-select rounded-full px-3 py-1 text-xs font-bold shrink-0">
              <span>👥</span><span>{copiado ? t.lc_copiado : lista.codigo}</span>
            </button>
          </div>

          {/* Miembros + total */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {miembros.slice(0, 5).map(m => (
                <div key={m.usuario_id} className="flex items-center gap-1.5 group">
                  <Avatar url={perfilesMiembros[m.usuario_id]?.avatar_url}
                    emoji={perfilesMiembros[m.usuario_id]?.avatar_emoji} size="sm" />
                  <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                    {perfilesMiembros[m.usuario_id]?.nombre_display || 'Usuario'}
                    {m.rol === 'admin' && <span className="ml-1 text-[9px] text-green-select font-black">ADMIN</span>}
                  </span>
                  {esAdmin && m.usuario_id !== user?.id && (
                    <button
                      onClick={() => expulsarMiembro(m.usuario_id)}
                      title={t.lc_expulsar}
                      className="hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-red-100 dark:bg-red-900/40 text-red-400 hover:bg-red-200 hover:text-red-600 text-[10px] transition-colors"
                    >✕</button>
                  )}
                </div>
              ))}
              {esAdmin && solicitudes.length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{solicitudes.length}</span>
              )}
            </div>
            {/* Panel de solicitudes pendientes */}
            {esAdmin && solicitudes.length > 0 && (
              <div className="mb-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">{t.lc_solicitudes}</p>
                <div className="space-y-2">
                  {solicitudes.map(s => (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className="text-lg">{s.avatar_emoji ?? '👤'}</span>
                      <p className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{s.nombre_display ?? 'Usuario'}</p>
                      <button onClick={() => rechazarSolicitud(s.id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500">
                        {t.btn_rechazar}
                      </button>
                      <button onClick={() => aceptarSolicitud(s.id, s.usuario_id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-green-select text-white font-semibold">
                        {t.btn_aceptar}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(() => {
              const pres = lista?.presupuesto ?? 0
              const pasado = pres > 0 && totalEst > pres
              return (
                <div className="flex flex-col items-end">
                  {totalEst > 0 && (
                    <span className={`text-xl font-black ${pasado ? 'text-red-500' : 'text-green-select'}`}>
                      ~{totalEst.toFixed(2)} €
                    </span>
                  )}
                  <button onClick={() => { setPresupuestoDraft(lista?.presupuesto?.toString() ?? ''); setEditandoPresupuesto(true) }}
                    className={`text-xs transition-colors mt-0.5 ${pasado ? 'text-red-400' : 'text-gray-400 hover:text-gray-600'}`}>
                    {pasado ? `⚠️ +${(totalEst - pres).toFixed(2)} ${t.lc_del_limite}` : pres > 0 ? `de ${pres} €` : t.lc_mas_limite}
                  </button>
                </div>
              )
            })()}
          </div>

          {/* Lista a comprar — botones borrar+toggle */}
          {(porComprar.length > 0 || comprados.length > 0) && (
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => { if (porComprar.length > 0 && confirm('¿Borrar todos los artículos de la lista?')) { porComprar.forEach(i => eliminarItem(i.id)) } }}
                className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              >
                🗑 Borrar todo
              </button>
              <button
                onClick={() => setListaColapsada(v => !v)}
                className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <span className={`inline-block transition-transform duration-200 text-base ${listaColapsada ? '-rotate-90' : ''}`}>▾</span>
                {listaColapsada ? t.lista_mostrar(porComprar.length + comprados.length) : t.lista_esconder}
              </button>
            </div>
          )}

          {!listaColapsada && (porComprar.length > 0 || comprados.length > 0) && (
            <>
            <div className="max-h-72 overflow-y-auto space-y-3 mb-2">
              {itemsPorCategoria.map(([cat, catItems]) => (
                <div key={cat}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1 px-1">
                    {CAT_EMOJI[cat] ?? '📦'} {cat}
                  </p>
                  <div className="space-y-0.5">
                    {catItems.map(item => {
                      const enKg = item.unidad === 'kg'
                      const precioKg = precioKgDe(item.nombre)
                      const foto = infoItemLC.get(item.nombre)?.foto ?? null
                      return (
                        <div key={item.id} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors ${item.comprado ? 'bg-gray-50 dark:bg-gray-900 opacity-60' : 'bg-green-50 dark:bg-green-950/50'}`}>
                          <input type="checkbox" checked={item.comprado}
                            onChange={() => toggleComprado(item.id, !item.comprado)}
                            className="shrink-0 accent-green-select w-4 h-4" />
                          {foto
                            ? <img src={foto} alt="" loading="lazy" className="w-7 h-7 rounded-lg object-cover shrink-0 bg-gray-100 dark:bg-gray-800" onError={e => { e.currentTarget.style.display = 'none' }} />
                            : <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0 flex items-center justify-center text-sm">🛒</div>
                          }
                          <span className={`flex-1 text-xs font-medium truncate ${item.comprado ? 'line-through text-gray-300' : 'text-gray-800 dark:text-gray-200'}`}>
                            {item.nombre}
                          </span>
                          {!item.added_by || item.added_by === user?.id ? null : (
                            <Avatar url={perfilesMiembros[item.added_by]?.avatar_url}
                              emoji={perfilesMiembros[item.added_by]?.avatar_emoji} size="sm" className="opacity-60 shrink-0" />
                          )}
                          {/* Cantidad */}
                          <div className="flex items-center gap-1 shrink-0">
                            {precioKg != null && (
                              <div className="flex rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 text-[9px] font-bold">
                                <button onClick={() => enKg && toggleModoKg(item, precioKg, item.precio ?? 0)} className={`px-1.5 py-0.5 ${!enKg ? 'bg-green-select text-white' : 'text-gray-400'}`}>ud</button>
                                <button onClick={() => !enKg && toggleModoKg(item, precioKg, item.precio ?? 0)} className={`px-1.5 py-0.5 ${enKg ? 'bg-green-select text-white' : 'text-gray-400'}`}>kg</button>
                              </div>
                            )}
                            <button onClick={() => decrementar(item)} className="w-4 h-4 rounded-full border border-green-select text-green-select font-bold text-[10px] flex items-center justify-center leading-none">−</button>
                            <span className="text-[10px] font-bold text-green-select min-w-[1.8rem] text-center">
                              {enKg ? `${item.cantidad ?? DEFECTO_KG}kg` : `×${item.cantidad ?? 1}`}
                            </span>
                            <button onClick={() => incrementar(item, precioKg)} className="w-4 h-4 rounded-full border border-green-select text-green-select font-bold text-[10px] flex items-center justify-center leading-none">+</button>
                          </div>
                          {/* Precio */}
                          {editandoPrecio === item.id ? (
                            <form onSubmit={e => { e.preventDefault(); guardarPrecio(item.id) }} className="flex gap-1 items-center shrink-0">
                              <input autoFocus type="number" step="0.01" min="0" value={precioDraft}
                                onChange={e => setPrecioDraft(e.target.value)}
                                className="w-16 text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-0.5 bg-white dark:bg-gray-800" placeholder="0.00" />
                              <button type="submit" className="text-xs text-green-select font-bold">✓</button>
                              <button type="button" onClick={() => setEditandoPrecio(null)} className="text-xs text-gray-400">✕</button>
                            </form>
                          ) : (
                            <button onClick={() => { setEditandoPrecio(item.id); setPrecioDraft(item.precio?.toString() ?? '') }}
                              className="text-[10px] font-semibold text-gray-500 hover:text-green-select shrink-0 min-w-[40px] text-right">
                              {item.precio ? `${(item.precio * (item.cantidad ?? 1)).toFixed(2)} €` : <span className="text-gray-300">+€</span>}
                            </button>
                          )}
                          <button onClick={() => toggleEnCasa(item.id, !item.en_casa)} title={t.lista_tengo_casa} className="text-sm shrink-0 opacity-40 hover:opacity-100 transition-opacity">🏠</button>
                          <button onClick={() => eliminarItem(item.id)} className="text-gray-300 hover:text-red-400 shrink-0 text-xs transition-colors">✕</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            {comprados.length > 0 && (
              <button onClick={async () => { try { await Promise.all(comprados.map(i => eliminarItem(i.id))) } catch { /* item may already be deleted */ } }}
                className="w-full text-xs text-red-400 hover:text-red-600 py-1.5 mb-1 border border-red-100 dark:border-red-900 rounded-xl transition-colors">
                Limpiar comprados ({comprados.length})
              </button>
            )}
            {/* Input personalizado colapsable */}
            <ArticuloPersonalizado inputRef={inputRef} onAñadir={añadir} />
            </>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">

        {/* ── DEL MENÚ ESTA SEMANA ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center mb-2 gap-2">
            {ingredientesMenu.length > 0 && (
              <button onClick={vaciarMenu} title="Vaciar menú de la semana"
                className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors shrink-0">
                🗑
              </button>
            )}
            <button onClick={() => setAbiertoMenu(v => !v)} className="flex items-center flex-1 text-left gap-2 py-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t.lista_del_menu}</h2>
              {precioEstimadoMenu > 0 && (
                <span className="text-xs font-bold text-green-select">~{precioEstimadoMenu.toFixed(2)} €{t.lista_aprox}</span>
              )}
              <span className={`ml-auto w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm transition-transform duration-200 ${abiertoMenu ? 'rotate-0' : '-rotate-90'}`}>▾</span>
            </button>
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
                      const gruposFiltrados = grupos.filter(({ items: gi }) => !gi.some(i => menuEnCasa.has(i)))
                      if (!gruposFiltrados.length) return null
                      return (
                        <div key={cat}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                            {CAT_EMOJI[cat] ?? '📦'} {cat}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {gruposFiltrados.map(({ key, items: grupoItems, etiqueta }) => {
                              const enC = grupoItems.some(i => menuEnComprar.has(i))
                              const foto = grupoItems.map(i => infoIngredienteMenu.get(i)?.foto).find(f => f != null) ?? null
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
                                  <button onClick={() => enC ? quitarGrupoDeComprar(grupoItems) : abrirPicker(grupoItems, false)}
                                    className={`text-xs px-3 py-1.5 font-medium transition-colors ${enC ? 'bg-green-select text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50'}`}>
                                    {enC ? '✓' : '🛒'} {etiqueta}
                                  </button>
                                  <button onClick={() => abrirPicker(grupoItems, true)}
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
                  {gruposMenu.some(({ items: gi }) => gi.some(i => menuEnCasa.has(i))) && (
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
                  {gruposMenu.some(({ items: gi }) => gi.some(i => menuEnCasa.has(i))) && (
                    <div style={{ width: `${100 - menuSplitRatio}%` }} className="min-w-0 shrink-0 space-y-3 pl-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 text-right">🏠 En casa</p>
                      {gruposMenuPorCategoria.map(([cat, grupos]) => {
                        const gruposCasa = grupos.filter(({ items: gi }) => gi.some(i => menuEnCasa.has(i)))
                        if (!gruposCasa.length) return null
                        return (
                          <div key={cat}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5 text-right truncate">
                              {CAT_EMOJI[cat] ?? '📦'} {cat}
                            </p>
                            <div className="flex flex-col gap-1 items-end">
                              {gruposCasa.map(({ key, items: grupoItems, etiqueta }) => (
                                <button key={key}
                                  onClick={() => quitarGrupoDeCasa(grupoItems)}
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

        {/* ── EN CASA ───────────────────────────────────────────────────────── */}
        <EnCasaSection
            enCasa={new Set(enCasa.map(i => i.nombre))}
            catalogo={catalogo?.categorias}
            onRemove={nombre => { const it = enCasa.find(i => i.nombre === nombre); if (it) toggleEnCasa(it.id, false) }}
            enCarrito={new Set(items.filter(i => !i.en_casa).map(i => i.nombre))}
            onAddToCart={nombre => {
              let precio = 0
              if (catalogo?.categorias) {
                for (const prods of Object.values(catalogo.categorias)) {
                  const p = prods.find(p => p.nombre === nombre)
                  if (p?.precio) { precio = p.precio; break }
                }
              }
              añadirItem(nombre, { precio, cantidad: 1, unidad: 'ud' })
            }}
          />

        {/* ── CATÁLOGO MERCADONA ────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t.catalogo_titulo}</h2>
            {catalogo?.actualizado && (
              <span className="text-xs text-gray-400">
                {new Date(catalogo.actualizado).toLocaleDateString('es-ES')} · {catalogo.total_productos} productos
              </span>
            )}
          </div>

          {catalogo === null ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
              <span className="animate-spin inline-block">⏳</span> {t.catalogo_cargando}
            </div>
          ) : (
            <>
              {/* Buscador + selector de categoría */}
              <input type="text"
                placeholder={`${t.catalogo_buscar}${catActiva === TODO_CAT ? '' : ` en ${catActiva}`}...`}
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setLimite(PAGINA) }}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm mb-3 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-select" />
              <CategoriasSelector
                categorias={categorias}
                catActiva={catActiva}
                onSelect={cat => { setCatActiva(cat); setBusqueda(''); setLimite(PAGINA) }}
              />

              {/* Lista de productos */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                {productosVisibles.slice(0, limite).map(prod => {
                  const itemEnLista = itemPorNombre[prod.nombre]
                  const enC = !!itemEnLista
                  const esKg = itemEnLista?.unidad === 'kg'
                  const cantActual = itemEnLista?.cantidad ?? (esKg ? DEFECTO_KG : 1)
                  const precioMostrado = enC
                    ? (itemEnLista.precio ?? prod.precio) * cantActual
                    : prod.precio

                  return (
                    <div key={prod.id} className="flex items-center gap-2 px-3 py-2">
                      {prod.foto
                        ? <img src={prod.foto} alt={prod.nombre} onClick={() => setFotoAmpliada(prod.foto!)} className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-100 dark:bg-gray-800 cursor-zoom-in" loading="lazy" />
                        : <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0 flex items-center justify-center text-lg">🛒</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${enC ? 'text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>{prod.nombre}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1.5">
                          <span>{prod.tamaño > 0 ? `${prod.tamaño} ${prod.unidad}` : prod.unidad}</span>
                          {prod.precio_kg && <span>· {prod.precio_kg.toFixed(2)} €/kg</span>}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-red-600 shrink-0">{precioMostrado.toFixed(2)} €</span>
                      {enC ? (
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {prod.precio_kg && (
                            <div className="flex rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 text-[10px] font-bold">
                              <button onClick={() => esKg && toggleModoKg(itemEnLista, prod.precio_kg!, prod.precio)}
                                className={`px-2 py-0.5 transition-colors ${!esKg ? 'bg-green-select text-white' : 'text-gray-400 hover:text-gray-600'}`}>ud</button>
                              <button onClick={() => !esKg && toggleModoKg(itemEnLista, prod.precio_kg!, prod.precio)}
                                className={`px-2 py-0.5 transition-colors ${esKg ? 'bg-green-select text-white' : 'text-gray-400 hover:text-gray-600'}`}>kg</button>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <button onClick={() => decrementar(itemEnLista)}
                              className="w-7 h-7 rounded-full border-2 border-green-select text-green-select font-bold text-base flex items-center justify-center leading-none hover:bg-green-50 transition-colors">−</button>
                            <span className="text-center text-sm font-bold text-green-select min-w-[2.5rem]">
                              {esKg ? `${cantActual} kg` : cantActual}
                            </span>
                            <button onClick={() => incrementar(itemEnLista, prod.precio_kg)}
                              className="w-7 h-7 rounded-full border-2 border-green-select text-green-select font-bold text-base flex items-center justify-center leading-none hover:bg-green-50 transition-colors">+</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => añadirItemEnCasa(prod.nombre, prod.precio)}
                            className="text-base px-1.5 py-0.5 rounded-full border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors" title={t.lista_tengo_casa}>🏠</button>
                          <button onClick={() => añadir(prod.nombre, prod.precio, prod.unidad)}
                            className="text-xs px-2.5 py-1 rounded-full border border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600 shrink-0 transition-colors">🛒</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {limite < productosVisibles.length && (
                <button onClick={() => setLimite(l => l + PAGINA)}
                  className="w-full mt-2 py-2 text-sm text-gray-500 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900">
                  {t.ver_mas} ({productosVisibles.length - limite} restantes)
                </button>
              )}
            </>
          )}
        </div>

        {/* ── COMPARTIR ──────────────────────────────────────────────────────── */}
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-select/20 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-select mb-1">{t.lc_compartir}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">{t.lc_compartir_desc}</p>
          <button onClick={copiarCodigo}
            className="w-full flex items-center justify-between bg-white dark:bg-gray-800 border border-green-select/30 rounded-xl px-4 py-3">
            <span className="text-2xl font-black tracking-widest text-green-select">{lista.codigo}</span>
            <span className="text-sm text-green-select font-semibold">{copiado ? t.btn_copiado : t.lc_copiar_codigo}</span>
          </button>
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
              onKeyDown={e => e.key === 'Enter' && guardarPresupuesto()}
              placeholder="0.00"
              className="w-full text-4xl font-black text-center text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-5 mb-6 focus:outline-none focus:border-green-select"
            />
            <div className="flex gap-3">
              {(lista?.presupuesto ?? 0) > 0 && (
                <button onClick={() => { setPresupuestoDraft(''); guardarPresupuesto() }}
                  className="flex-1 py-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 text-gray-500 font-semibold text-sm">
                  {t.lc_quitar_limite}
                </button>
              )}
              <button onClick={guardarPresupuesto}
                className="flex-1 py-4 rounded-2xl bg-green-select text-white font-black text-lg shadow-lg active:scale-95 transition-transform">
                {t.btn_guardar}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PICKER DE PRODUCTO MERCADONA ──────────────────────────────────── */}
      {pickerIngrediente && (
        <PickerProductoMercadona
          ingrediente={pickerIngrediente.nombre}
          opciones={pickerOpciones}
          enCasa={pickerIngrediente.enCasa}
          catalogo={catalogo?.categorias}
          onSeleccionar={confirmarPicker}
          onCancelar={cerrarPicker}
        />
      )}

      {/* ── BOTTOM SHEET GESTIONAR LISTAS ─────────────────────────────────── */}
      {modalGestionar && createPortal(
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${sheetVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={cerrarGestionar}
          />
          {/* Sheet */}
          <div
            className={`relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${sheetVisible ? 'translate-y-0' : 'translate-y-full'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            <div className="px-6 pb-safe">
              <div className="flex items-center justify-between mb-4 pt-2">
                <div>
                  <h2 className="text-lg font-black text-gray-800 dark:text-gray-100">Listas compartidas</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Toca para cambiar · Mantén para hacer principal</p>
                </div>
                <button onClick={cerrarGestionar} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors text-sm">✕</button>
              </div>

              {/* Lista de listas */}
              <div className="space-y-2 mb-4">
                {listas.map(l => {
                  const esPrincipal = l.id === listaActivaId
                  const esActual = l.id === id
                  const confirmando = confirmEliminarLista === l.id
                  return (
                    <div key={l.id} className={`rounded-2xl border-2 overflow-hidden transition-colors ${esActual ? 'border-green-select/50 bg-green-50/50 dark:bg-green-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button onClick={() => setConfirmEliminarLista(confirmando ? null : l.id)}
                          className="text-red-400 hover:text-red-600 transition-colors p-1 shrink-0">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/>
                          </svg>
                        </button>
                        <button
                          className="flex-1 flex items-center gap-3 text-left min-w-0"
                          onClick={() => { cerrarGestionar(); if (!esActual) navigate(`/lista-compartida/${l.id}`) }}
                          onContextMenu={e => { e.preventDefault(); guardar('lista_compartida_principal', l.id); recargarListas() }}
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${esActual ? 'bg-green-100 dark:bg-green-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>👥</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{l.nombre}</p>
                            <p className="text-xs text-gray-400">{l.codigo} {esActual && '· actual'}</p>
                          </div>
                          {esPrincipal && (
                            <span className="text-[10px] text-green-select font-bold bg-green-50 dark:bg-green-900/30 border border-green-select/20 px-2 py-0.5 rounded-full shrink-0">
                              Principal
                            </span>
                          )}
                        </button>
                        {!esPrincipal && (
                          <button
                            onClick={() => { guardar('lista_compartida_principal', l.id); recargarListas() }}
                            className="text-[10px] text-gray-400 hover:text-green-select border border-gray-200 dark:border-gray-600 hover:border-green-select/40 px-2 py-1 rounded-full transition-colors shrink-0"
                          >Hacer principal</button>
                        )}
                      </div>
                      {confirmando && (
                        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 bg-red-50 dark:bg-red-900/20">
                          <p className="text-xs text-red-600 dark:text-red-400 mb-2">¿Salir de esta lista? Perderás el acceso.</p>
                          <div className="flex gap-2">
                            <button onClick={() => setConfirmEliminarLista(null)}
                              className="flex-1 text-xs py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500">Cancelar</button>
                            <button onClick={async () => {
                              await abandonarLista(l.id)
                              setConfirmEliminarLista(null)
                              if (esActual) { cerrarGestionar(); navigate('/lista') }
                              else cerrarGestionar()
                            }} className="flex-1 text-xs py-1.5 rounded-xl bg-red-500 text-white font-semibold">Salir</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Crear / unirse */}
              {modoCrear === null ? (
                <div className="flex gap-2 mb-6">
                  {listas.length < 2 && (
                    <button onClick={() => setModoCrear('crear')}
                      className="flex-1 flex items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl py-3 text-sm text-gray-400 hover:border-green-select/50 hover:text-green-select transition-colors">
                      + Nueva lista
                    </button>
                  )}
                  <button onClick={() => setModoCrear('unirse')}
                    className="flex-1 flex items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl py-3 text-sm text-gray-400 hover:border-green-select/50 hover:text-green-select transition-colors">
                    🔑 Unirme con código
                  </button>
                </div>
              ) : (
                <div className="mb-6 bg-gray-50 dark:bg-gray-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                      {modoCrear === 'crear' ? 'Nueva lista' : 'Unirse con código'}
                    </p>
                    <button onClick={() => { setModoCrear(null); setErrorCrear('') }} className="text-gray-400 text-sm">✕</button>
                  </div>
                  {modoCrear === 'crear' ? (
                    <>
                      <input autoFocus type="text" value={nombreNuevaLista} onChange={e => setNombreNuevaLista(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCrearLista()}
                        placeholder="Nombre de la lista…"
                        className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-select mb-2" />
                      {errorCrear && <p className="text-xs text-red-500 mb-2">{errorCrear}</p>}
                      <button onClick={handleCrearLista} disabled={!nombreNuevaLista.trim() || cargandoCrear}
                        className="w-full py-2.5 rounded-xl bg-green-select text-white font-bold text-sm disabled:opacity-40 transition-opacity">
                        {cargandoCrear ? 'Creando…' : 'Crear lista'}
                      </button>
                    </>
                  ) : (
                    <>
                      <input autoFocus type="text" value={codigoUnirse} onChange={e => setCodigoUnirse(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && handleUnirse()}
                        placeholder="Código de 6 letras…"
                        className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-select mb-2 uppercase tracking-widest" />
                      {errorCrear && <p className="text-xs text-red-500 mb-2">{errorCrear}</p>}
                      <button onClick={handleUnirse} disabled={!codigoUnirse.trim() || cargandoCrear}
                        className="w-full py-2.5 rounded-xl bg-green-select text-white font-bold text-sm disabled:opacity-40 transition-opacity">
                        {cargandoCrear ? 'Uniéndome…' : 'Unirme'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
