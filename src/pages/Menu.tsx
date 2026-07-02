// src/pages/Menu.tsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CeldaMenu } from '../components/CeldaMenu'
import { ProgressBar } from '../components/ui/ProgressBar'
import { ModalGenerarMenu, type ConfigGeneracion } from '../components/ModalGenerarMenu'
import { usePerfil } from '../hooks/usePerfil'
import { useListasCompartidas } from '../hooks/useListaCompartida'
import { usePreferencias } from '../hooks/usePreferencias'
import { useAnalytics } from '../hooks/useAnalytics'
import { guardar, recuperar } from '../lib/storage'
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


function perfilConNevera(perfil: object, extraPrompt?: string, ingredientesEvitar: string[] = [], cocina?: string): object {
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
  }
}

export default function Menu() {
  const navigate = useNavigate()
  const { perfil, loading: perfilLoading } = usePerfil()
  const { listas: listasCompartidas } = useListasCompartidas()
  const { dislikes, ingredientesEvitar, guardarPreferencia, quitarPreferencia } = usePreferencias()
  const { track } = useAnalytics()

  const [estados, setEstados] = useState<MapaEstados>(() => recuperar<MapaEstados>('menu_estados') ?? {})
  const [seleccion, setSeleccion] = useState<MapaSeleccion>(() => recuperar<MapaSeleccion>('menu_seleccion') ?? {})
  const [generando, setGenerando] = useState(false)
  const [modalGenerar, setModalGenerar] = useState(false)
  const [modalSorpresa, setModalSorpresa] = useState(false)
  const [infoGenerarVisible, setInfoGenerarVisible] = useState(false)
  const [cuestionario, setCuestionario] = useState<Cuestionario>(() => ({
    ...CUESTIONARIO_INICIAL,
    listaDestinoId: recuperar<string | null>('menu_lista_destino') ?? null,
  }))

  function abrirModalSorpresa() {
    setCuestionario(prev => ({
      ...prev,
      dificultad: (perfil as { dificultad_recetas?: string })?.dificultad_recetas ?? 'combinado',
    }))
    setModalSorpresa(true)
  }
  // Opción extra por comida: máximo 4 días distintos pueden desbloquear una segunda opción
  const LIMITE_DIAS_EXTRA = 4
  const [diasExtra, setDiasExtra] = useState<Set<Dia>>(() => new Set(recuperar<Dia[]>('menu_dias_extra') ?? []))
  const [cargandoExtra, setCargandoExtra] = useState<Set<ClaveMenu>>(new Set())

  const [semanasGuardadas, setSemanasGuardadas] = useState<SemanaGuardada[]>(() => recuperar<SemanaGuardada[]>('semanas_guardadas') ?? [])
  const [modalGuardar, setModalGuardar] = useState(false)
  const [nombreGuardar, setNombreGuardar] = useState('')
  const [mostrarGuardadas, setMostrarGuardadas] = useState(false)
  const [mostrarFavoritas, setMostrarFavoritas] = useState(false)
  const [favoritas, setFavoritas] = useState<Receta[]>(() => recuperar<Receta[]>('recetas_favoritas') ?? [])
  const [errorMsg, setErrorMsg] = useState('')

  // Configuración de días y franjas a generar (persistida en localStorage)
  type DiasConfig = 'semana' | 'laboral' | 'personalizado'
  type FranjaConfig = 'ambas' | 'comida' | 'cena'
  const DIAS_LABORALES: Dia[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
  const [diasConfig, setDiasConfigRaw] = useState<DiasConfig>(() => recuperar<DiasConfig>('menu_dias_config') ?? 'semana')
  const [diasPersonalizados, setDiasPersonalizadosRaw] = useState<Set<Dia>>(() => new Set(recuperar<Dia[]>('menu_dias_personalizados') ?? DIAS))
  const [franjaConfig, setFranjaConfigRaw] = useState<FranjaConfig>(() => recuperar<FranjaConfig>('menu_franja_config') ?? 'ambas')

  function setDiasConfig(v: DiasConfig) { setDiasConfigRaw(v); guardar('menu_dias_config', v) }
  function setDiasPersonalizados(fn: (prev: Set<Dia>) => Set<Dia>) {
    setDiasPersonalizadosRaw(prev => { const next = fn(prev); guardar('menu_dias_personalizados', Array.from(next)); return next })
  }
  function setFranjaConfig(v: FranjaConfig) { setFranjaConfigRaw(v); guardar('menu_franja_config', v) }

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

  const favoritasNombres = new Set(favoritas.map(r => r.nombre))

  function toggleFavorita(receta: Receta) {
    const yaEsta = favoritasNombres.has(receta.nombre)
    const next = yaEsta ? favoritas.filter(r => r.nombre !== receta.nombre) : [receta, ...favoritas]
    setFavoritas(next)
    guardar('recetas_favoritas', next)
    if (!yaEsta) track('receta_favorita', { receta: receta.nombre })
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

  // Pone todos los slots en cargando, luego hace una sola llamada a la API
  async function generarSemanaCompleta(extraPrompt?: string, cocina?: string) {
    if (!perfil || generando) return
    setGenerando(true)
    setDiasExtra(new Set())
    guardar('menu_dias_extra', [])

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
          perfil: perfilConNevera(perfil, extraPrompt, ingredientesEvitar, cocina),
          recetas_ya_usadas: recetasYaUsadas,
          dias: activeDias,
          franjas: activeFranjas,
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
      track('menu_generado', { slots: Object.keys(nuevosEstados).filter(k => nuevosEstados[k as ClaveMenu]?.estado === 'listo').length })
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
        body: { dia, franja, perfil: perfilConNevera(perfil, undefined, ingredientesEvitar), recetas_ya_usadas: [] },
      })
      if (fnError) throw new Error(fnError.message)
      if (data?.error) throw new Error(data.mensaje)
      setEstados(prev => ({ ...prev, [clave]: { estado: 'listo', datos: data as OpcionesSlot } }))
      setSeleccion(prev => ({ ...prev, [clave]: 0 }))
    } catch {
      setEstados(prev => ({ ...prev, [clave]: { estado: 'error' } }))
    }
  }

  // Añade una segunda opción a una celda que ya tiene 1 receta. Limitado a
  // LIMITE_DIAS_EXTRA días distintos por semana (comida+cena del mismo día
  // cuentan como un solo "día" de cuota).
  async function añadirOpcionExtra(dia: Dia, franja: Franja) {
    if (!perfil) return
    const clave: ClaveMenu = `${dia}_${franja}`
    const recetaActual = estados[clave]?.datos?.opciones[0]
    if (!recetaActual) return
    if (!diasExtra.has(dia) && diasExtra.size >= LIMITE_DIAS_EXTRA) return

    setCargandoExtra(prev => new Set(prev).add(clave))
    try {
      const { supabase } = await import('../lib/supabase')
      const { data, error: fnError } = await supabase.functions.invoke('generar-recetas', {
        body: {
          dia, franja, accion: 'opcion_extra', receta_existente: recetaActual.nombre,
          perfil: perfilConNevera(perfil, undefined, ingredientesEvitar),
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
      setDiasExtra(prev => {
        if (prev.has(dia)) return prev
        const next = new Set(prev).add(dia)
        guardar('menu_dias_extra', Array.from(next))
        return next
      })
    } catch {
      // silencioso: la celda se queda con su única opción si falla
    } finally {
      setCargandoExtra(prev => { const n = new Set(prev); n.delete(clave); return n })
    }
  }

  async function regenerarDia(dia: Dia) {
    await Promise.all([regenerarSlot(dia, 'comida'), regenerarSlot(dia, 'cena')])
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
  const OCASION_PROMPT: Record<string, string> = {
    'semana normal': '',
    'visita de amigos o familia': 'OCASIÓN — VISITA DE FAMILIA/AMIGOS: platos para compartir en grupo, vistosos y que impresionen. Raciones generosas, comida para reunión, algún plato especial que quedar bien.',
    'cena romántica': 'OCASIÓN — CENA ROMÁNTICA: platos elegantes para dos personas, sugerentes y especiales. Sin alimentos difíciles de comer con elegancia. Al menos un plato que resulte sofisticado y memorable.',
    'comida con niños': 'OCASIÓN — COMIDA CON NIÑOS: recetas suaves sin picante ni sabores fuertes, fáciles de comer y reconocibles para los más pequeños. Platos divertidos y nutritivos que los niños acepten bien. Sin ingredientes raros ni presentaciones intimidantes.',
    'semana de dieta': 'OCASIÓN — SEMANA DE DIETA: recetas bajas en calorías (máximo 500 kcal por ración). Prioriza verduras, proteína magra (pollo a la plancha, pescado, legumbres), sin fritos ni salsas grasas. Porciones saciantes pero ligeras.',
    'semana de caprichos': 'OCASIÓN — SEMANA DE CAPRICHOS: platos indulgentes y especiales que normalmente no te preparas en el día a día. Comfort food, platos ricos y satisfactorios, ingredientes premium. No te preocupes por las calorías.',
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
      OCASION_PROMPT[config.ocasion] ?? '',
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

    await generarSemanaCompleta(partes.join(' '), esVariada ? undefined : config.cocina)
  }


  function eliminarSlot(clave: ClaveMenu) {
    setEstados(prev => { const n = { ...prev }; delete n[clave]; return n })
    setSeleccion(prev => { const n = { ...prev }; delete n[clave]; return n })
  }

  function guardarSemana() {
    const nombre = nombreGuardar.trim() || `Semana ${new Date().toLocaleDateString('es-ES')}`
    const nueva: SemanaGuardada = {
      id: Date.now().toString(), nombre, fecha: new Date().toLocaleDateString('es-ES'),
      tipo: 'normal', estados: { ...estados }, seleccion: { ...seleccion },
    }
    const next = [nueva, ...semanasGuardadas].slice(0, 20)
    setSemanasGuardadas(next); guardar('semanas_guardadas', next)
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

  function irALista() {
    const menu = construirMenuDesdeSeleccion()
    guardar('menu_semana', menu); guardar('sorpresa_menu', menu)
    const listaDestinoId = recuperar<string | null>('menu_lista_destino') ?? recuperar<string>('lista_compartida_principal')
    navigate(listaDestinoId ? `/lista-compartida/${listaDestinoId}` : '/lista')
  }

  const totalListos = DIAS.flatMap(d => FRANJAS.map(f => `${d}_${f}` as ClaveMenu)).filter(k => estados[k]?.estado === 'listo').length
  const totalSeleccionadas = Object.keys(seleccion).filter(k => estados[k as ClaveMenu]?.estado === 'listo').length
  const menuVacio = totalListos === 0 && !generando

  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('semana-lista:seen-tips-v1'))
  const [onboardingStep, setOnboardingStep] = useState(0)

  function dismissOnboarding() {
    localStorage.setItem('semana-lista:seen-tips-v1', '1')
    setShowOnboarding(false)
  }

  const ONBOARDING_STEPS = [
    { emoji: '✨', titulo: 'Genera tu menú semanal', desc: 'Pulsa "Generar" para elegir tipo de cocina, dificultad y más. O "Sorpresa" para dejar que la IA decida por ti.' },
    { emoji: '🛒', titulo: 'Lista de la compra automática', desc: 'Cuando tengas el menú listo, pulsa "Ver lista" para generar automáticamente la lista de la compra con todos los ingredientes.' },
    { emoji: '⭐', titulo: 'Guarda tus favoritas', desc: 'Pulsa la estrella en cualquier receta para guardarla. Tus menus también se pueden guardar con 💾 para reutilizarlos.' },
  ]

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
            <h2 className="text-lg font-bold mb-4">🎲 ¿Qué te apetece esta semana?</h2>
            <div className="space-y-4">
              {/* Días y franjas */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">¿Para cuántos días?</p>
                  <div className="flex gap-2">
                    {([
                      { key: 'semana',        label: 'Semana completa' },
                      { key: 'laboral',       label: 'Lun – Vie' },
                      { key: 'personalizado', label: 'Personalizado' },
                    ] as const).map(({ key, label }) => (
                      <button key={key} onClick={() => setDiasConfig(key)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${diasConfig === key ? 'border-green-select bg-green-50 dark:bg-green-900/30 text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {diasConfig === 'personalizado' && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {DIAS.map(d => (
                        <button key={d}
                          onClick={() => setDiasPersonalizados(prev => { const next = new Set(prev); next.has(d) ? next.delete(d) : next.add(d); return next })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-colors ${diasPersonalizados.has(d) ? 'border-green-select bg-green-50 dark:bg-green-900/30 text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                          {DIAS_LABEL[d].slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">¿Qué comidas?</p>
                  <div className="flex gap-2">
                    {([
                      { key: 'ambas',  label: '🍽️ Comida y cena' },
                      { key: 'comida', label: '☀️ Solo comida' },
                      { key: 'cena',   label: '🌙 Solo cena' },
                    ] as const).map(({ key, label }) => (
                      <button key={key} onClick={() => setFranjaConfig(key)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${franjaConfig === key ? 'border-green-select bg-green-50 dark:bg-green-900/30 text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700" />
              {listasCompartidas.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-0.5">¿Qué lista quieres usar?</label>
                  <p className="text-xs text-gray-400 mb-1.5">Ahí es donde irán los ingredientes en casa y la compra del menú</p>
                  <div className="space-y-1.5">
                    <button onClick={() => setCuestionario(p => ({ ...p, listaDestinoId: null }))}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 text-left transition-colors ${!cuestionario.listaDestinoId ? 'bg-green-50 dark:bg-green-900/20 border-green-select' : 'border-gray-200 dark:border-gray-700 hover:border-green-select/60'}`}>
                      <span className="text-lg">👤</span>
                      <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100">Mi lista personal</span>
                      {!cuestionario.listaDestinoId && <span className="text-green-select">✓</span>}
                    </button>
                    {listasCompartidas.map(lista => (
                      <button key={lista.id} onClick={() => setCuestionario(p => ({ ...p, listaDestinoId: lista.id }))}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border-2 text-left transition-colors ${cuestionario.listaDestinoId === lista.id ? 'bg-green-50 dark:bg-green-900/20 border-green-select' : 'border-gray-200 dark:border-gray-700 hover:border-green-select/60'}`}>
                        <span className="text-lg">👥</span>
                        <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{lista.nombre}</span>
                        {cuestionario.listaDestinoId === lista.id && <span className="text-green-select">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Tipo de cocina</label>
                <select value={cuestionario.cocina} onChange={e => setCuestionario(p => ({ ...p, cocina: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
                  <option value="combinado">🎲 Combinado (mezcla varios estilos)</option>
                  <option value="aleatorio">🔀 Aleatorio (la IA elige libremente)</option>
                  <option value="española y mediterránea">🥘 Española y mediterránea</option>
                  <option value="italiana">🍝 Italiana</option>
                  <option value="asiática">🍜 Asiática</option>
                  <option value="americana">🍔 Americana</option>
                  <option value="mexicana">🌮 Mexicana</option>
                  <option value="variada e internacional">🌍 Variada e internacional</option>
                  <option value="saludable y ligera">🥗 Saludable y ligera</option>
                  <option value="tradicional española">🍲 Tradicional española</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Tiempo para cocinar</label>
                <select value={cuestionario.tiempo} onChange={e => setCuestionario(p => ({ ...p, tiempo: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
                  <option value="combinado">🎲 Combinado (variado)</option>
                  <option value="rápido (menos de 30 min)">⚡ Rápido (menos de 30 min)</option>
                  <option value="normal (30-60 min)">🕐 Normal (30–60 min)</option>
                  <option value="sin prisa (más de 1 hora)">🍲 Sin prisa (más de 1 hora)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Dificultad de las recetas</label>
                <select value={cuestionario.dificultad} onChange={e => setCuestionario(p => ({ ...p, dificultad: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
                  <option value="combinado">🎲 Combinado (mezcla de todo)</option>
                  <option value="fácil">😊 Fácil (≤30 min, técnicas simples)</option>
                  <option value="media">👨‍🍳 Media (30–60 min)</option>
                  <option value="difícil">🔥 Difícil (elaboradas, +45 min)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">¿Algo que quieras comer? (opcional)</label>
                <input type="text" value={cuestionario.extra} onChange={e => setCuestionario(p => ({ ...p, extra: e.target.value }))}
                  placeholder="Ej: quiero pasta, algo con salmón..."
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">¿Algo que NO quieras? (opcional)</label>
                <input type="text" value={cuestionario.no_quiero} onChange={e => setCuestionario(p => ({ ...p, no_quiero: e.target.value }))}
                  placeholder="Ej: nada de pasta, sin marisco..."
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalSorpresa(false)} className="flex-1 border border-gray-300 dark:border-gray-600 rounded-xl py-3 text-sm font-medium">Cancelar</button>
              <button onClick={generarSorpresa} className="flex-1 bg-purple-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-purple-700">🎲 ¡Sorpréndeme!</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Guardar */}
      {modalGuardar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-sm shadow-xl mx-4">
            <h2 className="text-lg font-bold mb-4">💾 Guardar semana</h2>
            <input type="text" value={nombreGuardar} onChange={e => setNombreGuardar(e.target.value)}
              placeholder={`Semana ${new Date().toLocaleDateString('es-ES')}`}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm mb-4 bg-white dark:bg-gray-800" />
            <div className="flex gap-3">
              <button onClick={() => setModalGuardar(false)} className="flex-1 border border-gray-300 rounded-xl py-2.5 text-sm">Cancelar</button>
              <button onClick={guardarSemana} className="flex-1 bg-green-500 text-white rounded-xl py-2.5 text-sm font-bold">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Generar menú */}
      {modalGenerar && perfil && (
        <ModalGenerarMenu
          dificultadPerfil={(perfil as { dificultad_recetas?: string })?.dificultad_recetas as import('../types').DificultadPreferida ?? 'combinado'}
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

      {/* Banner de error */}
      {errorMsg && (
        <div className="mb-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-red-500 shrink-0 mt-0.5">⚠️</span>
          <p className="text-sm text-red-700 dark:text-red-300 flex-1">{errorMsg}</p>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 sticky top-4 bg-warm-white dark:bg-gray-950 py-2 z-10 gap-2">
        <h1 className="text-2xl font-black shrink-0 tracking-tight">Tu semana</h1>
        <div className="flex gap-1.5 flex-wrap justify-end">
          <button onClick={() => { setMostrarFavoritas(p => !p); setMostrarGuardadas(false) }}
            className="text-sm border rounded-card px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
            {favoritas.length > 0 ? `⭐ (${favoritas.length})` : '⭐ Favoritas'}
          </button>
          <button onClick={() => { setMostrarGuardadas(p => !p); setMostrarFavoritas(false) }}
            className="text-sm border rounded-card px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
            📂 {semanasGuardadas.length > 0 ? `(${semanasGuardadas.length})` : 'Guardadas'}
          </button>
          <button onClick={() => setModalGuardar(true)} disabled={totalListos === 0}
            className="text-sm border rounded-card px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
            💾 Guardar
          </button>
          <button onClick={abrirModalSorpresa} disabled={generando || !perfil}
            className="text-sm border rounded-card px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
            🎲 Sorpresa
          </button>
          <button onClick={() => setModalGenerar(true)} disabled={generando || !perfil}
            className="text-sm bg-green-select text-white rounded-card px-3 py-1.5 font-semibold hover:bg-green-600 disabled:opacity-50">
            {generando ? 'Generando...' : 'Generar ✨'}
          </button>
          <div className="relative">
            <button
              onClick={() => setInfoGenerarVisible(v => !v)}
              className="w-7 h-7 rounded-full border-2 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 text-xs font-bold hover:border-green-select hover:text-green-select transition-colors flex items-center justify-center"
            >
              ?
            </button>
            {infoGenerarVisible && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setInfoGenerarVisible(false)} />
                <div className="absolute right-0 top-9 z-50 w-72 bg-white dark:bg-gray-900 rounded-xl shadow-card-lg border border-gray-100 dark:border-gray-800 p-4 text-sm">
                  <div className="space-y-3">
                    <div className="flex gap-2.5">
                      <span className="text-xl shrink-0">✨</span>
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-100 mb-0.5">Generar</p>
                        <p className="text-gray-500 dark:text-gray-400 leading-snug">Te pregunta qué tipo de cocina, dificultad, tiempo y ocasión quieres. También puedes elegir qué ingredientes usar. Más control, resultado más ajustado a ti.</p>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 dark:border-gray-800" />
                    <div className="flex gap-2.5">
                      <span className="text-xl shrink-0">🎲</span>
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-100 mb-0.5">Sorpresa</p>
                        <p className="text-gray-500 dark:text-gray-400 leading-snug">La IA elige el menú libremente basándose en tu perfil. Ideal para cuando no tienes nada en mente y quieres dejarte sorprender.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <ProgressBar value={totalListos} max={14} label="Recetas generadas" />
        {totalListos > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            Opciones extra: {diasExtra.size}/{LIMITE_DIAS_EXTRA} días usados
          </p>
        )}
      </div>

      {/* Widget nutricional — solo cuando hay recetas */}
      {resumenSemanal.numSlots >= 2 && (
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-orange-50 dark:bg-orange-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-orange-500">{resumenSemanal.totalKcal.toLocaleString('es')}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">kcal totales</p>
          </div>
          <div className="flex-1 bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-blue-500">{resumenSemanal.mediaKcal}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">kcal / plato</p>
          </div>
          <div className="flex-1 bg-green-50 dark:bg-green-950/30 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-green-select">{resumenSemanal.numSlots}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">platos</p>
          </div>
        </div>
      )}

      {/* Empty state: primera vez o menú vacío */}
      {menuVacio && (
        <div className="mb-4 bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900 rounded-xl p-5 text-center">
          <p className="text-3xl mb-3">🥗</p>
          <h2 className="font-bold text-base mb-1">Tu menú semanal está vacío</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Elige para cuántos días y qué comidas quieres generar, luego pulsa <strong>Generar mi menú ✨</strong>.
          </p>
          <button
            onClick={() => setModalGenerar(true)}
            disabled={!perfil}
            className="bg-green-select text-white rounded-card px-6 py-2.5 font-semibold text-sm hover:bg-green-600 disabled:opacity-50"
          >
            Generar mi menú ✨
          </button>
        </div>
      )}

      {/* Selector de días y franjas */}
      {menuVacio && (
        <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl shadow-card p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">¿Para cuántos días?</p>
            <div className="flex gap-2">
              {([
                { key: 'semana',        label: 'Semana completa' },
                { key: 'laboral',       label: 'Lun – Vie' },
                { key: 'personalizado', label: 'Personalizado' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDiasConfig(key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${diasConfig === key ? 'border-green-select bg-green-50 dark:bg-green-900/30 text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {diasConfig === 'personalizado' && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {DIAS.map(d => (
                  <button
                    key={d}
                    onClick={() => setDiasPersonalizados(prev => {
                      const next = new Set(prev)
                      next.has(d) ? next.delete(d) : next.add(d)
                      return next
                    })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-colors ${diasPersonalizados.has(d) ? 'border-green-select bg-green-50 dark:bg-green-900/30 text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}
                  >
                    {DIAS_LABEL[d].slice(0, 3)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">¿Qué comidas?</p>
            <div className="flex gap-2">
              {([
                { key: 'ambas',  label: 'Comida y cena' },
                { key: 'comida', label: 'Solo comida' },
                { key: 'cena',   label: 'Solo cena' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFranjaConfig(key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${franjaConfig === key ? 'border-green-select bg-green-50 dark:bg-green-900/30 text-green-select' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Favoritas */}
      {mostrarFavoritas && (
        <div className="mb-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-sm">⭐ Recetas favoritas</h3>
          </div>
          {favoritas.length === 0
            ? <p className="text-sm text-gray-400 p-4 text-center">Pulsa ☆ en cualquier receta para guardarla aquí</p>
            : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-80 overflow-y-auto">
                {favoritas.map(r => (
                  <div key={r.nombre} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-lg shrink-0">⭐</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.nombre}</p>
                      <p className="text-xs text-gray-400 truncate">{r.descripcion_corta}</p>
                      <p className="text-xs text-gray-400">⏱ {r.tiempo_prep} min · 🔥 {r.calorias_aprox} kcal · {r.dificultad}</p>
                    </div>
                    <button onClick={() => toggleFavorita(r)} className="text-yellow-400 hover:text-gray-400 text-lg shrink-0" title="Quitar de favoritas">★</button>
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
            <h3 className="font-semibold text-sm">📂 Semanas guardadas</h3>
          </div>
          {semanasGuardadas.length === 0
            ? <p className="text-sm text-gray-400 p-4 text-center">No tienes semanas guardadas aún</p>
            : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {semanasGuardadas.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-lg">📅</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.nombre}</p>
                      <p className="text-xs text-gray-400">{s.fecha}</p>
                    </div>
                    <button onClick={() => cargarSemana(s)} className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-lg font-medium">Cargar</button>
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
                  <button
                    onClick={() => regenerarDia(dia)}
                    disabled={generando}
                    title={`Regenerar ${DIAS_LABEL[dia]}`}
                    className="text-xs text-gray-400 hover:text-gray-600 ml-2 disabled:opacity-40"
                  >
                    🔄
                  </button>
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
                          puedeAnadirExtra={diasExtra.has(dia) || diasExtra.size < LIMITE_DIAS_EXTRA}
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

      {/* Onboarding — se muestra solo la primera vez */}
      {showOnboarding && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 pointer-events-none">
          <div className="max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 pointer-events-auto">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-3xl shrink-0">{ONBOARDING_STEPS[onboardingStep].emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{ONBOARDING_STEPS[onboardingStep].titulo}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{ONBOARDING_STEPS[onboardingStep].desc}</p>
              </div>
              <button onClick={dismissOnboarding} className="text-gray-300 hover:text-gray-500 text-sm shrink-0">✕</button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {ONBOARDING_STEPS.map((_, i) => (
                  <button key={i} onClick={() => setOnboardingStep(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${i === onboardingStep ? 'bg-green-select' : 'bg-gray-200 dark:bg-gray-700'}`} />
                ))}
              </div>
              {onboardingStep < ONBOARDING_STEPS.length - 1 ? (
                <button onClick={() => setOnboardingStep(s => s + 1)}
                  className="text-xs font-semibold text-green-select hover:text-green-700">
                  Siguiente →
                </button>
              ) : (
                <button onClick={dismissOnboarding}
                  className="text-xs font-semibold bg-green-select text-white px-3 py-1.5 rounded-lg">
                  ¡Entendido!
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {totalSeleccionadas > 0 && (
        <div className="mt-8 sticky bottom-24 flex justify-center">
          <button onClick={irALista}
            className="bg-orange-accent text-white border-2 border-orange-accent/80 rounded-full px-8 py-3 text-base font-bold shadow-lg shadow-orange-accent/30 hover:opacity-90 active:scale-95 transition-all"
            style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
            🛒 Ver lista ({totalSeleccionadas} comidas)
          </button>
        </div>
      )}

    </div>
  )
}
