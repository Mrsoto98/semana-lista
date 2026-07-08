import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { friendsApi } from '../lib/queries'
import { formatUserNumber } from '../lib/formatUserNumber'
import { useAuthStore } from '../lib/store'
import type { Friend } from '../types'

interface SearchUser {
  id: string
  name: string
  avatar_url: string | null
  bio: string | null
  user_number: number | null
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ name, url, size = 10 }: { name: string; url?: string | null; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full shrink-0 object-cover`
  if (url) return <img src={url} className={cls} alt="" />
  return (
    <div className={`${cls} flex items-center justify-center text-sm font-bold text-white`}
      style={{ background: 'linear-gradient(135deg, rgba(var(--glow-color),0.7), rgba(var(--glass-tint),0.8))' }}>
      {name?.[0]?.toUpperCase()}
    </div>
  )
}

export default function Friends() {
  const qc       = useQueryClient()
  const navigate  = useNavigate()
  const { user } = useAuthStore()
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<SearchUser[]>([])
  const [searching, setSearching]   = useState(false)
  const [searchErr, setSearchErr]   = useState('')
  const [copiedNum, setCopiedNum]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.list().then(r => r.data),
    refetchInterval: 30_000, // poll every 30s for new requests
  })

  const accepted  = friends.filter(f => f.status === 'accepted')
  const received  = friends.filter(f => f.status === 'pending' && f.direction === 'received')
  const sent      = friends.filter(f => f.status === 'pending' && f.direction === 'sent')

  // ── Mutations ─────────────────────────────────────────────────
  const acceptMutation  = useMutation({ mutationFn: friendsApi.accept,  onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }) })
  const declineMutation = useMutation({ mutationFn: friendsApi.decline, onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }) })
  const removeMutation  = useMutation({ mutationFn: friendsApi.remove,  onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }) })
  const requestMutation = useMutation({
    mutationFn: friendsApi.request,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] })
      setResults([])
      setQuery('')
    },
  })

  // ── Search ────────────────────────────────────────────────────
  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault()
    const q = query.trim()
    if (!q || q.length < 2) { setSearchErr('Escribe al menos 2 caracteres'); return }
    setSearchErr('')
    setSearching(true)
    try {
      const { data } = await friendsApi.search(q)
      const list = data as unknown as SearchUser[]
      setResults(list)
      if (!list.length) setSearchErr('No se encontró ningún usuario con esa búsqueda.')
    } catch {
      setSearchErr('Error al buscar. Inténtalo de nuevo.')
    } finally {
      setSearching(false)
    }
  }

  // clear results when input clears
  useEffect(() => { if (!query) { setResults([]); setSearchErr('') } }, [query])

  function copyNumber() {
    if (!user?.user_number) return
    navigator.clipboard.writeText(formatUserNumber(user.user_number))
    setCopiedNum(true)
    setTimeout(() => setCopiedNum(false), 2000)
  }

  function friendRelation(userId: string) {
    return friends.find(f => f.id === userId)
  }

  return (
    <div className="animate-fade-in flex flex-col gap-5">

      {/* ── Mi número de soñador ── */}
      <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
        <Avatar name={user?.name ?? '?'} url={user?.avatar_url} size={10} />

        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-xs font-medium mb-0.5">{user?.name}</p>
          <p className="text-[10px] text-white/30 mb-1.5">Tu número de soñador único</p>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-2xl tracking-wider accent-text">
              #{formatUserNumber(user?.user_number)}
            </span>
            <button
              onClick={copyNumber}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border ${
                copiedNum
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-white/10 bg-white/5 text-white/35 hover:text-white hover:bg-white/10'
              }`}
            >
              {copiedNum ? (
                <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copiado</>
              ) : (
                <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar</>
              )}
            </button>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-white leading-none">{accepted.length}</p>
          <p className="text-[10px] text-white/30 mt-0.5">amigo{accepted.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ── Solicitudes recibidas ── */}
      {received.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white/70">Solicitudes recibidas</h3>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: 'rgba(var(--glow-color),0.7)' }}>
              {received.length}
            </span>
          </div>
          {received.map(f => (
            <div key={f.id} className="glass-card rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
              <button onClick={() => navigate(`/profile/${f.id}`)} className="shrink-0">
                <Avatar name={f.name} url={f.avatar_url} size={10} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{f.name}</p>
                {f.bio && <p className="text-[11px] text-white/35 truncate">{f.bio}</p>}
                <p className="text-[10px] text-white/25 mt-0.5">Quiere conectar contigo</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => acceptMutation.mutate(f.id)}
                  disabled={acceptMutation.isPending}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white glass-btn-primary transition-all active:scale-95 disabled:opacity-40"
                >
                  Aceptar
                </button>
                <button
                  onClick={() => declineMutation.mutate(f.id)}
                  disabled={declineMutation.isPending}
                  className="px-3 py-1.5 rounded-xl text-xs text-white/40 bg-white/5 hover:bg-white/10 transition-all active:scale-95"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Buscador ── */}
      <div className="glass-card rounded-2xl p-4 flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white/70">Buscar soñadores</h3>
          <p className="text-[11px] text-white/30 mt-0.5">Por número de soñador (0001) o correo electrónico</p>
        </div>

        <form onSubmit={doSearch} className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doSearch() } }}
              placeholder="0001 o correo…"
              className="glass-input w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 pr-8"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
          <button type="submit" disabled={searching || !query.trim()}
            className="glass-btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all active:scale-95">
            {searching
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            }
          </button>
        </form>

        {searchErr && <p className="text-xs text-white/35 italic">{searchErr}</p>}

        {results.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            {results.map(u => {
              const rel = friendRelation(u.id)
              const isPending = rel?.status === 'pending'
              const isAccepted = rel?.status === 'accepted'
              const justSent = requestMutation.variables === u.id && requestMutation.isPending
              return (
                <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/4 border border-white/6">
                  <button onClick={() => navigate(`/profile/${u.id}`)} className="shrink-0">
                    <Avatar name={u.name} url={u.avatar_url} size={9} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-tight">{u.name}</p>
                    <p className="text-[11px] text-white/35">#{formatUserNumber(u.user_number)}</p>
                    {u.bio && <p className="text-[10px] text-white/25 truncate mt-0.5">{u.bio}</p>}
                  </div>
                  {isAccepted ? (
                    <span className="text-[10px] text-white/30 shrink-0">Ya conectados ✓</span>
                  ) : isPending ? (
                    <span className="text-[10px] text-white/30 shrink-0">
                      {rel?.direction === 'sent' ? 'Solicitud enviada' : 'Te envió solicitud'}
                    </span>
                  ) : (
                    <button
                      onClick={() => requestMutation.mutate(u.id)}
                      disabled={justSent}
                      className="glass-btn-primary px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition-all active:scale-95 shrink-0"
                    >
                      {justSent
                        ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                        : '+ Añadir'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Solicitudes enviadas ── */}
      {sent.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider">Solicitudes enviadas</h3>
          {sent.map(f => (
            <div key={f.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
              <Avatar name={f.name} url={f.avatar_url} size={8} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/70">{f.name}</p>
                <p className="text-[10px] text-white/25">Pendiente de respuesta</p>
              </div>
              <button onClick={() => declineMutation.mutate(f.id)}
                className="text-[11px] text-white/20 hover:text-red-400 transition-colors px-2">
                Cancelar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Lista de amigos ── */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider">
          {accepted.length > 0 ? `${accepted.length} amigo${accepted.length !== 1 ? 's' : ''}` : 'Amigos'}
        </h3>
        {accepted.length === 0 ? (
          <div className="text-center py-10 glass-card rounded-2xl">
            <div className="text-4xl mb-3 animate-float inline-block">🌙</div>
            <p className="text-white/40 text-sm font-medium">Aún no tienes soñadores conectados</p>
            <p className="text-white/20 text-xs mt-1">Busca por número de soñador o email</p>
          </div>
        ) : (
          accepted.map(f => (
            <div key={f.id} className="glass-card rounded-2xl p-3.5 flex items-center gap-3">
              <button onClick={() => navigate(`/profile/${f.id}`)} className="shrink-0">
                <Avatar name={f.name} url={f.avatar_url} size={10} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{f.name}</p>
                {f.bio && <p className="text-[11px] text-white/35 truncate">{f.bio}</p>}
              </div>
              <button
                onClick={() => { if (confirm(`¿Eliminar a ${f.name}?`)) removeMutation.mutate(f.id) }}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
