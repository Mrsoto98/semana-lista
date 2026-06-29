// src/pages/Menu.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CeldaMenu } from '../components/CeldaMenu'
import { ProgressBar } from '../components/ui/ProgressBar'
import { usePerfil } from '../hooks/usePerfil'
import { guardar, recuperar } from '../lib/storage'
import type { Dia, Franja, OpcionesSlot, MenuSemanal, ClaveMenu, Receta } from '../types'
import { DIAS, DIAS_LABEL, FRANJAS } from '../types'

type EstadoCelda = 'idle' | 'cargando' | 'listo' | 'error'
interface EstadoSlot { estado: EstadoCelda; datos?: OpcionesSlot }
type MapaEstados = Partial<Record<ClaveMenu, EstadoSlot>>
type MapaSeleccion = Partial<Record<ClaveMenu, number>>

interface SemanaGuardada {
  id: string; nombre: string; fecha: string; tipo: 'normal' | 'sorpresa'
  estados: MapaEstados; seleccion: MapaSeleccion
}

interface Cuestionario {
  cocina: string; tiempo: string; ocasion: string; extra: string; no_quiero: string
}

const CUESTIONARIO_INICIAL: Cuestionario = {
  cocina: 'española y mediterránea', tiempo: 'normal (30-60 min)',
  ocasion: 'semana normal', extra: '', no_quiero: '',
}


function perfilConNevera(perfil: object, extraPrompt?: string): object {
  return {
    ...perfil,
    nevera: [
      ...((perfil as { nevera?: string[] }).nevera ?? []),
      ...(recuperar<string[]>('lista_nevera') ?? []),
    ].filter((v, i, a) => a.indexOf(v) === i),
    ...(extraPrompt ? { extra_instrucciones: extraPrompt } : {}),
  }
}

