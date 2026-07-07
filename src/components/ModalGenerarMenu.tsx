import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { recuperar } from '../lib/storage'
import { useI18n } from '../hooks/useI18n'
import type { DificultadPreferida, Dia } from '../types'
import { DIAS, DIAS_LABEL } from '../types'
import { esNativo, mostrarAnuncioRewarded, mostrarAnuncioRewardedWeb } from '../lib/ads'

const PREMIUM_KEY = 'menu-semana-premium'
const DIAS_FIN_SEMANA: Dia[] = ['sabado', 'domingo']

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
  objetivo: string
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
  objetivoPerfil?: string
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

const OPCIONES_OBJETIVO = [
  { value: 'sin_restriccion', emoji: '🍽️', label: 'Sin restricciones' },
  { value: 'bajar_peso',      emoji: '⚖️', label: 'Bajar peso' },
  { value: 'mas_proteina',    emoji: '💪', label: 'Más proteína' },
  { value: 'vegetariano',     emoji: '🥦', label: 'Vegetariano' },
  { value: 'vegano',          emoji: '🌱', label: 'Vegano' },
  { value: 'sin_gluten',      emoji: '🌾', label: 'Sin gluten' },
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

export function ModalGenerarMenu({ dificultadPerfil, objetivoPerfil, ingredientesNevera, listasCompartidas = [], diasConfig, diasPersonalizados, franjaConfig, onDiasConfigChange, onDiasPersonalizadosChange, onFranjaConfigChange, onConfirmar, onCancelar }: Props) {
  const { t } = useI18n()
  const [premiumDesbloqueado, setPremiumDesbloqueado] = useState(() => localStorage.getItem(PREMIUM_KEY) === '1')
  const [mostrandoAdGate, setMostrandoAdGate] = useState<'semana' | null>(null)
  const [cargandoAnuncio, setCargandoAnuncio] = useState(false)

  async function verAnuncioYDesbloquear() {
    setCargandoAnuncio(true)
    try {
      const resultado = esNativo()
        ? await mostrarAnuncioRewarded()
        : await mostrarAnuncioRewardedWeb()
      if (resultado === 'recompensa') {
        localStorage.setItem(PREMIUM_KEY, '1')
        setPremiumDesbloqueado(true)
        // Aplicar selección bloqueada que quería hacer
        if (mostrandoAdGate === 'semana') onDiasConfigChange('semana')
        setMostrandoAdGate(null)
      } else {
        setMostrandoAdGate(null)
      }
    } finally {
      setCargandoAnuncio(false)
    }
  }

  function handleDiasConfigChange(key: DiasConfig) {
    if (key === 'semana' && !premiumDesbloqueado) {
      setMostrandoAdGate('semana')
      return
    }
    onDiasConfigChange(key)
  }

  function handleDiaPersonalizadoClick(d: Dia) {
    const esDiaFinde = DIAS_FIN_SEMANA.includes(d)
    if (esDiaFinde && !premiumDesbloqueado) {
      setMostrandoAdGate('semana')
      return
    }
    onDiasPersonalizadosChange(prev => {
      const next = new Set(prev)
      next.has(d) ? next.delete(d) : next.add(d)
      return next
    })
  }

  const [config, setConfig] = useState<ConfigGeneracion>({
    cocina: 'variada e internacional',
    dificultad: dificultadPerfil,
    tiempo: 'combinado',
    ocasion: 'semana normal',
    objetivo: objetivoPerfil ?? 'sin_restriccion',
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
      fetch('/mercadona.json').then(r => r.json()).then((d: CatalogoMercadonaData) => setCatalogo(d))
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
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 backdrop-blur-sm pt-4 sm:pt-0">
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-xl max-h-[92vh] flex flex-col mx-4 sm:mx-0">
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
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t.modal_para_cuantos_dias}</p>
              <div className="flex gap-2">
                {([
                  { key: 'semana',        label: t.modal_semana_completa, locked: !premiumDesbloqueado },
                  { key: 'laboral',       label: t.modal_lun_vie,         locked: false },
                  { key: 'personalizado', label: t.modal_personalizado,   locked: false },
                ] as const).map(({ key, label, locked }) => (
                  <button key={key} onClick={() => handleDiasConfigChange(key)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors relative ${diasConfig === key ? 'border-green-select bg-accent-light text-green-select' : locked ? 'border-gray-200 dark:border-gray-700 text-gray-400 opacity-70' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                    {locked && <span className="mr-0.5">🔒</span>}{label}
                  </button>
                ))}
              </div>
              {diasConfig === 'personalizado' && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {DIAS.map(d => {
                    const esFinde = DIAS_FIN_SEMANA.includes(d)
                    const locked = esFinde && !premiumDesbloqueado
                    return (
                      <button key={d}
                        onClick={() => handleDiaPersonalizadoClick(d)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-colors ${diasPersonalizados.has(d) ? 'border-green-select bg-accent-light text-green-select' : locked ? 'border-gray-200 dark:border-gray-700 text-gray-300 opacity-60' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                        {locked ? '🔒' : ''}{DIAS_LABEL[d].slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t.modal_que_comidas}</p>
              <div className="flex gap-2">
                {([
                  { key: 'ambas',  label: t.modal_comida_cena },
                  { key: 'comida', label: t.modal_solo_comida },
                  { key: 'cena',   label: t.modal_solo_cena },
                ] as const).map(({ key, label }) => (
                  <button key={key} onClick={() => onFranjaConfigChange(key)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${franjaConfig === key ? 'border-green-select bg-accent-light text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800" />


          {/* Tipo de cocina */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t.modal_tipo_cocina}</p>
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
              {t.modal_dificultad}
              {config.dificultad === dificultadPerfil
                ? <span className="ml-2 text-xs text-gray-400 font-normal">{t.modal_dificultad_config}</span>
                : <span className="ml-2 text-xs text-green-select font-normal">{t.modal_dificultad_mod}</span>
              }
            </p>
            <PillSelector opciones={OPCIONES_DIFICULTAD} value={config.dificultad} onChange={v => set('dificultad', v)} />
          </div>

          {/* Tiempo */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t.modal_tiempo}</p>
            <PillSelector opciones={OPCIONES_TIEMPO} value={config.tiempo} onChange={v => set('tiempo', v)} />
          </div>

          {/* Objetivo nutricional */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t.ajustes_objetivo}</p>
            <PillSelector opciones={OPCIONES_OBJETIVO} value={config.objetivo} onChange={v => set('objetivo', v)} />
          </div>

          {/* Preferencias libres */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t.modal_quieres_comer}</p>
              <input
                type="text"
                value={config.extra}
                onChange={e => set('extra', e.target.value)}
                placeholder={t.modal_quieres_comer_ph}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-select"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t.modal_no_quieres}</p>
              <input
                type="text"
                value={config.no_quiero}
                onChange={e => set('no_quiero', e.target.value)}
                placeholder={t.modal_no_quieres_ph}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-select"
              />
            </div>
          </div>

          {/* Ingredientes */}
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t.modal_ingredientes}</p>
            <div className="grid grid-cols-1 gap-2">
              {/* IA libre */}
              {(['libre', 'personalizada'] as const).map(val => {
                const opt = val === 'libre'
                  ? { emoji: '🤖', label: t.modal_ia_libre, desc: t.modal_ia_libre_desc }
                  : { emoji: '📝', label: t.modal_lista_personalizada, desc: t.modal_busca_escribe }
                return (
                  <button key={val} onClick={() => set('modoIngredientes', val)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-colors ${config.modoIngredientes === val ? 'bg-accent-light border-green-select' : 'border-gray-200 dark:border-gray-700 hover:border-green-select'}`}>
                    <span className="text-2xl">{opt.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{opt.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</p>
                    </div>
                  </button>
                )
              })}

              {/* Usar lo que tengo en casa — con selector de lista integrado */}
              <div className={`rounded-xl border-2 transition-colors ${config.modoIngredientes === 'nevera' ? 'bg-accent-light border-green-select' : 'border-gray-200 dark:border-gray-700'}`}>
                <button onClick={() => set('modoIngredientes', 'nevera')}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <span className="text-2xl">🏠</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t.modal_usar_casa}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {neveraActual.length ? `${neveraActual.length} ${t.modal_ingredientes_disponibles}` : t.modal_sin_ingredientes}
                    </p>
                  </div>
                </button>

                {/* Panel expandible cuando está seleccionado */}
                {config.modoIngredientes === 'nevera' && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Advertencia mínimo */}
                    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${neveraActual.length >= 8 ? 'bg-green-select/10 text-green-select' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'}`}>
                      <span className="shrink-0 mt-0.5">{neveraActual.length >= 8 ? '✓' : '⚠️'}</span>
                      <span>
                        {neveraActual.length >= 8
                          ? `Se generarán recetas usando tus ${neveraActual.length} ingredientes en casa.`
                          : `Necesitas al menos 8 artículos marcados como "en casa" en la lista seleccionada para que la IA genere menús variados (ahora: ${neveraActual.length}).`
                        }
                      </span>
                    </div>

                    {/* Selector de lista (solo si hay compartidas) */}
                    {listasCompartidas.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Usar ingredientes en casa de:</p>
                        <button onClick={() => seleccionarLista(null)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 text-left transition-colors ${!config.listaDestinoId ? 'bg-white dark:bg-gray-800 border-green-select' : 'bg-white/60 dark:bg-gray-800/40 border-gray-200 dark:border-gray-600 hover:border-green-select/60'}`}>
                          <span>👤</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t.modal_mi_lista}</p>
                            <p className="text-xs text-gray-400">{ingredientesNevera.length} {t.modal_en_casa_modal}</p>
                          </div>
                          {!config.listaDestinoId && <span className="text-green-select text-sm">✓</span>}
                        </button>
                        {listasCompartidas.map(lista => (
                          <button key={lista.id} onClick={() => seleccionarLista(lista.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 text-left transition-colors ${config.listaDestinoId === lista.id ? 'bg-white dark:bg-gray-800 border-green-select' : 'bg-white/60 dark:bg-gray-800/40 border-gray-200 dark:border-gray-600 hover:border-green-select/60'}`}>
                            <span>👥</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{lista.nombre}</p>
                              <p className="text-xs text-gray-400">
                                {cargandoCompartida && config.listaDestinoId === lista.id
                                  ? t.cargando
                                  : config.listaDestinoId === lista.id
                                    ? `${itemsNeveraCompartida.length} ${t.modal_en_casa_modal}`
                                    : t.modal_lista_compartida}
                              </p>
                            </div>
                            {config.listaDestinoId === lista.id && !cargandoCompartida && <span className="text-green-select text-sm">✓</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
                    {t.modal_cargar_casa} ({neveraActual.length})
                  </button>
                )}

                {/* Buscador Mercadona */}
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder={catalogo ? t.modal_buscar_mercadona : t.cargando}
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
                    placeholder={t.modal_ingrediente_personalizado}
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
                        className="flex items-center gap-1 bg-accent-light text-green-select border border-green-select/20 text-xs px-2.5 py-1 rounded-full"
                      >
                        {ing}
                        <button onClick={() => quitarIngrediente(ing)} className="ml-0.5 text-green-select/60 hover:text-green-select leading-none">✕</button>
                      </span>
                    ))}
                  </div>
                )}

                {config.ingredientesPersonalizados.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">{t.modal_busca_escribe}</p>
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
            {t.btn_cancelar}
          </button>
          <button
            onClick={() => onConfirmar({ ...config, neveraItems: config.modoIngredientes === 'nevera' ? neveraActual : undefined })}
            disabled={config.modoIngredientes === 'personalizada' && config.ingredientesPersonalizados.length === 0}
            className="flex-2 flex-grow-[2] bg-green-select text-white rounded-xl py-3 text-sm font-bold hover:bg-green-600 disabled:opacity-40 transition-colors"
          >
            {t.modal_generar}
          </button>
        </div>
        {/* Ad gate overlay */}
        {mostrandoAdGate && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/95 dark:bg-gray-900/95 rounded-2xl px-8 text-center gap-5">
            <div className="text-4xl">🔒</div>
            <div>
              <p className="text-base font-bold text-gray-800 dark:text-gray-100 mb-1">Contenido premium</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Ve un anuncio corto para desbloquear la semana completa (lunes–domingo) para siempre.</p>
            </div>
            {cargandoAnuncio ? (
              <div className="flex items-center gap-2 text-green-select text-sm font-medium">
                <span className="animate-spin">⏳</span> Cargando anuncio...
              </div>
            ) : (
              <button
                onClick={verAnuncioYDesbloquear}
                className="bg-green-select text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-green-600 transition-colors"
              >
                📺 Ver anuncio y desbloquear
              </button>
            )}
            <button onClick={() => setMostrandoAdGate(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
          </div>
        )}
      </div>
    </div>
  )
}
