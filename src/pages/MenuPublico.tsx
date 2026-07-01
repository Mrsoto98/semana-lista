// src/pages/MenuPublico.tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { MenuSemanal } from '../types'
import { DIAS, DIAS_LABEL, FRANJAS } from '../types'

export default function MenuPublico() {
  const { semanaId } = useParams<{ semanaId: string }>()
  const [menu, setMenu] = useState<MenuSemanal | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!semanaId) return
    ;(async () => {
      try {
        const { data } = await supabase
          .from('semanas')
          .select('recetas_elegidas')
          .eq('id', semanaId)
          .eq('es_publica', true)
          .single()
        setMenu(data?.recetas_elegidas ?? null)
      } catch {
        setMenu(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [semanaId])

  if (loading) return <div className="p-8 text-center">Cargando...</div>
  if (!menu) return <div className="p-8 text-center text-gray-500">Menú no encontrado</div>

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">🥗 Menú compartido</h1>
      <div className="space-y-4">
        {DIAS.map(dia => (
          <div key={dia} className="bg-white dark:bg-gray-900 rounded-card border p-3">
            <h2 className="font-bold mb-2">{DIAS_LABEL[dia]}</h2>
            {FRANJAS.map(franja => {
              const receta = menu[`${dia}_${franja}`]
              return (
                <div key={franja} className="mb-1">
                  <span className="text-xs text-gray-400 capitalize">{franja}: </span>
                  <span className="text-sm">{receta?.nombre ?? '—'}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
