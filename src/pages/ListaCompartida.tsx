import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useListaCompartida } from '../hooks/useListaCompartida'
import { useAuth } from '../hooks/useAuth'
import { useAmigos } from '../hooks/useAmigos'
import { Avatar } from '../components/Avatar'
import { supabase } from '../lib/supabase'
import { recuperar } from '../lib/storage'
import {
  topMatchesMercadona, agruparIngredientes, resolverContraSet, etiquetaGrupo, nombreGuardadoComo as nombreGuardadoComoLib,
  type MatchProducto,
} from '../lib/matchMercadona'
import { PickerProductoMercadona } from '../components/PickerProductoMercadona'
import type { MenuSemanal } from '../types'

interface ProductoMercadona {
  id: string; nombre: string; precio: number; tamaño: number; unidad: string; foto?: string | null; precio_kg?: number | null
}
type CatalogoData = { categorias: Record<string, ProductoMercadona[]> }

const TODO_CAT = 'Todo'
const PASO_KG = 0.5
const DEFECTO_KG = 1
const PAGINA = 50

const CAT_EMOJI: Record<string, string> = {
  'Aceite, especias y salsas':'🫒','Agua y refrescos':'💧','Aperitivos':'🍿',
  'Arroz, legumbres y pasta':'🍝','Azúcar, caramelos y chocolate':'🍫','Bebé':'👶',
  'Bodega':'🍷','Cacao, café e infusiones':'☕','Carne':'🥩','Cereales y galletas':'🥣',
  'Charcutería y quesos':'🧀','Congelados':'🧊','Conservas, caldos y cremas':'🥫',
  'Cuidado del cabello':'💇','Cuidado facial y corporal':'🧴','Fitoterapia y parafarmacia':'💊',
  'Fruta y verdura':'🥦','Huevos, leche y mantequilla':'🥛','Limpieza y hogar':'🧹',
  'Maquillaje':'💄','Marisco y pescado':'🐟','Mascotas':'🐾','Panadería y pastelería':'🥖',
  'Pizzas y platos preparados':'🍕','Postres y yogures':'🍮','Zumos':'🍊',
}