export default function Menu() {
  const navigate = useNavigate()
  const { perfil, loading: perfilLoading } = usePerfil()

  const [estados, setEstados] = useState<MapaEstados>(() => recuperar<MapaEstados>('menu_estados') ?? {})
  const [seleccion, setSeleccion] = useState<MapaSeleccion>(() => recuperar<MapaSeleccion>('menu_seleccion') ?? {})
  const [generando, setGenerando] = useState(false)
  const [modalSorpresa, setModalSorpresa] = useState(false)
  const [cuestionario, setCuestionario] = useState<Cuestionario>(CUESTIONARIO_INICIAL)
  const [semanasGuardadas, setSemanasGuardadas] = useState<SemanaGuardada[]>(() => recuperar<SemanaGuardada[]>('semanas_guardadas') ?? [])
  const [modalGuardar, setModalGuardar] = useState(false)
  const [nombreGuardar, setNombreGuardar] = useState('')
  const [mostrarGuardadas, setMostrarGuardadas] = useState(false)
  const [mostrarFavoritas, setMostrarFavoritas] = useState(false)
  const [favoritas, setFavoritas] = useState<Receta[]>(() => recuperar<Receta[]>('recetas_favoritas') ?? [])
  const [errorMsg, setErrorMsg] = useState('')

  const favoritasNombres = new Set(favoritas.map(r => r.nombre))

  function toggleFavorita(receta: Receta) {
    const yaEsta = favoritasNombres.has(receta.nombre)
    const next = yaEsta ? favoritas.filter(r => r.nombre !== receta.nombre) : [receta, ...favoritas]
    setFavoritas(next)
    guardar('recetas_favoritas', next)
  }

  useEffect(() => { guardar('menu_estados', estados) }, [estados])
  useEffect(() => { guardar('menu_seleccion', seleccion) }, [seleccion])

  // Pone todos los slots en cargando, luego hace una sola llamada a la API
  async function generarSemanaCompleta(extraPrompt?: string) {
    if (!perfil || generando) return
    setGenerando(true)

    // Marcar todas las celdas como cargando
    const todoCargando: MapaEstados = {}
    for (const dia of DIAS) for (const franja of FRANJAS) todoCargando[`${dia}_${franja}` as ClaveMenu] = { estado: 'cargando' }
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
          perfil: perfilConNevera(perfil, extraPrompt),
          recetas_ya_usadas: recetasYaUsadas,
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setErrorMsg(msg)
      const todoError: MapaEstados = {}
      for (const dia of DIAS) for (const franja of FRANJAS) todoError[`${dia}_${franja}` as ClaveMenu] = { estado: 'error' }
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
        body: { dia, franja, perfil: perfilConNevera(perfil), recetas_ya_usadas: [] },
      })
      if (fnError) throw new Error(fnError.message)
      if (data?.error) throw new Error(data.mensaje)
      setEstados(prev => ({ ...prev, [clave]: { estado: 'listo', datos: data as OpcionesSlot } }))
      setSeleccion(prev => ({ ...prev, [clave]: 0 }))
    } catch {
      setEstados(prev => ({ ...prev, [clave]: { estado: 'error' } }))
    }
  }

  async function regenerarDia(dia: Dia) {
    await Promise.all([regenerarSlot(dia, 'comida'), regenerarSlot(dia, 'cena')])
  }

  async function generarSorpresa() {
    if (!perfil || generando) return
    setModalSorpresa(false)

    const estilos: Record<string, string> = {
      'española y mediterránea': 'española y mediterránea: paella, gazpacho, tortilla española, cocido madrileño, pisto manchego, bacalao al pil-pil, gambas al ajillo, ensalada mixta, merluza a la romana',
      'italiana': 'italiana: pasta carbonara, risotto, lasaña, gnocchi al pesto, ossobuco, bruschetta, pollo alla parmigiana, pasta arrabiata, sopa minestrone',
      'asiática': 'asiática: arroz frito wok, curry de pollo, ramen, pad thai, pollo teriyaki, gyozas, rollitos, salteado de verduras, cerdo agridulce',
      'americana': 'americana: hamburguesas caseras, BBQ de costillas, mac & cheese, wraps de pollo, chili con carne, chicken nuggets, alitas buffalo, burritos',
      'mexicana': 'mexicana: tacos, enchiladas, quesadillas, pozole, chiles rellenos, burritos, fajitas, guacamole con pollo, arroz a la mexicana',
      'variada e internacional': 'variada internacional: mezcla de cocinas del mundo, un plato diferente cada día',
      'saludable y ligera': 'saludable y ligera: ensaladas, verduras al vapor o horno, proteína magra, sin fritos, bowl de quinoa, wraps integrales',
      'tradicional española': 'tradicional española de cuchara: cocido, fabada, lentejas con chorizo, potaje, puchero, estofado de ternera, arroz con leche de postre',
    }

    const estiloDesc = estilos[cuestionario.cocina] ?? `cocina ${cuestionario.cocina}`

    const partes = [
      `OBLIGATORIO: TODAS las recetas de la semana deben ser de cocina ${estiloDesc}. Nada fuera de este estilo.`,
      cuestionario.tiempo !== 'normal (30-60 min)' ? `Tiempo: ${cuestionario.tiempo}.` : '',
      cuestionario.ocasion !== 'semana normal' ? `Ocasión: ${cuestionario.ocasion}.` : '',
      cuestionario.extra ? `También quiero: ${cuestionario.extra}.` : '',
      cuestionario.no_quiero ? `Excluir: ${cuestionario.no_quiero}.` : '',
    ].filter(Boolean).join(' ')

    await generarSemanaCompleta(partes)
  }

  async function generarConNevera() {
    if (!perfil || generando) return
    const nevera = [
      ...((perfil as { nevera?: string[] }).nevera ?? []),
      ...(recuperar<string[]>('lista_nevera') ?? []),
    ].filter((v, i, a) => a.indexOf(v) === i)

    if (nevera.length < 6) {
      setErrorMsg(`Tienes ${nevera.length} ingrediente${nevera.length === 1 ? '' : 's'} en casa. Añade al menos 6 en la lista de la compra (pulsa 🏠 en cualquier producto) para que pueda generar recetas con variedad.`)
      return
    }

    const prompt = `MODO NEVERA: Crea recetas usando ÚNICAMENTE estos ingredientes disponibles en casa: ${nevera.join(', ')}. Puedes asumir que hay sal, aceite, ajo y especias básicas. No uses ningún otro ingrediente. Adapta las combinaciones a lo disponible. Si algún slot no encaja bien, hazlo igualmente con lo que hay.`
    await generarSemanaCompleta(prompt)
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
    navigate('/lista')
  }

  const totalListos = DIAS.flatMap(d => FRANJAS.map(f => `${d}_${f}` as ClaveMenu)).filter(k => estados[k]?.estado === 'listo').length
  const totalSeleccionadas = Object.keys(seleccion).filter(k => estados[k as ClaveMenu]?.estado === 'listo').length

  if (perfilLoading) return null

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">

      {/* Modal Sorpréndeme */}
      {modalSorpresa && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">🎲 ¿Qué te apetece esta semana?</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Tipo de cocina</label>
                <select value={cuestionario.cocina} onChange={e => setCuestionario(p => ({ ...p, cocina: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
                  <option>española y mediterránea</option><option>italiana</option><option>asiática</option>
                  <option>americana</option><option>mexicana</option><option>variada e internacional</option>
                  <option>saludable y ligera</option><option>tradicional española</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Tiempo para cocinar</label>
                <select value={cuestionario.tiempo} onChange={e => setCuestionario(p => ({ ...p, tiempo: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
                  <option>rápido (menos de 30 min)</option><option>normal (30-60 min)</option><option>sin prisa (más de 1 hora)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Ocasión</label>
                <select value={cuestionario.ocasion} onChange={e => setCuestionario(p => ({ ...p, ocasion: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800">
                  <option>semana normal</option><option>visita de amigos o familia</option><option>cena romántica</option>
                  <option>comida con niños</option><option>semana de dieta</option><option>semana de caprichos</option>
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
        <h1 className="text-xl font-bold shrink-0">🗓️ Tu semana</h1>
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
          <button onClick={() => setModalSorpresa(true)} disabled={generando || !perfil}
            className="text-sm border rounded-card px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
            🎲 Sorpresa
          </button>
          <button onClick={generarConNevera} disabled={generando || !perfil}
            className="text-sm bg-green-select text-white rounded-card px-3 py-1.5 font-semibold hover:bg-green-600 disabled:opacity-50">
            {generando ? 'Generando...' : 'Generar ✨'}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <ProgressBar value={totalListos} max={14} label="Recetas generadas" />
      </div>

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

      {/* Grid semanal */}
      <div className="space-y-6">
        {DIAS.map(dia => (
          <div key={dia}>
            <div className="flex items-center mb-2">
              <h2 className="font-semibold text-gray-700 dark:text-gray-300">{DIAS_LABEL[dia]}</h2>
              <button
                onClick={() => regenerarDia(dia)}
                disabled={generando}
                title={`Regenerar ${DIAS_LABEL[dia]}`}
                className="text-xs text-gray-400 hover:text-gray-600 ml-2 disabled:opacity-40"
              >
                🔄
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {FRANJAS.map(franja => {
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
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {totalSeleccionadas > 0 && (
        <div className="mt-8 sticky bottom-4">
          <button onClick={irALista}
            className="w-full bg-orange-accent text-white rounded-card py-4 text-lg font-bold shadow-lg hover:opacity-90">
            Ver lista de la compra ({totalSeleccionadas} comidas) →
          </button>
        </div>
      )}
    </div>
  )
}
