import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { coincidencesApi } from '../lib/queries'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { scoreToPercent, formatDateShort } from '../lib/utils'
import type { Coincidence } from '../types'

export default function Coincidences() {
  const [scope, setScope] = useState<'all' | 'friends' | 'public'>('all')
  const qc = useQueryClient()

  const { data: coincidences = [], isLoading } = useQuery({
    queryKey: ['coincidences', scope],
    queryFn: () =>
      coincidencesApi
        .list(scope === 'all' ? undefined : scope)
        .then((r) => r.data),
  })

  const acceptMutation = useMutation({
    mutationFn: coincidencesApi.accept,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coincidences'] }),
  })

  const dismissMutation = useMutation({
    mutationFn: coincidencesApi.dismiss,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coincidences'] }),
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Coincidencias ✨</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Sueños que otras personas tuvieron parecidos al tuyo
        </p>
      </div>

      {/* Scope filter */}
      <div className="flex gap-2 mb-6">
        {(['all', 'friends', 'public'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              scope === s
                ? 'bg-dream-700 text-white'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            {s === 'all' ? 'Todas' : s === 'friends' ? '👥 Amigos' : '🌐 Público'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-dream-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : coincidences.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">✨</div>
          <p className="text-slate-400 text-lg">Aún no hay coincidencias.</p>
          <p className="text-slate-500 text-sm mt-1">
            Las coincidencias aparecen cuando alguien sueña algo semánticamente parecido a ti.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {coincidences.map((c) => (
            <CoincidenceCard
              key={c.id}
              c={c}
              onAccept={() => acceptMutation.mutate(c.id)}
              onDismiss={() => dismissMutation.mutate(c.id)}
              accepting={acceptMutation.variables === c.id && acceptMutation.isPending}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-slate-600 text-center mt-10">
        Los sueños privados nunca participan en el motor de coincidencias.
        En el ámbito público, la identidad permanece anónima hasta que ambas personas acepten.
      </p>
    </div>
  )
}

function CoincidenceCard({
  c, onAccept, onDismiss, accepting,
}: {
  c: Coincidence
  onAccept: () => void
  onDismiss: () => void
  accepting: boolean
}) {
  const pct = scoreToPercent(c.score)

  return (
    <Card className="animate-fade-in">
      {/* Score bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-dream-600 to-dream-400 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-dream-300 shrink-0">{pct}% similitud</span>
        <Badge>{c.scope === 'friends' ? '👥' : '🌐'} {c.scope}</Badge>
      </div>

      {/* Two dreams side by side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">Tu sueño — {formatDateShort(c.my_dream_date)}</p>
          <p className="text-sm text-white font-medium">{c.my_dream_title ?? '(sin título)'}</p>
          {c.my_dream_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {c.my_dream_tags.slice(0, 4).map((t) => <Badge key={t}>#{t}</Badge>)}
            </div>
          )}
        </div>
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-slate-500 mb-1">
            {c.their_user_name} — {formatDateShort(c.their_dream_date)}
          </p>
          <p className="text-sm text-white font-medium">
            {c.their_dream_title ?? (c.scope === 'public' && !c.accepted_a ? '(revela aceptando)' : '(sin título)')}
          </p>
          {c.their_dream_tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {c.their_dream_tags.slice(0, 4).map((t) => <Badge key={t}>#{t}</Badge>)}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {c.status === 'suggested' && (
        <div className="flex gap-2 mt-4">
          {!c.i_accepted ? (
            <Button size="sm" onClick={onAccept} loading={accepting}>
              ✓ Aceptar coincidencia
            </Button>
          ) : (
            <span className="text-sm text-green-400">✓ Aceptaste — esperando a la otra persona</span>
          )}
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Descartar
          </Button>
        </div>
      )}

      {c.status === 'accepted' && (
        <div className="mt-3 text-sm text-green-400 font-medium">✓ Ambos han aceptado esta coincidencia</div>
      )}
    </Card>
  )
}