export default function ListaCompartida() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    lista, items, miembros, loading, error,
    añadirItem, toggleComprado, toggleEnCasa,
    actualizarPrecio, actualizarCantidad, actualizarUnidadYCantidad, eliminarItem, renombrarLista, actualizarPresupuesto,
  } = useListaCompartida(id ?? null)

  const { amigos, invitarALista } = useAmigos()
  const [perfilesMiembros, setPerfilesMiembros] = useState<Record<string, { nombre_display?: string; avatar_emoji?: string; avatar_url?: string }>>({})

  // Catálogo
  const [catalogo, setCatalogo] = useState<CatalogoData | null>(null)
  const [catActiva, setCatActiva] = useState(TODO_CAT)
  const [busqueda, setBusqueda] = useState('')
  const [limite, setLimite] = useState(PAGINA)
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)

  // UI
  const [inputCustom, setInputCustom] = useState('')
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nombreDraft, setNombreDraft] = useState('')
  const [editandoPrecio, setEditandoPrecio] = useState<string | null>(null)
  const [precioDraft, setPrecioDraft] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [invitandoAmigo, setInvitandoAmigo] = useState<string | null>(null)
  const [errorInvitar, setErrorInvitar] = useState('')
  const [editandoPresupuesto, setEditandoPresupuesto] = useState(false)
  const [presupuestoDraft, setPresupuestoDraft] = useState('')
  const [pickerIngrediente, setPickerIngrediente] = useState<{ nombre: string; enCasa: boolean } | null>(null)
  const [pickerOpciones, setPickerOpciones] = useState<MatchProducto[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    import('../data/mercadona.json').then(m => setCatalogo(m.default as CatalogoData))
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
    if (!busqueda || busqueda.length < 2) return rawBase
    const palabras = busqueda.toLowerCase().split(/\s+/).filter(Boolean)
    return rawBase.filter(p => palabras.every(w => p.nombre.toLowerCase().includes(w)))
  }, [catalogo, catActiva, busqueda, todosDedup])

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

  async function handleInvitarAmigo(amigoId: string) {
    if (!id) return
    setInvitandoAmigo(amigoId); setErrorInvitar('')
    const { error } = await invitarALista(id, amigoId)
    setInvitandoAmigo(null)
    if (error) setErrorInvitar(error)
  }

  // ── Derivados ─────────────────────────────────────────────────────────────
  const porComprar = items.filter(i => !i.comprado && !i.en_casa)
  const comprados  = items.filter(i => i.comprado)
  const enCasa     = items.filter(i => i.en_casa)

  // ── Picker de producto Mercadona ──────────────────────────────────────────
  function abrirPicker(nombreOGrupo: string | string[], enCasa: boolean) {
    const nombres = Array.isArray(nombreOGrupo) ? nombreOGrupo : [nombreOGrupo]
    const etiqueta = nombres.length > 1 ? etiquetaGrupo(nombres) : nombres[0]
    if (!catalogo) { setPickerOpciones([]); setPickerIngrediente({ nombre: etiqueta, enCasa }); return }
    const vistos = new Set<string>()
    const opciones: MatchProducto[] = []
    for (const nombre of nombres) {
      for (const op of topMatchesMercadona(nombre, catalogo.categorias, 6)) {
        const key = `${op.nombre}__${op.precio}`
        if (vistos.has(key)) continue
        vistos.add(key)
        opciones.push(op)
      }
    }
    setPickerOpciones(opciones)
    setPickerIngrediente({ nombre: etiqueta, enCasa })
  }

  function confirmarPicker(producto: MatchProducto) {
    if (!pickerIngrediente) return
    añadirItem(producto.nombre, { precio: producto.precio }, pickerIngrediente.enCasa)
    setPickerIngrediente(null)
  }

  // ── Del menú esta semana ──────────────────────────────────────────────────
  const ingredientesMenu = useMemo(() => {
    const menu = recuperar<MenuSemanal>('menu_semana')
    if (!menu) return []
    const destino = recuperar<string>('menu_lista_destino')
    if (destino !== id) return []
    const nombres = new Set<string>()
    for (const receta of Object.values(menu)) {
      if (!receta) continue
      for (const ing of receta.ingredientes)
        nombres.add(ing.nombre.charAt(0).toUpperCase() + ing.nombre.slice(1).toLowerCase())
    }
    return Array.from(nombres).sort()
  }, [id])

  const gruposMenu = useMemo(() => agruparIngredientes(ingredientesMenu), [ingredientesMenu])

  // Nombres reales tal como están guardados en la lista compartida, separados
  // por si están para comprar o marcados en casa (mismo criterio que Lista.tsx).
  const comprarNombres = useMemo(() => new Set(items.filter(i => !i.en_casa).map(i => i.nombre)), [items])
  const enCasaNombres = useMemo(() => new Set(items.filter(i => i.en_casa).map(i => i.nombre)), [items])

  const menuEnComprar = useMemo(
    () => resolverContraSet(ingredientesMenu, comprarNombres, catalogo?.categorias),
    [ingredientesMenu, comprarNombres, catalogo],
  )
  const menuEnCasa = useMemo(
    () => resolverContraSet(ingredientesMenu, enCasaNombres, catalogo?.categorias),
    [ingredientesMenu, enCasaNombres, catalogo],
  )

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
      <button onClick={() => navigate('/lista')} className="text-green-select font-semibold">← Volver</button>
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
      <div className="sticky top-0 z-20 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
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
            <button onClick={copiarCodigo}
              className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/30 border border-green-select/30 text-green-select rounded-full px-3 py-1 text-xs font-bold shrink-0">
              <span>👥</span><span>{copiado ? '¡Copiado!' : lista.codigo}</span>
            </button>
          </div>

          {/* Miembros + total */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5">
                {miembros.slice(0, 5).map(m => (
                  <Avatar key={m.usuario_id} url={perfilesMiembros[m.usuario_id]?.avatar_url}
                    emoji={perfilesMiembros[m.usuario_id]?.avatar_emoji} size="sm" />
                ))}
              </div>
              <span className="text-xs text-gray-400">{miembros.length} miembro{miembros.length !== 1 ? 's' : ''}</span>
            </div>
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
                    {pasado ? `⚠️ +${(totalEst - pres).toFixed(2)} € del límite` : pres > 0 ? `de ${pres} €` : '+ límite'}
                  </button>
                </div>
              )
            })()}
          </div>

          {/* Lista a comprar */}
          {(porComprar.length > 0 || comprados.length > 0) && (
            <div className="max-h-64 overflow-y-auto space-y-1 mb-2">
              {[...porComprar, ...comprados].map(item => {
                const enKg = item.unidad === 'kg'
                const precioKg = precioKgDe(item.nombre)
                return (
                <div key={item.id} className={`rounded-xl px-3 py-2 transition-colors ${item.comprado ? 'bg-gray-50 dark:bg-gray-900' : 'bg-green-50 dark:bg-green-950/50'}`}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={item.comprado}
                      onChange={() => toggleComprado(item.id, !item.comprado)}
                      className="shrink-0 accent-green-select w-4 h-4" />
                    <span className={`flex-1 text-sm font-medium truncate ${item.comprado ? 'line-through text-gray-300' : 'text-gray-800 dark:text-gray-200'}`}>
                      {item.nombre}
                    </span>
                    {!item.added_by || item.added_by === user?.id ? null : (
                      <Avatar url={perfilesMiembros[item.added_by]?.avatar_url}
                        emoji={perfilesMiembros[item.added_by]?.avatar_emoji} size="sm" className="opacity-60 shrink-0" />
                    )}
                    {editandoPrecio === item.id ? (
                      <form onSubmit={e => { e.preventDefault(); guardarPrecio(item.id) }} className="flex gap-1 items-center shrink-0">
                        <input autoFocus type="number" step="0.01" min="0" value={precioDraft}
                          onChange={e => setPrecioDraft(e.target.value)}
                          className="w-20 text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-0.5 bg-white dark:bg-gray-800" placeholder="0.00" />
                        <button type="submit" className="text-xs text-green-select font-bold">✓</button>
                        <button type="button" onClick={() => setEditandoPrecio(null)} className="text-xs text-gray-400">✕</button>
                      </form>
                    ) : (
                      <button onClick={() => { setEditandoPrecio(item.id); setPrecioDraft(item.precio?.toString() ?? '') }}
                        className="text-xs font-semibold text-gray-500 hover:text-green-select shrink-0 min-w-[52px] text-right transition-colors">
                        {item.precio ? `${(item.precio * (item.cantidad ?? 1)).toFixed(2)} €` : <span className="text-gray-300 font-normal">+ precio</span>}
                      </button>
                    )}
                    <button onClick={() => toggleEnCasa(item.id, !item.en_casa)} title="Tengo esto en casa"
                      className="text-base shrink-0 opacity-50 hover:opacity-100 transition-opacity">🏠</button>
                    <button onClick={() => eliminarItem(item.id)} className="text-gray-300 hover:text-red-400 shrink-0 transition-colors">✕</button>
                  </div>

                  {/* Cantidad / kg */}
                  <div className="flex items-center gap-2 mt-1.5 ml-6">
                    {precioKg != null && (
                      <div className="flex rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 text-[10px] font-bold">
                        <button onClick={() => enKg && toggleModoKg(item, precioKg, item.precio ?? 0)}
                          className={`px-2 py-0.5 transition-colors ${!enKg ? 'bg-green-select text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                          ud
                        </button>
                        <button onClick={() => !enKg && toggleModoKg(item, precioKg, item.precio ?? 0)}
                          className={`px-2 py-0.5 transition-colors ${enKg ? 'bg-green-select text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                          kg
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => decrementar(item)}
                        className="w-5 h-5 rounded-full border border-green-select text-green-select font-bold text-xs flex items-center justify-center leading-none hover:bg-green-100 dark:hover:bg-green-900 transition-colors">
                        −
                      </button>
                      <span className="text-xs font-bold text-green-select min-w-[2.5rem] text-center">
                        {enKg ? `${item.cantidad ?? DEFECTO_KG} kg` : `×${item.cantidad ?? 1}`}
                      </span>
                      <button onClick={() => incrementar(item, precioKg)}
                        className="w-5 h-5 rounded-full border border-green-select text-green-select font-bold text-xs flex items-center justify-center leading-none hover:bg-green-100 dark:hover:bg-green-900 transition-colors">
                        +
                      </button>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          )}

          {comprados.length > 0 && (
            <button onClick={() => Promise.all(comprados.map(i => eliminarItem(i.id)))}
              className="w-full text-xs text-red-400 hover:text-red-600 py-1.5 mb-1 border border-red-100 dark:border-red-900 rounded-xl transition-colors">
              Limpiar comprados ({comprados.length})
            </button>
          )}

          {/* Input personalizado */}
          <div className="flex gap-2 mt-2">
            <input ref={inputRef} type="text" value={inputCustom}
              onChange={e => setInputCustom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && añadir(inputCustom)}
              placeholder="Añadir artículo..."
              className="flex-1 min-w-0 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-select" />
            <button onClick={() => añadir(inputCustom)} disabled={!inputCustom.trim()}
              className="text-sm bg-green-select text-white px-4 py-2 rounded-xl font-semibold shrink-0 hover:bg-green-700 transition-colors disabled:opacity-40">+</button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">

        {/* ── DEL MENÚ ESTA SEMANA ─────────────────────────────────────────── */}
        {ingredientesMenu.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">📋 Del menú esta semana</h2>
            <div className="bg-white dark:bg-gray-900 shadow-card rounded-card p-3 flex flex-wrap gap-1.5">
              {gruposMenu.map(({ key, items: grupoItems, etiqueta }) => {
                const enC = grupoItems.some(i => menuEnComprar.has(i))
                const enN = grupoItems.some(i => menuEnCasa.has(i))
                return (
                  <div key={key} className="flex rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                    <button
                      onClick={() => enC ? quitarGrupoDeComprar(grupoItems) : abrirPicker(grupoItems, false)}
                      className={`text-xs px-3 py-1.5 font-medium transition-colors ${enC ? 'bg-green-select text-white' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50'}`}>
                      {enC ? '✓' : '🛒'} <span className={enN ? 'line-through decoration-2' : ''}>{etiqueta}</span>
                    </button>
                    <button
                      onClick={() => enN ? quitarGrupoDeCasa(grupoItems) : abrirPicker(grupoItems, true)}
                      className={`text-xs px-2.5 py-1.5 border-l border-gray-200 dark:border-gray-700 transition-colors ${enN ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'bg-white dark:bg-gray-900 text-gray-400 hover:bg-gray-50'}`}>
                      {enN ? '✓' : '🏠'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── EN CASA ───────────────────────────────────────────────────────── */}
        {enCasa.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">🏠 En casa</h2>
            <div className="bg-white dark:bg-gray-900 shadow-card rounded-card p-3 flex flex-wrap gap-2">
              {enCasa.map(item => (
                <button key={item.id} onClick={() => toggleEnCasa(item.id, false)}
                  className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-800 hover:bg-blue-100 transition-colors">
                  {item.nombre} <span className="text-blue-300 text-xs leading-none">✕</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── CATÁLOGO MERCADONA ────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Catálogo Mercadona</h2>
            {catalogo && <span className="text-xs text-gray-400">{todosDedup.length} productos</span>}
          </div>

          {catalogo === null ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
              <span className="animate-spin inline-block">⏳</span> Cargando catálogo...
            </div>
          ) : (
            <>
              <input type="text" placeholder={`Buscar${catActiva === TODO_CAT ? '' : ` en ${catActiva}`}...`}
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setLimite(PAGINA) }}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm mb-3 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-select" />

              {/* Pills categorías */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {[TODO_CAT, ...categorias].map(cat => (
                  <button key={cat}
                    onClick={() => { setCatActiva(cat); setBusqueda(''); setLimite(PAGINA) }}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${catActiva === cat ? 'bg-green-select text-white shadow-sm' : 'bg-white dark:bg-gray-900 text-gray-500 border border-gray-200 dark:border-gray-700 hover:border-green-select hover:text-green-select'}`}>
                    {cat === TODO_CAT ? '🛒 Todo' : `${CAT_EMOJI[cat] ?? ''} ${cat}`}
                  </button>
                ))}
              </div>

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
                            className="text-base px-1.5 py-0.5 rounded-full border border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors" title="Tengo esto en casa">🏠</button>
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
                  Ver más ({productosVisibles.length - limite} restantes)
                </button>
              )}
            </>
          )}
        </div>

        {/* ── COMPARTIR ──────────────────────────────────────────────────────── */}
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-select/20 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-select mb-1">👥 Compartir esta lista</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Comparte el código con quien quieras. Pueden unirse desde "Listas compartidas" en su app.</p>
          <button onClick={copiarCodigo}
            className="w-full flex items-center justify-between bg-white dark:bg-gray-800 border border-green-select/30 rounded-xl px-4 py-3">
            <span className="text-2xl font-black tracking-widest text-green-select">{lista.codigo}</span>
            <span className="text-sm text-green-select font-semibold">{copiado ? '✓ Copiado' : 'Copiar'}</span>
          </button>
        </div>

        {/* ── INVITAR AMIGOS ─────────────────────────────────────────────────── */}
        {amigos.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-card p-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Invitar amigos</p>
            {errorInvitar && <p className="text-xs text-red-500 mb-2">{errorInvitar}</p>}
            <div className="space-y-2">
              {amigos.map(a => {
                const yaEsMiembro = miembros.some(m => m.usuario_id === a.otro?.id)
                return (
                  <div key={a.id} className="flex items-center gap-3">
                    <Avatar url={a.otro?.avatar_url} emoji={a.otro?.avatar_emoji} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.otro?.nombre_display || a.otro?.username || 'Amigo'}</p>
                    </div>
                    {yaEsMiembro ? (
                      <span className="text-xs text-green-select font-medium">✓ Ya está</span>
                    ) : (
                      <button onClick={() => a.otro && handleInvitarAmigo(a.otro.id)}
                        disabled={invitandoAmigo === a.otro?.id}
                        className="text-xs bg-green-select text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50">
                        {invitandoAmigo === a.otro?.id ? '...' : 'Invitar'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL PRESUPUESTO ─────────────────────────────────────────────── */}
      {editandoPresupuesto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setEditandoPresupuesto(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6" />
            <h2 className="text-lg font-black text-gray-800 dark:text-gray-100 mb-1">Presupuesto límite</h2>
            <p className="text-sm text-gray-400 mb-6">El total se pondrá en rojo si lo superas</p>
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
                  Quitar límite
                </button>
              )}
              <button onClick={guardarPresupuesto}
                className="flex-1 py-4 rounded-2xl bg-green-select text-white font-black text-lg shadow-lg active:scale-95 transition-transform">
                Guardar
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
          onSeleccionar={confirmarPicker}
          onCancelar={() => setPickerIngrediente(null)}
        />
      )}
    </div>
  )
}
