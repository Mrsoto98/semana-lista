import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { friendsApi } from '../lib/queries'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import type { Friend } from '../types'

export default function Friends() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Friend[]>([])
  const [searching, setSearching] = useState(false)

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.list().then((r) => r.data),
  })

  const acceptMutation = useMutation({
    mutationFn: friendsApi.accept,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
  })
  const declineMutation = useMutation({
    mutationFn: friendsApi.decline,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
  })
  const removeMutation = useMutation({
    mutationFn: friendsApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
  })
  const requestMutation = useMutation({
    mutationFn: friendsApi.request,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
  })

  async function doSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!search.trim()) return
    setSearching(true)
    try {
      const { data } = await friendsApi.search(search)
      setSearchResults(data as unknown as Friend[])
    } finally {
      setSearching(false)
    }
  }

  const pending = friends.filter((f) => f.status === 'pending')
  const accepted = friends.filter((f) => f.status === 'accepted')

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Mis amigos</h1>
        <p className="text-slate-400 text-sm mt-0.5">{accepted.length} amigo{accepted.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Search users */}
      <Card className="mb-6">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Buscar soñadores</h3>
        <form onSubmit={doSearch} className="flex gap-2">
          <Input
            placeholder="Nombre o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" loading={searching} variant="secondary">Buscar</Button>
        </form>
        {searchResults.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {searchResults.map((u) => {
              const alreadyFriend = friends.some((f) => f.id === u.id)
              return (
                <div key={u.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-dream-700 flex items-center justify-center text-sm font-bold text-white">
                      {u.name[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-white">{u.name}</span>
                  </div>
                  {alreadyFriend ? (
                    <span className="text-xs text-slate-500">Ya conectados</span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => requestMutation.mutate(u.id)}
                      loading={requestMutation.variables === u.id && requestMutation.isPending}
                    >
                      + Añadir
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-slate-400 mb-3">
            Solicitudes pendientes ({pending.length})
          </h3>
          <div className="flex flex-col gap-2">
            {pending.map((f) => (
              <Card key={f.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-dream-700 flex items-center justify-center text-sm font-bold text-white">
                    {f.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{f.name}</p>
                    <p className="text-xs text-slate-500">
                      {f.direction === 'received' ? 'Quiere ser tu amigo' : 'Solicitud enviada'}
                    </p>
                  </div>
                </div>
                {f.direction === 'received' && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => acceptMutation.mutate(f.id)}>Aceptar</Button>
                    <Button size="sm" variant="ghost" onClick={() => declineMutation.mutate(f.id)}>Rechazar</Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Friends list */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-3">Amigos</h3>
        {accepted.length === 0 ? (
          <p className="text-slate-500 text-sm">Aún no tienes amigos en DreamLog.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {accepted.map((f) => (
              <Card key={f.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-dream-700 flex items-center justify-center text-sm font-bold text-white">
                    {f.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{f.name}</p>
                    {f.bio && <p className="text-xs text-slate-500 truncate max-w-[200px]">{f.bio}</p>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`¿Eliminar a ${f.name} de amigos?`)) removeMutation.mutate(f.id)
                  }}
                >
                  ✕
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
