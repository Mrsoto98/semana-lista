// src/pages/Menu.tsx
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CeldaMenu } from '../components/CeldaMenu'
import { ModalGenerarMenu, type ConfigGeneracion } from '../components/ModalGenerarMenu'
import { AnuncioRewarded } from '../components/AnuncioRewarded'
import { esNativo, mostrarAnuncioRewarded, mostrarAnuncioRewardedWeb } from '../lib/ads'
import { usePerfil } from '../hooks/usePerfil'
import { useListasCompartidas } from '../hooks/useListaCompartida'
import { usePreferencias } from '../hooks/usePreferencias'
import { useAnalytics } from '../hooks/useAnalytics'
import { guardar, recuperar } from '../lib/storage'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { guardarRecetasEnCache } from '../lib/recetasCache'
import { useI18n } from '../hooks/useI18n'
import type { Dia, Franja, OpcionesSlot, MenuSemanal, ClaveMenu, Receta } from '../types'
import { DIAS, DIAS_LABEL, FRANJAS } from '../types'

type EstadoCelda = 'idle' | 'cargando' | 'listo' | 'error' | 'vacio'
interface EstadoSlot { estado: EstadoCelda; datos?: OpcionesSlot }
type MapaEstados = Partial<Record<ClaveMenu, EstadoSlot>>
type MapaSeleccion = Partial<Record<ClaveMenu, number>>

interface SemanaGuardada {
  id: string; nombre: string; fecha: string; tipo: 'normal' | 'sorpresa'
  estados: MapaEstados; seleccion: MapaSeleccion
}

interface Cuestionario {
  cocina: string; tiempo: string; dificultad: string; ocasion: string; extra: string; no_quiero: string
  listaDestinoId: string | null
}

const CUESTIONARIO_INICIAL: Cuestionario = {
  cocina: 'combinado', tiempo: 'combinado',
  dificultad: 'combinado', ocasion: 'semana normal', extra: '', no_quiero: '',
  listaDestinoId: null,
}


