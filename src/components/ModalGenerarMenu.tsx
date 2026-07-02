import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { recuperar } from '../lib/storage'
import type { DificultadPreferida, Dia } from '../types'
import { DIAS, DIAS_LABEL } from '../types'

interface ProductoMercadona {
  id: string; nombre: string; precio: number; tamaño: number; unidad: string
}
type CatalogoMercadonaData = {
  categorias: Record<string, ProductoMercadona[]>
}

export interface ConfigGeneracion {
  cocina: string
  dificultad: string
  tiempo: string
  ocasion: string
  extra: string
  no_quiero: string
  modoIngredientes: 'libre' | 'nevera' | 'personalizada'
  ingredientesPersonalizados: string[]
  neveraItems?: string[]
  listaDestinoId: string | null
}

export interface ListaFuenteNevera {
  id: string
  nombre: string
}

type DiasConfig = 'semana' | 'laboral' | 'personalizado'
type FranjaConfig = 'ambas' | 'comida' | 'cena'

interface Props {
  dificultadPerfil: DificultadPreferida
  ingredientesNevera: string[]
  listasCompartidas?: ListaFuenteNevera[]
  diasConfig: DiasConfig
  diasPersonalizados: Set<Dia>
  franjaConfig: FranjaConfig
  onDiasConfigChange: (v: DiasConfig) => void
  onDiasPersonalizadosChange: (fn: (prev: Set<Dia>) => Set<Dia>) => void
  onFranjaConfigChange: (v: FranjaConfig) => void
  onConfirmar: (config: ConfigGeneracion) => void
  onCancelar: () => void
}

const OPCIONES_COCINA = [
  { value: 'española y mediterránea', emoji: '🥘' },
  { value: 'italiana',                emoji: '🍝' },
  { value: 'asiática',                emoji: '🍜' },
  { value: 'americana',               emoji: '🍔' },
  { value: 'mexicana',                emoji: '🌮' },
  { value: 'variada e internacional', emoji: '🌍' },
  { value: 'saludable y ligera',      emoji: '🥗' },
  { value: 'tradicional española',    emoji: '🍲' },
]

const OPCIONES_DIFICULTAD = [
  { value: 'combinado', emoji: '🎲', label: 'Combinado' },
  { value: 'fácil',     emoji: '😊', label: 'Fácil' },
  { value: 'media',     emoji: '👨‍🍳', label: 'Media' },
  { value: 'difícil',   emoji: '🔥', label: 'Difícil' },
]

const OPCIONES_TIEMPO = [
  { value: 'combinado',              emoji: '🎲', label: 'Combinado' },
  { value: 'rápido (menos de 30 min)', emoji: '⚡', label: 'Rápido' },
  { value: 'normal (30-60 min)',     emoji: '🕐', label: 'Normal' },
  { value: 'sin prisa (más de 1 hora)', emoji: '🍲', label: 'Sin prisa' },
]

const OPCIONES_OCASION = [
  { value: 'semana normal',             emoji: '📅', label: 'Semana normal' },
  { value: 'visita de amigos o familia', emoji: '👨‍👩‍👧', label: 'Con familia/amigos' },
  { value: 'cena romántica',            emoji: '🕯️', label: 'Romántica' },
  { value: 'comida con niños',          emoji: '👶', label: 'Con niños' },
  { value: 'semana de dieta',           emoji: '⚖️', label: 'Dieta' },
  { value: 'semana de caprichos',       emoji: '🎉', label: 'Caprichos' },
]

