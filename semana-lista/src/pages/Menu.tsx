// src/pages/Menu.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CeldaMenu } from '../components/CeldaMenu'
import { ProgressBar } from '../components/ui/ProgressBar'
import { usePerfil } from '../hooks/usePerfil'
import { guardar, recuperar } from '../lib/storage'
import type { Dia, Franja, OpcionesSlot, MenuSemanal, ClaveMenu } from '../types'
import { DIAS, DIAS_LABEL, FRANJAS } from '../types'

type EstadoCelda = 'idle' | 'cargando' | 'listo' | 'error'

interface EstadoSlot {
  estado: EstadoCelda
  datos?: OpcionesSlot
}

type MapaEstados = Partial<Record<ClaveMenu, EstadoSlot>>
type MapaSeleccion = Partial<Record<ClaveMenu, number>>

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generar-recetas`

async function fetchSlot(
  dia: Dia,
  franja: Franja,
  perfil: object,
  recetasYaUsadas: string[],
): Promise<OpcionesSlot> {
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dia, franja, perfil, recetas_ya_usadas: recetasYaUsadas }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(data.mensaje)
  return data as OpcionesSlot
}

export default function Menu() {
  const navigate = useNavigate()
  const { perfil, loading: perfilLoading } = usePerfil()

  const [estados, setEstados] = useState<MapaEstados>(() =>
    recuperar<MapaEstados>('menu_estados') ?? {}
  )
  const [seleccion, setSeleccion] = useState<MapaSeleccion>(() =>
    recuperar<MapaSeleccion>('menu_seleccion') ?? {}
  )
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    guardar('menu_estados', estados)
  }, [estados])

  useEffect(() => {
    guardar('menu_seleccion', seleccion)
  }, [seleccion])

  function setSlotEstado(clave: ClaveMenu, slot: EstadoSlot) {
    setEstados(prev => ({ ...prev, [clave]: slot }))
  }

  async function generarSlot(dia: Dia, franja: Franja, recetasYaUsadas: string[]) {
    if (!perfil) return
    const clave: ClaveMenu = `${dia}_${franja}`
    setSlotEstado(clave, { estado: 'cargando' })
    try {
      const datos = await fetchSlot(dia, franja, perfil, recetasYaUsadas)
      setSlotEstado(clave, { estado: 'listo', datos })
      setSeleccion(prev => ({ ...prev, [clave]: 0 }))
    } catch {
      setSlotEstado(clave, { estado: 'error' })
    }
  }

  async function generarSemana() {
    if (!perfil || generando) return
    setGenerando(true)

    // Fetch historial for "no repetir" prompt
    let recetasYaUsadas: string[] = []
    try {
      const { supabase } = await import('../lib/supabase')
      const { data } = await supabase
        .from('historial_recetas')
        .select('nombre_receta')
        .order('fecha_uso', { ascending: false })
        .limit(28)
      recetasYaUsadas = (data ?? []).map((r: { nombre_receta: string }) => r.nombre_receta)
    } catch { /* historial is a best-effort enhancement */ }

    // Launch all 14 in parallel — no await here, each updates its own state
    const promises = DIAS.flatMap(dia =>
      FRANJAS.map(franja => generarSlot(dia, franja, recetasYaUsadas))
    )
    await Promise.allSettled(promises)
    setGenerando(false)
  }

  function sorprendeme() {
    setSeleccion(prev => {
      const next = { ...prev }
      for (const dia of DIAS) {
        for (const franja of FRANJAS) {
          const clave: ClaveMenu = `${dia}_${franja}`
          if (next[clave] === undefined && estados[clave]?.datos) {
            next[clave] = Math.floor(Math.random() * 3)
          }
        }
      }
      return next
    })
  }

  const totalSeleccionadas = Object.keys(seleccion).filter(
    k => estados[k as ClaveMenu]?.estado === 'listo'
  ).length

  function irALista() {
    // Build MenuSemanal from selections
    const menu: MenuSemanal = {}
    for (const dia of DIAS) {
      for (const franja of FRANJAS) {
        const clave: ClaveMenu = `${dia}_${franja}`
        const idx = seleccion[clave]
        const opciones = estados[clave]?.datos?.opciones
        if (idx !== undefined && opciones) {
          menu[clave] = opciones[idx]
        }
      }
    }
    guardar('menu_semana', menu)
    navigate('/lista')
  }

  if (perfilLoading) return null

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4 sticky top-4 bg-warm-white dark:bg-gray-950 py-2 z-10">
        <h1 className="text-xl font-bold">🗓️ Tu semana</h1>
        <div className="flex gap-2">
          <button
            onClick={sorprendeme}
            title="Autoseleccionar opciones aleatorias"
            className="text-sm border rounded-card px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            🎲 Sorpréndeme
          </button>
          <button
            onClick={generarSemana}
            disabled={generando || !perfil}
            className="text-sm bg-green-select text-white rounded-card px-3 py-1.5 font-semibold hover:bg-green-600 disabled:opacity-50"
          >
            {generando ? 'Generando...' : 'Generar mi semana ✨'}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <ProgressBar
          value={totalSeleccionadas}
          max={14}
          label="Comidas elegidas"
        />
      </div>

      <div className="space-y-6">
        {DIAS.map(dia => (
          <div key={dia}>
            <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {DIAS_LABEL[dia]}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {FRANJAS.map(franja => {
                const clave: ClaveMenu = `${dia}_${franja}`
                const slot = estados[clave] ?? { estado: 'idle' as EstadoCelda }
                return (
                  <div key={franja}>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-1 capitalize">
                      {franja}
                    </p>
                    <CeldaMenu
                      dia={dia}
                      franja={franja}
                      estado={slot.estado}
                      datos={slot.datos}
                      onReintentar={() => generarSlot(dia, franja, [])}
                      seleccionada={seleccion[clave] ?? 0}
                      onSeleccionar={i =>
                        setSeleccion(prev => ({ ...prev, [clave]: i }))
                      }
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {totalSeleccionadas === 14 && (
        <div className="mt-8 sticky bottom-4">
          <button
            onClick={irALista}
            className="w-full bg-orange-accent text-white rounded-card py-4 text-lg font-bold shadow-lg hover:opacity-90"
          >
            Ver lista de la compra →
          </button>
        </div>
      )}
    </div>
  )
}