function isoWeek(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function semanaKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-W${isoWeek(now)}`
}

function perfilConNevera(perfil: object, extraPrompt?: string, ingredientesEvitar: string[] = [], cocina?: string, objetivo?: string): object {
  const p = perfil as { nevera?: string[]; ingredientes_no?: string[] }
  return {
    ...perfil,
    nevera: [
      ...(p.nevera ?? []),
      ...(recuperar<string[]>('lista_nevera') ?? []),
    ].filter((v, i, a) => a.indexOf(v) === i),
    ingredientes_no: [
      ...(p.ingredientes_no ?? []),
      ...ingredientesEvitar,
    ].filter((v, i, a) => a.indexOf(v) === i),
    ...(extraPrompt ? { extra_instrucciones: extraPrompt } : {}),
    ...(cocina ? { cocina } : {}),
    ...(objetivo ? { objetivo } : {}),
  }
}

export default function Menu() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { perfil, loading: perfilLoading } = usePerfil()
  const { listas: listasCompartidas } = useListasCompartidas()
  const { dislikes, ingredientesEvitar, guardarPreferencia, quitarPreferencia } = usePreferencias()
  const { track } = useAnalytics()

  const [estados, setEstados] = useState<MapaEstados>(() => recuperar<MapaEstados>('menu_estados') ?? {})
  const [seleccion, setSeleccion] = useState<MapaSeleccion>(() => recuperar<MapaSeleccion>('menu_seleccion') ?? {})
  const [generando, setGenerando] = useState(false)
  const [modalGenerar, setModalGenerar] = useState(false)
  const [modalSorpresa, setModalSorpresa] = useState(false)

  const [cuestionario, setCuestionario] = useState<Cuestionario>(() => ({
    ...CUESTIONARIO_INICIAL,
    listaDestinoId: recuperar<string | null>('menu_lista_destino') ?? null,
  }))

  // Opción extra: máximo 4 slots pueden desbloquear una segunda opción (1 uso por slot)
  const LIMITE_SLOTS_EXTRA = 4
  const [slotsExtra, setSlotsExtra] = useState<Set<ClaveMenu>>(() => new Set(recuperar<ClaveMenu[]>('menu_slots_extra') ?? []))
  const [cargandoExtra, setCargandoExtra] = useState<Set<ClaveMenu>>(new Set())

  const [semanasGuardadas, setSemanasGuardadas] = useState<SemanaGuardada[]>(() => recuperar<SemanaGuardada[]>('semanas_guardadas') ?? [])
  const [modalGuardar, setModalGuardar] = useState(false)
  const [nombreGuardar, setNombreGuardar] = useState('')
  const [mostrarGuardadas, setMostrarGuardadas] = useState(false)
  const [mostrarFavoritas, setMostrarFavoritas] = useState(false)
  const [favoritas, setFavoritas] = useState<Receta[]>(() => recuperar<Receta[]>('recetas_favoritas') ?? [])
  const [favoritaDetalle, setFavoritaDetalle] = useState<Receta | null>(null)
  const [favoritaPasos, setFavoritaPasos] = useState<string[] | null>(null)
  const [favoritaPasosCargando, setFavoritaPasosCargando] = useState(false)
  const [datosSupabaseCargados, setDatosSupabaseCargados] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [generacionesMes, setGeneracionesMes] = useState<number>(() => {
    const raw = recuperar<string>('gen_semana') ?? ''
    const [sem, val] = raw.split(':')
    return sem === semanaKey() ? parseInt(val ?? '0', 10) : 0
  })
  const [generacionesAnuncio, setGeneracionesAnuncio] = useState<number>(() => {
    const hoy = new Date().toISOString().split('T')[0]
    const raw = recuperar<string>('gen_anuncio_v2') ?? ''
    const [dia, val] = raw.split(':')
    return dia === hoy ? parseInt(val ?? '0', 10) : 0
  })
  const [modalAnuncio, setModalAnuncio] = useState(false)
  const LIMITE_GENERACIONES = 2   // generaciones gratuitas por semana
  const LIMITE_ANUNCIO = 5        // generaciones extra por anuncio al día

  // Configuración de días y franjas a generar (persistida en localStorage)
  type DiasConfig = 'semana' | 'laboral' | 'personalizado'
  type FranjaConfig = 'ambas' | 'comida' | 'cena'
  const DIAS_LABORALES: Dia[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
  const [diasConfig, setDiasConfigRaw] = useState<DiasConfig>(() => recuperar<DiasConfig>('menu_dias_config') ?? 'laboral')
  const [diasPersonalizados, setDiasPersonalizadosRaw] = useState<Set<Dia>>(() => new Set(recuperar<Dia[]>('menu_dias_personalizados') ?? DIAS_LABORALES))
  const [franjaConfig, setFranjaConfigRaw] = useState<FranjaConfig>(() => recuperar<FranjaConfig>('menu_franja_config') ?? 'comida')

  function setDiasConfig(v: DiasConfig) { setDiasConfigRaw(v); guardar('menu_dias_config', v) }
  function setDiasPersonalizados(fn: (prev: Set<Dia>) => Set<Dia>) {
    setDiasPersonalizadosRaw(prev => { const next = fn(prev); guardar('menu_dias_personalizados', Array.from(next)); return next })
  }
  function setFranjaConfig(v: FranjaConfig) { setFranjaConfigRaw(v); guardar('menu_franja_config', v) }

  const DIAS_FIN_SEMANA: Dia[] = ['sabado', 'domingo']
  const [semanaDesbloqueada, setSemanaDesbloqueada] = useState(false)
  const [franjaDesbloqueada, setFranjaDesbloqueada] = useState(false)
  const [mostrandoAdGate, setMostrandoAdGate] = useState<'semana' | 'franja' | null>(null)
  const [cargandoAnuncioGate, setCargandoAnuncioGate] = useState(false)

  async function verAnuncioGate() {
    setCargandoAnuncioGate(true)
    try {
      const resultado = esNativo() ? await mostrarAnuncioRewarded() : await mostrarAnuncioRewardedWeb()
      if (resultado === 'recompensa') {
        if (mostrandoAdGate === 'semana') { setSemanaDesbloqueada(true); setDiasConfig('semana') }
        if (mostrandoAdGate === 'franja') { setFranjaDesbloqueada(true); setFranjaConfig('ambas') }
      }
    } finally {
      setCargandoAnuncioGate(false)
      setMostrandoAdGate(null)
    }
  }

  function handleDiasConfigPage(key: DiasConfig) {
    if (key === 'semana' && !semanaDesbloqueada) { setMostrandoAdGate('semana'); return }
    setDiasConfig(key)
  }

  function handleFranjaConfigPage(key: FranjaConfig) {
    if (key === 'ambas' && !franjaDesbloqueada) { setMostrandoAdGate('franja'); return }
    setFranjaConfig(key)
  }

  function handleDiaPersonalizadoPage(d: Dia) {
    if (DIAS_FIN_SEMANA.includes(d) && !semanaDesbloqueada) { setMostrandoAdGate('semana'); return }
    setDiasPersonalizados(prev => { const next = new Set(prev); next.has(d) ? next.delete(d) : next.add(d); return next })
  }

  function diasActivos(): Dia[] {
    if (diasConfig === 'semana') return DIAS
    if (diasConfig === 'laboral') return DIAS_LABORALES
    return DIAS.filter(d => diasPersonalizados.has(d))
  }
  function franjasActivas(): Franja[] {
    if (franjaConfig === 'comida') return ['comida']
    if (franjaConfig === 'cena') return ['cena']
    return ['comida', 'cena']
  }

  // Cargar favoritas y semanas guardadas desde Supabase al iniciar sesión
  useEffect(() => {
    if (!user || datosSupabaseCargados) return
    supabase.from('perfiles').select('recetas_favoritas, semanas_guardadas, generaciones_mes, generaciones_reset').eq('usuario_id', user.id).maybeSingle().then(({ data }) => {
      if (!data) { setDatosSupabaseCargados(true); return }
      const favs = (data as { recetas_favoritas?: Receta[] }).recetas_favoritas
      const sems = (data as { semanas_guardadas?: SemanaGuardada[] }).semanas_guardadas
      if (Array.isArray(favs) && favs.length > 0) {
        setFavoritas(favs)
        guardar('recetas_favoritas', favs)
      }
      if (Array.isArray(sems) && sems.length > 0) {
        setSemanasGuardadas(sems)
        guardar('semanas_guardadas', sems)
      }
      // Contador de generaciones: resetear solo si es semana nueva en DB Y en localStorage
      const reset = (data as { generaciones_reset?: string }).generaciones_reset
      const gens = (data as { generaciones_mes?: number }).generaciones_mes ?? 0
      const semanaActual = semanaKey()
      // Leer localStorage ANTES de decidir si resetear — actúa como veto anti-reset
      const rawLS = recuperar<string>('gen_semana') ?? ''
      const [semLS, valLS] = rawLS.split(':')
      const gensLS = semLS === semanaActual ? parseInt(valLS ?? '0', 10) : 0
      // Semana nueva según DB
      const dbEsNuevaSemana = !reset || isoWeek(new Date(reset)) !== isoWeek(new Date()) || new Date(reset).getFullYear() !== new Date().getFullYear()
      // Solo resetear si AMBAS fuentes dicen que es semana nueva.
      // Si localStorage aún tiene conteo de esta semana, el usuario ya generó → no resetear.
      const esNuevaSemana = dbEsNuevaSemana && semLS !== semanaActual
      if (esNuevaSemana) {
        supabase.from('perfiles').update({ generaciones_mes: 0, generaciones_reset: new Date().toISOString().split('T')[0] }).eq('usuario_id', user.id)
        setGeneracionesMes(0)
        setGeneracionesAnuncio(0)
        guardar('gen_semana', semanaActual + ':0')
        guardar('gen_anuncio_v2', semanaActual + ':0')
      } else {
        // Tomar el máximo entre DB y localStorage (el más alto es el correcto)
        const gensFinal = Math.max(gens, gensLS)
        setGeneracionesMes(gensFinal)
        // Sincronizar DB si localStorage tiene más (el update anterior falló)
        if (gensLS > gens) {
          supabase.from('perfiles').update({ generaciones_mes: gensLS, generaciones_reset: new Date().toISOString().split('T')[0] }).eq('usuario_id', user.id)
        }
        guardar('gen_semana', semanaActual + ':' + gensFinal)
      }
      setDatosSupabaseCargados(true)
    })
  }, [user, datosSupabaseCargados])

  const favoritasNombres = new Set(favoritas.map(r => r.nombre))

  function toggleFavorita(receta: Receta) {
    const yaEsta = favoritasNombres.has(receta.nombre)
    const next = yaEsta ? favoritas.filter(r => r.nombre !== receta.nombre) : [receta, ...favoritas]
    setFavoritas(next)
    guardar('recetas_favoritas', next)
    if (user) supabase.from('perfiles').update({ recetas_favoritas: next }).eq('usuario_id', user.id).then(({ error }) => { if (error) console.error('guardar favoritas:', error.message) })
    if (!yaEsta) track('receta_favorita', { receta: receta.nombre })
  }

  async function abrirFavoritaDetalle(r: Receta) {
    setFavoritaDetalle(r)
    setFavoritaPasos(null)
    setFavoritaPasosCargando(true)
    try {
      const { data } = await supabase.functions.invoke('generar-recetas', {
        body: { action: 'pasos', nombre: r.nombre, ingredientes: r.ingredientes, descripcion: r.descripcion_corta, lang },
      })
      setFavoritaPasos((data as { pasos: string[] })?.pasos ?? [])
    } catch { setFavoritaPasos(null) }
    setFavoritaPasosCargando(false)
  }

  function handleDislike(receta: Receta, ingredientes: string[], motivo: string) {
    guardarPreferencia(receta.nombre, 'dislike', motivo || undefined, ingredientes)
    track('receta_dislike', { receta: receta.nombre, ingredientes_count: ingredientes.length })
  }

  function handleQuitarDislike(receta: Receta) {
    quitarPreferencia(receta.nombre)
  }

  useEffect(() => { guardar('menu_estados', estados) }, [estados])
  useEffect(() => { guardar('menu_seleccion', seleccion) }, [seleccion])

  // Restaurar último menú desde Supabase si localStorage está vacío
  useEffect(() => {
    if (!user || perfilLoading) return
    const hayMenu = Object.values(estados).some(e => e?.estado === 'listo')
    if (hayMenu) return
    supabase.from('perfiles').select('ultimo_menu').eq('usuario_id', user.id).maybeSingle().then(({ data }) => {
      const um = (data as { ultimo_menu?: { estados: MapaEstados; seleccion: MapaSeleccion } | null })?.ultimo_menu
      if (um?.estados && Object.values(um.estados).some(e => (e as EstadoSlot)?.estado === 'listo')) {
        setEstados(um.estados)
        setSeleccion(um.seleccion ?? {})
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, perfilLoading])

  async function guardarMenuEnSupabase(e: MapaEstados, s: MapaSeleccion) {
    if (!user) return
    await supabase.from('perfiles').update({ ultimo_menu: { estados: e, seleccion: s } }).eq('usuario_id', user.id)
  }

  // Pone todos los slots en cargando, luego hace una sola llamada a la API
  async function generarSemanaCompleta(extraPrompt?: string, cocina?: string, objetivo?: string) {
    if (!perfil || generando) return
    if (generacionesMes >= LIMITE_GENERACIONES && generacionesAnuncio >= LIMITE_ANUNCIO) {
      setErrorMsg('Has usado todas las generaciones de esta semana. Vuelve el lunes 🗓️')
      return
    }
    setGenerando(true)
    setSlotsExtra(new Set())
    guardar('menu_slots_extra', [])

    // Marcar solo las celdas seleccionadas como cargando, el resto vacío
    const activeDias = diasActivos()
    const activeFranjas = franjasActivas()
    const todoCargando: MapaEstados = {}
    for (const dia of DIAS) for (const franja of FRANJAS) {
      const clave = `${dia}_${franja}` as ClaveMenu
      todoCargando[clave] = activeDias.includes(dia) && activeFranjas.includes(franja)
        ? { estado: 'cargando' }
        : { estado: 'vacio' } as unknown as MapaEstados[ClaveMenu]
    }
    setEstados(todoCargando)

    let recetasYaUsadas: string[] = []
    try {
      const { supabase } = await import('../lib/supabase')
      const { data } = await supabase.from('historial_recetas').select('nombre_receta').order('fecha_uso', { ascending: false }).limit(20)
      recetasYaUsadas = (data ?? []).map((r: { nombre_receta: string }) => r.nombre_receta)
    } catch { /* best effort */ }

    try {
      const { supabase } = await import('../lib/supabase')
      const { data, error: fnError } = await supabase.functions.invoke('generar-recetas', {
        body: {
          perfil: perfilConNevera(perfil, extraPrompt, ingredientesEvitar, cocina, objetivo),
          recetas_ya_usadas: recetasYaUsadas,
          dias: activeDias,
          franjas: activeFranjas,
          lang,
        },
      })
      if (fnError) throw new Error(fnError.message)
      if (data?.error) throw new Error(data.mensaje)

      const semana: Record<string, { opciones: unknown[] }> = (data as { semana?: Record<string, { opciones: unknown[] }> }).semana ?? {}
      const nuevosEstados: MapaEstados = { ...todoCargando }
      const nuevaSeleccion: MapaSeleccion = {}

      for (const dia of DIAS) {
        for (const franja of FRANJAS) {
          const clave = `${dia}_${franja}` as ClaveMenu
          if (!activeDias.includes(dia) || !activeFranjas.includes(franja)) continue
          const slot = semana[clave]
          if (slot?.opciones?.length) {
            nuevosEstados[clave] = { estado: 'listo', datos: slot as OpcionesSlot }
            nuevaSeleccion[clave] = 0
          } else {
            nuevosEstados[clave] = { estado: 'error' }
          }
        }
      }
      setEstados(nuevosEstados)
      setSeleccion(nuevaSeleccion)
      guardarMenuEnSupabase(nuevosEstados, nuevaSeleccion)
      // Guardar todas las recetas generadas en la caché global
      const todasRecetas = Object.values(nuevosEstados)
        .filter(e => e?.estado === 'listo')
        .flatMap(e => (e as { datos?: OpcionesSlot }).datos?.opciones ?? []) as Receta[]
      if (todasRecetas.length) guardarRecetasEnCache(todasRecetas)
      track('menu_generado', { slots: Object.keys(nuevosEstados).filter(k => nuevosEstados[k as ClaveMenu]?.estado === 'listo').length })
      // Incrementar contador de generaciones (libre o bonus anuncio)
      if (generacionesMes < LIMITE_GENERACIONES) {
        const nuevasGens = generacionesMes + 1
        setGeneracionesMes(nuevasGens)
        guardar('gen_semana', `${semanaKey()}:${nuevasGens}`)
        if (user) supabase.from('perfiles').update({ generaciones_mes: nuevasGens, generaciones_reset: new Date().toISOString().split('T')[0] }).eq('usuario_id', user.id)
      } else {
        const nuevasGensAnuncio = generacionesAnuncio + 1
        setGeneracionesAnuncio(nuevasGensAnuncio)
        guardar('gen_anuncio_v2', `${new Date().toISOString().split('T')[0]}:${nuevasGensAnuncio}`)
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Error desconocido'
      const msg = raw.includes('429') || raw.includes('rate') || raw.includes('TPM')
        ? 'Demasiadas peticiones al generador de recetas. Espera 1 minuto e inténtalo de nuevo.'
        : raw.includes('JSON') || raw.includes('inválido')
        ? 'El modelo devolvió una respuesta inesperada. Vuelve a intentarlo.'
        : raw.includes('network') || raw.includes('fetch')
        ? 'Sin conexión a internet. Comprueba tu red e inténtalo de nuevo.'
        : raw.includes('401') || raw.includes('403')
        ? 'Sesión expirada. Recarga la página e inicia sesión de nuevo.'
        : raw
      setErrorMsg(msg)
      const todoError: MapaEstados = {}
      for (const dia of DIAS) for (const franja of FRANJAS) {
        const clave = `${dia}_${franja}` as ClaveMenu
        todoError[clave] = activeDias.includes(dia) && activeFranjas.includes(franja) ? { estado: 'error' } : { estado: 'vacio' } as unknown as MapaEstados[ClaveMenu]
      }
      setEstados(todoError)
    }
    setGenerando(false)
  }

  // Regenerar una sola celda
  async function regenerarSlot(dia: Dia, franja: Franja) {
    if (!perfil) return
    const clave: ClaveMenu = `${dia}_${franja}`
    setEstados(prev => ({ ...prev, [clave]: { estado: 'cargando' } }))
    try {
      const { supabase } = await import('../lib/supabase')
      const { data, error: fnError } = await supabase.functions.invoke('generar-recetas', {
        body: { dia, franja, perfil: perfilConNevera(perfil, undefined, ingredientesEvitar), recetas_ya_usadas: [], lang },
      })
      if (fnError) throw new Error(fnError.message)
      if (data?.error) throw new Error(data.mensaje)
      setEstados(prev => {
        const next = { ...prev, [clave]: { estado: 'listo' as EstadoCelda, datos: data as OpcionesSlot } }
        guardarMenuEnSupabase(next, { ...seleccion, [clave]: 0 })
        return next
      })
      setSeleccion(prev => ({ ...prev, [clave]: 0 }))
    } catch (err) {
      setEstados(prev => ({ ...prev, [clave]: { estado: 'error' } }))
      setErrorMsg(err instanceof Error ? err.message : 'Error regenerando la receta')
    }
  }

  // Añade una segunda opción a una celda que ya tiene 1 receta.
  // Máximo LIMITE_SLOTS_EXTRA slots distintos, 1 uso por slot.
  async function añadirOpcionExtra(dia: Dia, franja: Franja) {
    if (!perfil) return
    const clave: ClaveMenu = `${dia}_${franja}`
    const recetaActual = estados[clave]?.datos?.opciones[0]
    if (!recetaActual) return
    if (slotsExtra.has(clave) || slotsExtra.size >= LIMITE_SLOTS_EXTRA) return

    setCargandoExtra(prev => new Set(prev).add(clave))
    try {
      const { supabase } = await import('../lib/supabase')
      const { data, error: fnError } = await supabase.functions.invoke('generar-recetas', {
        body: {
          dia, franja, accion: 'opcion_extra', receta_existente: recetaActual.nombre,
          perfil: perfilConNevera(perfil, undefined, ingredientesEvitar), lang,
        },
      })
      if (fnError) throw new Error(fnError.message)
      if (data?.error) throw new Error(data.mensaje)
      const nuevaReceta = data.receta as Receta
      setEstados(prev => {
        const actual = prev[clave]
        if (!actual?.datos) return prev
        return { ...prev, [clave]: { ...actual, datos: { ...actual.datos, opciones: [...actual.datos.opciones, nuevaReceta] } } }
      })
      setSlotsExtra(prev => {
        const next = new Set(prev).add(clave)
        guardar('menu_slots_extra', Array.from(next))
        return next
      })
    } catch {
      // silencioso: la celda se queda con su única opción si falla
    } finally {
      setCargandoExtra(prev => { const n = new Set(prev); n.delete(clave); return n })
    }
  }

  async function generarSorpresa() {
    if (!perfil || generando) return
    setModalSorpresa(false)
    guardar('menu_lista_destino', cuestionario.listaDestinoId)
    track('menu_sorpresa', { cocina: cuestionario.cocina })

    const estilosSorpresa: Record<string, string> = {
      'combinado':               '',
      'aleatorio':               '',
      'española y mediterránea': 'española y mediterránea: paella, gazpacho, tortilla española, cocido madrileño, pisto manchego, bacalao al pil-pil, gambas al ajillo, ensalada mixta, merluza a la romana',
      'italiana':                'italiana: pasta carbonara, risotto, lasaña, gnocchi al pesto, ossobuco, bruschetta, pollo alla parmigiana, pasta arrabiata, sopa minestrone',
      'asiática':                'asiática: arroz frito wok, curry de pollo, ramen, pad thai, pollo teriyaki, gyozas, rollitos, salteado de verduras, cerdo agridulce',
      'americana':               'americana: hamburguesas caseras, BBQ de costillas, mac & cheese, wraps de pollo, chili con carne, chicken nuggets, alitas buffalo, burritos',
      'mexicana':                'mexicana: tacos, enchiladas, quesadillas, pozole, chiles rellenos, burritos, fajitas, guacamole con pollo, arroz a la mexicana',
      'variada e internacional': 'variada internacional: mezcla de cocinas del mundo, un plato diferente cada día',
      'saludable y ligera':      'saludable y ligera: ensaladas, verduras al vapor o horno, proteína magra, sin fritos, bowl de quinoa, wraps integrales',
      'tradicional española':    'tradicional española de cuchara: cocido, fabada, lentejas con chorizo, potaje, puchero, estofado de ternera, arroz con leche de postre',
    }

    const esCombinado = cuestionario.cocina === 'combinado'
    const esAleatorio = cuestionario.cocina === 'aleatorio'
    const estiloDesc = estilosSorpresa[cuestionario.cocina] ?? `cocina ${cuestionario.cocina}`

    const dificultadExtra: Record<string, string> = {
      'fácil':     'Todas las recetas de esta semana deben ser fáciles (≤30 min, técnicas simples, pocos pasos).',
      'media':     'Recetas de dificultad media (30-60 min, técnicas habituales).',
      'difícil':   'Recetas elaboradas y de alta dificultad (+45 min, técnicas avanzadas, presentación cuidada).',
      'combinado': '',
    }
    const tiempoExtra: Record<string, string> = {
      'rápido (menos de 30 min)':  'TIEMPO: todas las recetas en menos de 30 minutos desde que empiezas hasta que sirves.',
      'normal (30-60 min)':        'TIEMPO: recetas de 30 a 60 minutos de preparación.',
      'sin prisa (más de 1 hora)': 'TIEMPO: recetas de cocción lenta, guisos y elaboradas de más de 1 hora. Prioriza sabores profundos.',
      'combinado':                 '',
    }

    const partes = [
      esCombinado ? 'COCINA: varía el estilo cada día (española, italiana, asiática, americana...). Que cada jornada tenga sabores distintos.' :
      esAleatorio ? 'Elige tú libremente el estilo de cada día, sorpréndeme con variedad total.' :
      `COCINA OBLIGATORIA: TODAS las recetas deben ser de ${estiloDesc}. Nada fuera de este estilo.`,
      dificultadExtra[cuestionario.dificultad] ?? '',
      tiempoExtra[cuestionario.tiempo] ?? '',
      cuestionario.extra ? `EL USUARIO QUIERE: ${cuestionario.extra}.` : '',
      cuestionario.no_quiero ? `EXCLUIR COMPLETAMENTE: ${cuestionario.no_quiero}.` : '',
    ].filter(Boolean).join(' ')

    await generarSemanaCompleta(partes, esCombinado || esAleatorio ? undefined : cuestionario.cocina)
  }

  const ESTILOS_COCINA: Record<string, string> = {
    'española y mediterránea': 'española y mediterránea: paella, gazpacho, tortilla española, cocido madrileño, pisto manchego, bacalao al pil-pil, gambas al ajillo, ensalada mixta, merluza a la romana',
    'italiana': 'italiana: pasta carbonara, risotto, lasaña, gnocchi al pesto, ossobuco, bruschetta, pollo alla parmigiana, pasta arrabiata, sopa minestrone',
    'asiática': 'asiática: arroz frito wok, curry de pollo, ramen, pad thai, pollo teriyaki, gyozas, rollitos, salteado de verduras, cerdo agridulce',
    'americana': 'americana: hamburguesas caseras, BBQ de costillas, mac & cheese, wraps de pollo, chili con carne, chicken nuggets, alitas buffalo, burritos',
    'mexicana': 'mexicana: tacos, enchiladas, quesadillas, pozole, chiles rellenos, burritos, fajitas, guacamole con pollo, arroz a la mexicana',
    'variada e internacional': 'variada internacional: mezcla de cocinas del mundo, un plato diferente cada día',
    'saludable y ligera': 'saludable y ligera: ensaladas, verduras al vapor o horno, proteína magra, sin fritos, bowl de quinoa, wraps integrales',
    'tradicional española': 'tradicional española de cuchara: cocido, fabada, lentejas con chorizo, potaje, puchero, estofado de ternera, arroz con leche de postre',
  }
  const DIFICULTAD_PROMPT: Record<string, string> = {
    'fácil':     'DIFICULTAD: todas las recetas fáciles (≤30 min, técnicas simples, pocos pasos, apta para cocineros sin experiencia).',
    'media':     'DIFICULTAD: recetas de nivel medio (30-60 min, técnicas habituales de cocina).',
    'difícil':   'DIFICULTAD: recetas elaboradas y de alta dificultad (más de 45 min, técnicas avanzadas, presentación cuidada).',
    'combinado': '',
  }
  const TIEMPO_PROMPT: Record<string, string> = {
    'rápido (menos de 30 min)':    'TIEMPO: todas las recetas en menos de 30 minutos desde que empiezas hasta que sirves.',
    'normal (30-60 min)':          'TIEMPO: recetas de 30 a 60 minutos de preparación.',
    'sin prisa (más de 1 hora)':   'TIEMPO: recetas de cocción lenta, guisos y elaboradas de más de 1 hora. Prioriza sabores profundos.',
    'combinado': '',
  }

  async function generarDesdeModal(config: ConfigGeneracion) {
    setModalGenerar(false)
    if (!perfil || generando) return
    guardar('menu_lista_destino', config.listaDestinoId)
    track('menu_generado', { via: 'modal', cocina: config.cocina, dificultad: config.dificultad })

    const esVariada = config.cocina === 'variada e internacional'
    const estiloDesc = ESTILOS_COCINA[config.cocina] ?? `cocina ${config.cocina}`
    const partes: string[] = [
      esVariada
        ? 'COCINA: varía el estilo cada día (española, italiana, asiática, americana, mediterránea...). Que cada jornada tenga sabores distintos.'
        : `COCINA OBLIGATORIA: TODAS las recetas deben ser de ${estiloDesc}. Nada fuera de este estilo.`,
      DIFICULTAD_PROMPT[config.dificultad] ?? '',
      TIEMPO_PROMPT[config.tiempo] ?? '',
      config.extra ? `EL USUARIO QUIERE: ${config.extra}.` : '',
      config.no_quiero ? `EXCLUIR COMPLETAMENTE: ${config.no_quiero}.` : '',
    ].filter(Boolean)

    if (config.modoIngredientes === 'nevera') {
      const nevera = config.neveraItems && config.neveraItems.length > 0
        ? config.neveraItems
        : [...((perfil as { nevera?: string[] }).nevera ?? []), ...(recuperar<string[]>('lista_nevera') ?? [])].filter((v, i, a) => a.indexOf(v) === i)
      partes.push(`MODO NEVERA: crea recetas usando principalmente estos ingredientes disponibles en casa: ${nevera.join(', ')}. Puedes asumir sal, aceite, ajo y especias básicas.`)
    } else if (config.modoIngredientes === 'personalizada' && config.ingredientesPersonalizados.length > 0) {
      partes.push(`USA ESTOS INGREDIENTES: diseña las recetas usando principalmente: ${config.ingredientesPersonalizados.join(', ')}. Adapta las combinaciones a lo disponible.`)
    }

    await generarSemanaCompleta(partes.join(' '), esVariada ? undefined : config.cocina, config.objetivo !== 'sin_restriccion' ? config.objetivo : undefined)
  }


  function eliminarSlot(clave: ClaveMenu) {
    setEstados(prev => { const n = { ...prev }; delete n[clave]; return n })
    setSeleccion(prev => { const n = { ...prev }; delete n[clave]; return n })
  }

  function guardarSemana() {
    const nombre = nombreGuardar.trim() || `${t.menu_guardar_semana_label} ${new Date().toLocaleDateString('es-ES')}`
    const nueva: SemanaGuardada = {
      id: Date.now().toString(), nombre, fecha: new Date().toLocaleDateString('es-ES'),
      tipo: 'normal', estados: { ...estados }, seleccion: { ...seleccion },
    }
    const next = [nueva, ...semanasGuardadas].slice(0, 20)
    setSemanasGuardadas(next); guardar('semanas_guardadas', next)
    if (user) supabase.from('perfiles').update({ semanas_guardadas: next }).eq('usuario_id', user.id).then(({ error }) => { if (error) console.error('guardar semanas:', error.message) })
    setModalGuardar(false); setNombreGuardar('')
  }

  function cargarSemana(semana: SemanaGuardada) {
    setEstados(semana.estados); setSeleccion(semana.seleccion)
    guardar('menu_estados', semana.estados); guardar('menu_seleccion', semana.seleccion)
    setMostrarGuardadas(false)
  }

  function eliminarSemana(id: string) {
    const next = semanasGuardadas.filter(s => s.id !== id)
    setSemanasGuardadas(next); guardar('semanas_guardadas', next)
    if (user) supabase.from('perfiles').update({ semanas_guardadas: next }).eq('usuario_id', user.id).then(({ error }) => { if (error) console.error('eliminar semana:', error.message) })
  }

  function construirMenuDesdeSeleccion(): MenuSemanal {
    const menu: MenuSemanal = {}
    for (const dia of DIAS) {
      for (const franja of FRANJAS) {
        const clave: ClaveMenu = `${dia}_${franja}`
        const idx = seleccion[clave] ?? 0
        const opciones = estados[clave]?.datos?.opciones
        if (opciones?.[idx]) menu[clave] = opciones[idx]
      }
    }
    return menu
  }

  function irALista(_e: React.MouseEvent<HTMLButtonElement>) {
    const listaDestinoId = recuperar<string | null>('menu_lista_destino') ?? null
    navegarALista(listaDestinoId)
  }

  function navegarALista(listaId: string | null) {
    const menu = construirMenuDesdeSeleccion()
    guardar('menu_semana', menu); guardar('sorpresa_menu', menu)
    navigate(listaId ? `/lista-compartida/${listaId}` : '/lista')
  }

  const totalListos = DIAS.flatMap(d => FRANJAS.map(f => `${d}_${f}` as ClaveMenu)).filter(k => estados[k]?.estado === 'listo').length
  const totalSeleccionadas = Object.keys(seleccion).filter(k => estados[k as ClaveMenu]?.estado === 'listo').length
  const menuVacio = totalListos === 0 && !generando


  // Calorías totales por día (suma comida + cena)
  const caloriasDelDia = useMemo(() => {
    const map: Partial<Record<string, number>> = {}
    for (const dia of DIAS) {
      let total = 0
      for (const franja of FRANJAS) {
        const clave = `${dia}_${franja}` as ClaveMenu
        const est = estados[clave]
        if (est?.estado === 'listo' && est.datos?.opciones) {
          const idx = seleccion[clave] ?? 0
          const receta = est.datos.opciones[idx] as { calorias_aprox?: number } | undefined
          if (receta?.calorias_aprox) total += receta.calorias_aprox
        }
      }
      if (total > 0) map[dia] = total
    }
    return map
  }, [estados, seleccion])

  // Resumen nutricional semanal
  const resumenSemanal = useMemo(() => {
    let totalKcal = 0; let numSlots = 0
    for (const dia of DIAS) for (const franja of FRANJAS) {
      const clave = `${dia}_${franja}` as ClaveMenu
      const est = estados[clave]
      if (est?.estado === 'listo' && est.datos?.opciones) {
        const idx = seleccion[clave] ?? 0
        const r = est.datos.opciones[idx] as { calorias_aprox?: number } | undefined
        if (r?.calorias_aprox) { totalKcal += r.calorias_aprox; numSlots++ }
      }
    }
    return { totalKcal, numSlots, mediaKcal: numSlots > 0 ? Math.round(totalKcal / numSlots) : 0 }
  }, [estados, seleccion])

  if (perfilLoading) return null

  return (
    <div className="min-h-screen p-4 pb-28 max-w-2xl mx-auto page-enter">

      {/* Modal Sorpréndeme */}
      {modalSorpresa && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">{t.modal_titulo}</h2>
            <div className="space-y-4">
              {/* Días y franjas */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.modal_para_cuantos_dias}</p>
                  <div className="flex gap-2">
                    {([
                      { key: 'semana',        label: t.modal_semana_completa, locked: !semanaDesbloqueada },
                      { key: 'laboral',       label: t.modal_lun_vie,         locked: false },
                      { key: 'personalizado', label: t.modal_personalizado,   locked: false },
                    ] as const).map(({ key, label, locked }) => (
                      <button key={key} onClick={() => handleDiasConfigPage(key)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${locked ? 'border-gray-200 dark:border-gray-700 text-gray-400 opacity-60' : diasConfig === key ? 'border-green-select bg-accent-light text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                        {locked && '🔒'}{label}
                      </button>
                    ))}
                  </div>
                  {diasConfig === 'personalizado' && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {DIAS.map(d => {
                        const locked = DIAS_FIN_SEMANA.includes(d) && !semanaDesbloqueada
                        return (
                          <button key={d}
                            onClick={() => handleDiaPersonalizadoPage(d)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-colors ${diasPersonalizados.has(d) ? 'border-green-select bg-accent-light text-green-select' : locked ? 'border-gray-200 dark:border-gray-700 text-gray-300 opacity-60' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                            {locked ? '🔒' : ''}{DIAS_LABEL[d].slice(0, 3)}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t.modal_que_comidas}</p>
                  <div className="flex gap-2">
                    {([
                      { key: 'ambas',  label: t.modal_comida_cena, locked: !franjaDesbloqueada },
                      { key: 'comida', label: t.modal_solo_comida, locked: false },
                      { key: 'cena',   label: t.modal_solo_cena,   locked: false },
                    ] as const).map(({ key, label, locked }) => (
                      <button key={key} onClick={() => handleFranjaConfigPage(key)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${locked ? 'border-gray-200 dark:border-gray-700 text-gray-400 opacity-60' : franjaConfig === key ? 'border-green-select bg-accent-light text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                        {locked && '🔒'}{label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700" />
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">{t.modal_tipo_cocina}</label>
                <select value={cuestionario.cocina} onChange={e => setCuestionario(p => ({ ...p, cocina: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
                  <option value="combinado">{t.modal_combinado}</option>
                  <option value="aleatorio">{t.modal_aleatorio}</option>
                  <option value="española y mediterránea">{t.modal_espanola}</option>
                  <option value="italiana">{t.modal_italiana}</option>
                  <option value="asiática">{t.modal_asiatica}</option>
                  <option value="americana">{t.modal_americana}</option>
                  <option value="mexicana">{t.modal_mexicana}</option>
                  <option value="variada e internacional">{t.modal_variada}</option>
                  <option value="saludable y ligera">{t.modal_saludable}</option>
                  <option value="tradicional española">{t.modal_tradicional}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">{t.modal_tiempo}</label>
                <select value={cuestionario.tiempo} onChange={e => setCuestionario(p => ({ ...p, tiempo: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
                  <option value="combinado">{t.modal_tiempo_combinado}</option>
                  <option value="rápido (menos de 30 min)">{t.modal_rapido}</option>
                  <option value="normal (30-60 min)">{t.modal_normal}</option>
                  <option value="sin prisa (más de 1 hora)">{t.modal_sin_prisa}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">{t.modal_dificultad}</label>
                <select value={cuestionario.dificultad} onChange={e => setCuestionario(p => ({ ...p, dificultad: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
                  <option value="combinado">{t.modal_dif_combinado}</option>
                  <option value="fácil">{t.modal_dif_facil}</option>
                  <option value="media">{t.modal_dif_media}</option>
                  <option value="difícil">{t.modal_dif_dificil}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">{t.modal_quieres_comer}</label>
                <input type="text" value={cuestionario.extra} onChange={e => setCuestionario(p => ({ ...p, extra: e.target.value }))}
                  placeholder={t.modal_quieres_comer_ph}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">{t.modal_no_quieres}</label>
                <input type="text" value={cuestionario.no_quiero} onChange={e => setCuestionario(p => ({ ...p, no_quiero: e.target.value }))}
                  placeholder={t.modal_no_quieres_ph}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalSorpresa(false)} className="flex-1 border border-gray-300 dark:border-gray-600 rounded-xl py-3 text-sm font-medium">{t.btn_cancelar}</button>
              <button onClick={generarSorpresa} className="flex-1 bg-purple-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-purple-700">{t.modal_sorprendeme}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Guardar */}
      {modalGuardar && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-xl mx-4">
            <h2 className="text-lg font-bold mb-4">{t.menu_guardar_titulo}</h2>
            <input type="text" value={nombreGuardar} onChange={e => setNombreGuardar(e.target.value)}
              placeholder={`${t.menu_guardar_semana_label} ${new Date().toLocaleDateString('es-ES')}`}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mb-4 bg-white dark:bg-gray-800" />
            <div className="flex gap-3">
              <button onClick={() => setModalGuardar(false)} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm">{t.btn_cancelar}</button>
              <button onClick={guardarSemana} className="flex-1 bg-green-select text-white rounded-xl py-2.5 text-sm font-bold">{t.btn_guardar}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle favorita */}
      {favoritaDetalle && createPortal(
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4" onClick={() => setFavoritaDetalle(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-900 px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-start gap-3 rounded-t-2xl">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base leading-tight">{favoritaDetalle.nombre}</p>
                <p className="text-xs text-gray-400 mt-0.5">{favoritaDetalle.descripcion_corta}</p>
                <p className="text-xs text-gray-400 mt-1">⏱ {favoritaDetalle.tiempo_prep} min · 🔥 {favoritaDetalle.calorias_aprox} kcal · {favoritaDetalle.dificultad}</p>
              </div>
              <button onClick={() => setFavoritaDetalle(null)} className="text-gray-400 text-2xl leading-none shrink-0">×</button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {favoritaDetalle.ingredientes?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Ingredientes</p>
                  <ul className="space-y-1">
                    {favoritaDetalle.ingredientes.map((ing, i) => (
                      <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                        <span className="text-green-select mt-0.5">•</span>
                        {ing.cantidad} {ing.unidad} {ing.nombre}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold mb-2">Preparación</p>
                {favoritaPasosCargando ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="animate-spin">⏳</span> Cargando pasos...
                  </div>
                ) : favoritaPasos && favoritaPasos.length > 0 ? (
                  <ol className="space-y-2">
                    {favoritaPasos.map((paso, i) => (
                      <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex gap-2">
                        <span className="font-bold text-green-select shrink-0">{i + 1}.</span>{paso}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-gray-400">No se pudieron cargar los pasos.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Modal Generar menú */}
      {modalGenerar && perfil && (
        <ModalGenerarMenu
          dificultadPerfil={(perfil as { dificultad_recetas?: string })?.dificultad_recetas as import('../types').DificultadPreferida ?? 'combinado'}
          objetivoPerfil={(perfil as { objetivo?: string })?.objetivo ?? 'sin_restriccion'}
          ingredientesNevera={[...((perfil as { nevera?: string[] }).nevera ?? []), ...(recuperar<string[]>('lista_nevera') ?? [])].filter((v, i, a) => a.indexOf(v) === i)}
          listasCompartidas={listasCompartidas.map(l => ({ id: l.id, nombre: l.nombre }))}
          diasConfig={diasConfig}
          diasPersonalizados={diasPersonalizados}
          franjaConfig={franjaConfig}
          onDiasConfigChange={setDiasConfig}
          onDiasPersonalizadosChange={setDiasPersonalizados}
          onFranjaConfigChange={setFranjaConfig}
          onConfirmar={generarDesdeModal}
          onCancelar={() => setModalGenerar(false)}
        />
      )}

      {/* Modal anuncio recompensado */}
      {modalAnuncio && (
        <AnuncioRewarded
          onRecompensa={() => {
            setModalAnuncio(false)
            setModalGenerar(true)
          }}
          onCancelar={() => setModalAnuncio(false)}
        />
      )}

      {/* Banner de error */}
      {errorMsg && (
        <div className="mb-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-red-500 shrink-0 mt-0.5">⚠️</span>
          <p className="text-sm text-red-700 dark:text-red-300 flex-1">{errorMsg}</p>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 pt-2 pb-3">
        {/* Glass card */}
        <div className="relative rounded-2xl overflow-hidden mb-2">
          <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/80 backdrop-blur-xl border border-white/40 dark:border-white/10" />
          <div className="relative px-4 pt-3 pb-3">
            {/* Fila título + botón generar */}
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div>
                <h1 className="text-2xl font-black tracking-tight leading-none">{t.menu_tu_semana}</h1>
                {totalListos > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">{totalListos}/14 {t.menu_recetas}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('semana-lista:open-tutorial'))}
                  title="Ver tutorial"
                  className="w-9 h-9 rounded-xl border border-white/30 dark:border-white/10 bg-white/50 dark:bg-white/5 text-gray-400 text-xs font-bold hover:border-green-select hover:text-green-select transition-colors flex items-center justify-center backdrop-blur-sm"
                >
                  ?
                </button>
                <div className="flex flex-col items-end gap-0.5">
                  {generacionesMes >= LIMITE_GENERACIONES && generacionesAnuncio < LIMITE_ANUNCIO ? (
                    // Cupo gratuito agotado → botón de ver anuncio
                    <button
                      data-tutorial="generar-btn"
                      onClick={() => setModalAnuncio(true)}
                      disabled={generando || !perfil}
                      className="flex items-center gap-1.5 bg-amber-500 text-white rounded-xl px-4 py-2 font-semibold text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <span className="text-base">📺</span> +1 extra
                    </button>
                  ) : (
                    <button
                      data-tutorial="generar-btn"
                      onClick={() => setModalGenerar(true)}
                      disabled={generando || !perfil || (generacionesMes >= LIMITE_GENERACIONES && generacionesAnuncio >= LIMITE_ANUNCIO)}
                      className="flex items-center gap-1.5 bg-green-select text-white rounded-xl px-4 py-2 font-semibold text-sm hover:bg-green-600 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {generando ? (
                        <span className="animate-pulse">{t.menu_generando}</span>
                      ) : (
                        <>{t.menu_generar} <span className="text-base">✨</span></>
                      )}
                    </button>
                  )}
                  {generacionesMes >= LIMITE_GENERACIONES && generacionesAnuncio >= LIMITE_ANUNCIO ? (
                    <span className="text-[10px] font-medium text-red-400">Límite diario de anuncios</span>
                  ) : generacionesMes >= LIMITE_GENERACIONES ? (
                    <span className="text-[10px] font-medium text-amber-500">{LIMITE_ANUNCIO - generacionesAnuncio} extra por anuncio</span>
                  ) : (
                    <span className={`text-[10px] font-medium ${generacionesMes >= LIMITE_GENERACIONES - 1 ? 'text-orange-400' : 'text-gray-400'}`}>
                      {LIMITE_GENERACIONES - generacionesMes} {t.menu_gen_restantes}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Barra de progreso */}
            {totalListos > 0 && (
              <div className="mb-2.5">
                <div className="h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-select rounded-full transition-all duration-500"
                    style={{ width: `${(totalListos / 14) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Botones secundarios */}
            <div className="flex gap-2">
              <button
                onClick={() => { setMostrarFavoritas(p => !p); setMostrarGuardadas(false) }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${mostrarFavoritas ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' : 'bg-black/5 dark:bg-white/8 text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/12'}`}
              >
                {t.menu_favoritas} {favoritas.length > 0 && <span className="bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{favoritas.length}</span>}
              </button>
              <button
                onClick={() => { setMostrarGuardadas(p => !p); setMostrarFavoritas(false) }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${mostrarGuardadas ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' : 'bg-black/5 dark:bg-white/8 text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/12'}`}
              >
                {t.menu_guardadas} {semanasGuardadas.length > 0 && <span className="bg-blue-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{semanasGuardadas.length}</span>}
              </button>
              <button
                onClick={() => setModalGuardar(true)}
                disabled={totalListos === 0}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-black/5 dark:bg-white/8 text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/12 disabled:opacity-40 transition-colors"
              >
                {t.menu_guardar}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Widget nutricional — solo cuando hay recetas */}
      {resumenSemanal.numSlots >= 2 && (
        <div className="mb-4">
          <div className="relative rounded-2xl overflow-hidden">
            {/* Glass background */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 dark:from-white/8 dark:to-white/3 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-2xl" />
            <div className="relative flex divide-x divide-white/15 dark:divide-white/10">
              <div className="flex-1 py-4 text-center">
                <p className="text-xl font-black bg-gradient-to-b from-orange-400 to-orange-600 bg-clip-text text-transparent">{resumenSemanal.totalKcal.toLocaleString('es')}</p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">{t.menu_kcal_semana}</p>
              </div>
              <div className="flex-1 py-4 text-center">
                <p className="text-xl font-black bg-gradient-to-b from-blue-400 to-blue-600 bg-clip-text text-transparent">{resumenSemanal.mediaKcal}</p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">{t.menu_kcal_plato}</p>
              </div>
              <div className="flex-1 py-4 text-center">
                <p className="text-xl font-black text-green-select">{resumenSemanal.numSlots}</p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">{t.menu_platos}</p>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-center">{t.menu_estimaciones}</p>
        </div>
      )}

      {/* Empty state: primera vez o menú vacío */}
      {menuVacio && (
        <div className="mb-4 bg-accent-light border border-green-select/20 rounded-xl p-5 text-center">
          <p className="text-3xl mb-3">🥗</p>
          <h2 className="font-bold text-base mb-1">{t.menu_vacio}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t.menu_vacio_desc}
          </p>
          <button
            onClick={() => setModalGenerar(true)}
            disabled={!perfil}
            className="bg-green-select text-white rounded-card px-6 py-2.5 font-semibold text-sm hover:bg-green-600 disabled:opacity-50"
          >
            {t.menu_generar_btn}
          </button>
        </div>
      )}

      {/* Selector de días y franjas */}
      {menuVacio && (
        <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl shadow-card p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{t.modal_para_cuantos_dias}</p>
            <div className="flex gap-2">
              {([
                { key: 'semana',        label: t.modal_semana_completa, locked: !semanaDesbloqueada },
                { key: 'laboral',       label: t.modal_lun_vie,         locked: false },
                { key: 'personalizado', label: t.modal_personalizado,   locked: false },
              ] as const).map(({ key, label, locked }) => (
                <button
                  key={key}
                  onClick={() => handleDiasConfigPage(key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${locked ? 'border-gray-200 dark:border-gray-700 text-gray-400 opacity-60' : diasConfig === key ? 'border-green-select bg-accent-light text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}
                >
                  {locked && '🔒'}{label}
                </button>
              ))}
            </div>
            {diasConfig === 'personalizado' && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {DIAS.map(d => {
                  const locked = DIAS_FIN_SEMANA.includes(d) && !semanaDesbloqueada
                  return (
                    <button
                      key={d}
                      onClick={() => handleDiaPersonalizadoPage(d)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-colors ${diasPersonalizados.has(d) ? 'border-green-select bg-accent-light text-green-select' : locked ? 'border-gray-200 dark:border-gray-700 text-gray-300 opacity-60' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}
                    >
                      {locked ? '🔒' : ''}{DIAS_LABEL[d].slice(0, 3)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{t.modal_que_comidas}</p>
            <div className="flex gap-2">
              {([
                { key: 'ambas',  label: t.modal_comida_cena, locked: !franjaDesbloqueada },
                { key: 'comida', label: t.modal_solo_comida, locked: false },
                { key: 'cena',   label: t.modal_solo_cena,   locked: false },
              ] as const).map(({ key, label, locked }) => (
                <button
                  key={key}
                  onClick={() => handleFranjaConfigPage(key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${locked ? 'border-gray-200 dark:border-gray-700 text-gray-400 opacity-60' : franjaConfig === key ? 'border-green-select bg-accent-light text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}
                >
                  {locked && '🔒'}{label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ad gate overlay para botones de la página principal */}
      {mostrandoAdGate && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-xl">
            <div className="text-4xl">🔒</div>
            <p className="font-bold text-gray-800 dark:text-gray-100">Contenido premium</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {mostrandoAdGate === 'semana'
                ? 'Ve un anuncio corto para desbloquear la semana completa en esta generación.'
                : 'Ve un anuncio corto para desbloquear comida + cena en esta generación.'}
            </p>
            {cargandoAnuncioGate ? (
              <p className="text-green-select text-sm font-medium animate-pulse">Cargando anuncio...</p>
            ) : (
              <button onClick={verAnuncioGate} className="w-full bg-green-select text-white font-bold py-3 rounded-xl text-sm hover:bg-green-600 transition-colors">
                📺 Ver anuncio y desbloquear
              </button>
            )}
            <button onClick={() => setMostrandoAdGate(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
          </div>
        </div>,
        document.body
      )}

      {/* Favoritas */}
      {mostrarFavoritas && (
        <div className="mb-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-sm">{t.menu_favoritas_titulo}</h3>
          </div>
          {favoritas.length === 0
            ? <p className="text-sm text-gray-400 p-4 text-center">{t.menu_favoritas_vacio}</p>
            : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-80 overflow-y-auto">
                {favoritas.map(r => (
                  <div key={r.nombre} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
                    onClick={() => abrirFavoritaDetalle(r)}>
                    <span className="text-lg shrink-0">⭐</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.nombre}</p>
                      <p className="text-xs text-gray-400 truncate">{r.descripcion_corta}</p>
                      <p className="text-xs text-gray-400">⏱ {r.tiempo_prep} min · 🔥 {r.calorias_aprox} kcal · {r.dificultad}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); toggleFavorita(r) }} className="text-yellow-400 hover:text-gray-400 text-lg shrink-0" title="Quitar de favoritas">★</button>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Semanas guardadas */}
      {mostrarGuardadas && (
        <div className="mb-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-sm">{t.menu_guardadas_titulo}</h3>
          </div>
          {semanasGuardadas.length === 0
            ? <p className="text-sm text-gray-400 p-4 text-center">{t.menu_guardadas_vacio}</p>
            : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {semanasGuardadas.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-lg">📅</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.nombre}</p>
                      <p className="text-xs text-gray-400">{s.fecha}</p>
                    </div>
                    <button onClick={() => cargarSemana(s)} className="text-xs bg-accent-light text-green-select px-3 py-1.5 rounded-lg font-medium">{t.menu_cargar}</button>
                    <button onClick={() => eliminarSemana(s.id)} className="text-gray-400 hover:text-red-500 text-sm">✕</button>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* Grid semanal — solo visible cuando hay algo generado o generando */}
      {!menuVacio && (
        <div className="space-y-6">
          {DIAS.filter(dia =>
            FRANJAS.some(f => {
              const s = estados[`${dia}_${f}` as ClaveMenu]
              return s && s.estado !== 'idle' && s.estado !== 'vacio'
            })
          ).map(dia => {
            const franjasVisibles = FRANJAS.filter(f => {
              const s = estados[`${dia}_${f}` as ClaveMenu]
              return s && s.estado !== 'idle' && s.estado !== 'vacio'
            })
            return (
              <div key={dia}>
                <div className="flex items-center mb-2">
                  <h2 className="font-bold text-gray-800 dark:text-gray-200 tracking-tight">{DIAS_LABEL[dia]}</h2>
                  {caloriasDelDia[dia] && (
                    <span className="ml-2 text-xs font-semibold text-orange-400">🔥 {caloriasDelDia[dia]} kcal</span>
                  )}

                </div>
                <div className={`grid gap-3 ${franjasVisibles.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {franjasVisibles.map(franja => {
                    const clave: ClaveMenu = `${dia}_${franja}`
                    const slot = estados[clave] ?? { estado: 'idle' as EstadoCelda }
                    return (
                      <div key={franja}>
                        <p className="text-xs uppercase tracking-wide text-gray-400 mb-1 capitalize">{franja}</p>
                        <CeldaMenu
                          dia={dia} franja={franja}
                          estado={slot.estado} datos={slot.datos}
                          onReintentar={() => regenerarSlot(dia, franja)}
                          onEliminar={() => eliminarSlot(clave)}
                          seleccionada={seleccion[clave] ?? 0}
                          onSeleccionar={i => setSeleccion(prev => ({ ...prev, [clave]: i }))}
                          favoritasNombres={favoritasNombres}
                          onToggleFavorita={toggleFavorita}
                          dislikesNombres={dislikes}
                          onDislike={handleDislike}
                          onQuitarDislike={handleQuitarDislike}
                          puedeAnadirExtra={!slotsExtra.has(clave) && slotsExtra.size < LIMITE_SLOTS_EXTRA}
                          cargandoExtra={cargandoExtra.has(clave)}
                          onAnadirOpcionExtra={() => añadirOpcionExtra(dia, franja)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}


      {totalSeleccionadas > 0 && (
        <div className="mt-8 sticky bottom-24 flex justify-center">
          <button onClick={irALista}
            className="bg-orange-accent text-white border-2 border-orange-accent/80 rounded-full px-8 py-3 text-base font-bold shadow-lg shadow-orange-accent/30 hover:opacity-90 active:scale-95 transition-all"
            style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
            {t.menu_ver_lista} ({totalSeleccionadas} comidas)
          </button>
        </div>
      )}


    </div>
  )
}
