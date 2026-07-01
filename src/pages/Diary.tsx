import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dreamsApi } from '../lib/queries'
import { DreamCard } from '../components/dreams/DreamCard'
import { DreamForm } from '../components/dreams/DreamForm'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import type { Dream } from '../types'

export default function Diary() {
  const qc = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Dream | null>(null)
  const [analyzing, setAnalyzing] = useState<string | null>(null)

  const { data: dreams = [], isLoading } = useQuery({
    queryKey: ['dreams'],
    queryFn: () => dreamsApi.list({ limit: 50 }).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: dreamsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dreams'] }),
  })

  const analyzeMutation = useMutation({
    mutationFn: (id: string) => dreamsApi.analyze(id).then((r) => r.data),
    onMutate: (id) => setAnalyzing(id),
    onSettled: () => {
      setAnalyzing(null)
      qc.invalidateQueries({ queryKey: ['dreams'] })
    },
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Mi diario</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {dreams.length} sueño{dreams.length !== 1 ? 's' : ''} registrado{dreams.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
          + Nuevo sueño
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-dream-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : dreams.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🌙</div>
          <p className="text-slate-400 text-lg">Aún no has registrado ningún sueño.</p>
          <p className="text-slate-500 text-sm mt-1">Los sueños se olvidan en minutos — anótalos ahora.</p>
          <Button onClick={() => setFormOpen(true)} className="mt-6">
            Registrar mi primer sueño
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {dreams.map((dream) => (
            <DreamCard
              key={dream.id}
              dream={dream}
              actions={
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => analyzeMutation.mutate(dream.id)}
                    loading={analyzing === dream.id}
                    title="Analizar con IA"
                  >
                    ✦
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditing(dream); setFormOpen(true) }}
                  >
                    ✎
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm('¿Borrar este sueño?')) deleteMutation.mutate(dream.id)
                    }}
                  >
                    ✕
                  </Button>
                </div>
              }
            />
          ))}
        </div>
      )}

      {/* Analysis disclaimer */}
      {dreams.some((d) => d.summary) && (
        <p className="text-xs text-slate-600 text-center mt-8">
          ✦ Los análisis son interpretaciones simbólicas y reflexivas, no diagnósticos psicológicos ni verdades literales.
        </p>
      )}

      {/* Form Modal */}
      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        title={editing ? 'Editar sueño' : 'Nuevo sueño'}
        className="max-w-2xl"
      >
        <DreamForm
          dream={editing ?? undefined}
          onClose={() => { setFormOpen(false); setEditing(null) }}
        />
      </Modal>
    </div>
  )
}