function PillSelector({
  opciones,
  value,
  onChange,
}: {
  opciones: { value: string; emoji: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
            value === o.value
              ? 'bg-green-select border-green-select text-white'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-green-select'
          }`}
        >
          <span>{o.emoji}</span>
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function ModalGenerarMenu({ dificultadPerfil, ingredientesNevera, listasCompartidas = [], diasConfig, diasPersonalizados, franjaConfig, onDiasConfigChange, onDiasPersonalizadosChange, onFranjaConfigChange, onConfirmar, onCancelar }: Props) {
  const [config, setConfig] = useState<ConfigGeneracion>({
    cocina: 'variada e internacional',
    dificultad: dificultadPerfil,
    tiempo: 'combinado',
    ocasion: 'semana normal',
    extra: '',
    no_quiero: '',
    modoIngredientes: 'libre',
    ingredientesPersonalizados: [],
    listaDestinoId: recuperar<string | null>('menu_lista_destino') ?? null,
  })

  // Lista activa: determina nevera fuente Y destino de la compra
  const [itemsNeveraCompartida, setItemsNeveraCompartida] = useState<string[]>([])
  const [cargandoCompartida, setCargandoCompartida] = useState(false)

  async function cargarItemsCompartida(id: string) {
    setCargandoCompartida(true)
    const { data } = await supabase
      .from('lista_compartida_items')
      .select('nombre')
      .eq('lista_id', id)
      .eq('en_casa', true)
    setItemsNeveraCompartida((data ?? []).map((r: { nombre: string }) => r.nombre))
    setCargandoCompartida(false)
  }

  async function seleccionarLista(id: string | null) {
    set('listaDestinoId', id)
    if (!id) { setItemsNeveraCompartida([]); return }
    await cargarItemsCompartida(id)
  }

  // Si se recuerda una lista compartida de la última vez, cargar sus
  // ingredientes en casa nada más abrir el modal (sin esperar a un clic).
  useEffect(() => {
    if (config.listaDestinoId) cargarItemsCompartida(config.listaDestinoId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const neveraActual = config.listaDestinoId ? itemsNeveraCompartida : ingredientesNevera

  // Catálogo Mercadona lazy
  const [catalogo, setCatalogo] = useState<CatalogoMercadonaData | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [inputCustom, setInputCustom] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (config.modoIngredientes === 'personalizada' && !catalogo) {
      import('../data/mercadona.json').then(m => setCatalogo(m.default as CatalogoMercadonaData))
    }
  }, [config.modoIngredientes, catalogo])

  // Al activar modo nevera, pre-cargar con los ingredientes guardados
  useEffect(() => {
    if (config.modoIngredientes === 'personalizada') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [config.modoIngredientes])

  const todos = useMemo<ProductoMercadona[]>(() =>
    catalogo ? Object.values(catalogo.categorias).flat() : [],
  [catalogo])

  const resultados = useMemo(() => {
    if (!busqueda.trim() || busqueda.length < 2) return []
    const q = busqueda.toLowerCase()
    return todos.filter(p => p.nombre.toLowerCase().includes(q)).slice(0, 12)
  }, [busqueda, todos])

  function set<K extends keyof ConfigGeneracion>(key: K, val: ConfigGeneracion[K]) {
    setConfig(prev => ({ ...prev, [key]: val }))
  }

  function añadirIngrediente(nombre: string) {
    const n = nombre.trim()
    if (!n) return
    if (config.ingredientesPersonalizados.includes(n)) return
    set('ingredientesPersonalizados', [...config.ingredientesPersonalizados, n])
    setBusqueda('')
    setInputCustom('')
  }

  function quitarIngrediente(nombre: string) {
    set('ingredientesPersonalizados', config.ingredientesPersonalizados.filter(i => i !== nombre))
  }

  function cargarNevera() {
    set('ingredientesPersonalizados', [...new Set([...config.ingredientesPersonalizados, ...neveraActual])])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h2 className="text-lg font-black tracking-tight">📅 Generar menú semanal</h2>
          <button onClick={onCancelar} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {/* Días y franjas */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">¿Para cuántos días?</p>
              <div className="flex gap-2">
                {([
                  { key: 'semana',        label: 'Semana completa' },
                  { key: 'laboral',       label: 'Lun – Vie' },
                  { key: 'personalizado', label: 'Personalizado' },
                ] as const).map(({ key, label }) => (
                  <button key={key} onClick={() => onDiasConfigChange(key)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${diasConfig === key ? 'border-green-select bg-green-50 dark:bg-green-900/30 text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                    {label}
                  </button>
                ))}
              </div>
              {diasConfig === 'personalizado' && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {DIAS.map(d => (
                    <button key={d}
                      onClick={() => onDiasPersonalizadosChange(prev => { const next = new Set(prev); next.has(d) ? next.delete(d) : next.add(d); return next })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-colors ${diasPersonalizados.has(d) ? 'border-green-select bg-green-50 dark:bg-green-900/30 text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                      {DIAS_LABEL[d].slice(0, 3)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">¿Qué comidas?</p>
              <div className="flex gap-2">
                {([
                  { key: 'ambas',  label: '🍽️ Comida y cena' },
                  { key: 'comida', label: '☀️ Solo comida' },
                  { key: 'cena',   label: '🌙 Solo cena' },
                ] as const).map(({ key, label }) => (
                  <button key={key} onClick={() => onFranjaConfigChange(key)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${franjaConfig === key ? 'border-green-select bg-green-50 dark:bg-green-900/30 text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800" />

          {/* Qué lista usar — aplica a las 3 opciones de ingredientes: define de
              dónde salen los "en casa" y a qué lista va la compra del menú */}
          {listasCompartidas.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-0.5">¿Qué lista quieres usar?</p>
              <p className="text-xs text-gray-400 mb-2">Ahí es donde irán los ingredientes en casa y la compra del menú</p>
              <div className="space-y-1.5">
                <button onClick={() => seleccionarLista(null)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-colors ${!config.listaDestinoId ? 'bg-green-50 dark:bg-green-900/20 border-green-select' : 'border-gray-200 dark:border-gray-700 hover:border-green-select/60'}`}>
                  <span className="text-lg">👤</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Mi lista personal</p>
                    <p className="text-xs text-gray-400">{ingredientesNevera.length} ingredientes en casa</p>
                  </div>
                  {!config.listaDestinoId && <span className="text-green-select">✓</span>}
                </button>
                {listasCompartidas.map(lista => (
                  <button key={lista.id} onClick={() => seleccionarLista(lista.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-colors ${config.listaDestinoId === lista.id ? 'bg-green-50 dark:bg-green-900/20 border-green-select' : 'border-gray-200 dark:border-gray-700 hover:border-green-select/60'}`}>
                    <span className="text-lg">👥</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{lista.nombre}</p>
                      <p className="text-xs text-gray-400">
                        {cargandoCompartida && config.listaDestinoId === lista.id ? 'Cargando...' : config.listaDestinoId === lista.id ? `${itemsNeveraCompartida.length} ingredientes en casa` : 'Lista compartida'}
                      </p>
                    </div>
                    {config.listaDestinoId === lista.id && !cargandoCompartida && <span className="text-green-select">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tipo de cocina */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tipo de cocina</p>
            <div className="grid grid-cols-2 gap-2">
              {OPCIONES_COCINA.map(o => (
                <button
                  key={o.value}
                  onClick={() => set('cocina', o.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium text-left transition-colors ${
                    config.cocina === o.value
                      ? 'bg-green-select border-green-select text-white'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-green-select'
                  }`}
                >
                  <span className="text-base">{o.emoji}</span>
                  <span className="truncate">{o.value}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dificultad */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Dificultad
              {config.dificultad === dificultadPerfil
                ? <span className="ml-2 text-xs text-gray-400 font-normal">(según tu configuración)</span>
                : <span className="ml-2 text-xs text-green-select font-normal">(modificado para esta semana)</span>
              }
            </p>
            <PillSelector opciones={OPCIONES_DIFICULTAD} value={config.dificultad} onChange={v => set('dificultad', v)} />
          </div>

          {/* Tiempo */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tiempo para cocinar</p>
            <PillSelector opciones={OPCIONES_TIEMPO} value={config.tiempo} onChange={v => set('tiempo', v)} />
          </div>

          {/* Ocasión */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ocasión de la semana</p>
            <PillSelector opciones={OPCIONES_OCASION} value={config.ocasion} onChange={v => set('ocasion', v)} />
          </div>

          {/* Preferencias libres */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">¿Algo que quieras comer? <span className="font-normal text-gray-400">(opcional)</span></p>
              <input
                type="text"
                value={config.extra}
                onChange={e => set('extra', e.target.value)}
                placeholder="Ej: quiero pasta, algo con salmón, una buena hamburguesa..."
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-select"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">¿Algo que NO quieras? <span className="font-normal text-gray-400">(opcional)</span></p>
              <input
                type="text"
                value={config.no_quiero}
                onChange={e => set('no_quiero', e.target.value)}
                placeholder="Ej: nada de pasta esta semana, sin marisco, sin picante..."
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-select"
              />
            </div>
          </div>

          {/* Ingredientes */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ingredientes a usar</p>
            <div className="grid grid-cols-1 gap-2">
              {([
                { value: 'libre',        emoji: '🤖', label: 'La IA elige libremente',         desc: 'Sin restricciones de ingredientes' },
                { value: 'nevera',       emoji: '🏠', label: 'Usar lo que tengo en casa',       desc: neveraActual.length ? `${neveraActual.length} ingredientes disponibles` : 'Sin ingredientes guardados aún' },
                { value: 'personalizada', emoji: '📝', label: 'Lista personalizada',             desc: 'Busca en Mercadona o añade lo que quieras' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => set('modoIngredientes', opt.value)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                    config.modoIngredientes === opt.value
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-select'
                      : 'border-gray-200 dark:border-gray-700 hover:border-green-select'
                  }`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{opt.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Lista personalizada — buscador + chips */}
            {config.modoIngredientes === 'personalizada' && (
              <div className="mt-3 space-y-3">
                {/* Botón cargar nevera */}
                {neveraActual.length > 0 && (
                  <button
                    onClick={cargarNevera}
                    className="text-xs text-green-select font-medium hover:underline"
                  >
                    + Cargar lo que tengo en casa ({neveraActual.length})
                  </button>
                )}

                {/* Buscador Mercadona */}
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder={catalogo ? 'Buscar en Mercadona...' : 'Cargando catálogo...'}
                    disabled={!catalogo}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-select"
                  />
                  {resultados.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-card-md max-h-44 overflow-y-auto">
                      {resultados.map(p => (
                        <button
                          key={p.id}
                          onClick={() => añadirIngrediente(p.nombre)}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{p.nombre}</span>
                          <span className="text-xs text-gray-400 shrink-0">{p.precio?.toFixed(2)}€</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input ingrediente personalizado */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputCustom}
                    onChange={e => setInputCustom(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); añadirIngrediente(inputCustom) } }}
                    placeholder="O escribe un ingrediente personalizado..."
                    className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-select"
                  />
                  <button
                    onClick={() => añadirIngrediente(inputCustom)}
                    className="px-4 py-2 bg-green-select text-white rounded-xl text-sm font-semibold"
                  >
                    +
                  </button>
                </div>

                {/* Chips ingredientes seleccionados */}
                {config.ingredientesPersonalizados.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {config.ingredientesPersonalizados.map(ing => (
                      <span
                        key={ing}
                        className="flex items-center gap-1 bg-green-50 dark:bg-green-900/30 text-green-select border border-green-select/20 text-xs px-2.5 py-1 rounded-full"
                      >
                        {ing}
                        <button onClick={() => quitarIngrediente(ing)} className="ml-0.5 text-green-select/60 hover:text-green-select leading-none">✕</button>
                      </span>
                    ))}
                  </div>
                )}

                {config.ingredientesPersonalizados.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">Busca o escribe ingredientes para añadirlos</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-gray-100 dark:border-gray-800 shrink-0 flex gap-3">
          <button
            onClick={onCancelar}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-xl py-3 text-sm font-medium text-gray-600 dark:text-gray-300"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar({ ...config, neveraItems: config.modoIngredientes === 'nevera' ? neveraActual : undefined })}
            disabled={config.modoIngredientes === 'personalizada' && config.ingredientesPersonalizados.length === 0}
            className="flex-2 flex-grow-[2] bg-green-select text-white rounded-xl py-3 text-sm font-bold hover:bg-green-600 disabled:opacity-40 transition-colors"
          >
            ✨ Generar menú
          </button>
        </div>
      </div>
    </div>
  )
}
