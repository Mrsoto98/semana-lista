import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

interface ConvRow {
  id: string
  participant_1: string
  participant_2: string
  last_message_at: string
}

interface OtherUser {
  id: string
  name: string
  avatar_url: string | null
  avatar_emoji: string | null
}

interface ConvItem {
  id: string
  other: OtherUser
  last_message_at: string
  last_message: string | null
  unread: boolean
}

export default function MessagesPage() {
  const { user }  = useAuthStore()
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<OtherUser[]>([])
  const [searching, setSearching] = useState(false)

  const { data: convItems = [], isLoading } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async (): Promise<ConvItem[]> => {
      const { data: convs, error } = await supabase
        .from('conversations')
        .select('id, participant_1, participant_2, last_message_at')
        .or(`participant_1.eq.${user!.id},participant_2.eq.${user!.id}`)
        .order('last_message_at', { ascending: false })
      if (error) throw error
      if (!convs?.length) return []

      const otherIds = convs.map((c: ConvRow) =>
        c.participant_1 === user!.id ? c.participant_2 : c.participant_1,
      )

      const [profilesRes, lastMsgsRes, unreadRes] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url, avatar_emoji').in('id', otherIds),
        supabase.from('messages')
          .select('conversation_id, body, created_at')
          .in('conversation_id', convs.map((c: ConvRow) => c.id))
          .order('created_at', { ascending: false })
          .limit(convs.length * 2),
        supabase.from('messages')
          .select('conversation_id', { count: 'exact' })
          .in('conversation_id', convs.map((c: ConvRow) => c.id))
          .eq('read', false)
          .neq('sender_id', user!.id),
      ])

      const profileMap: Record<string, OtherUser> = {}
      for (const p of (profilesRes.data ?? [])) profileMap[p.id] = p

      const lastMsgMap: Record<string, string> = {}
      for (const m of (lastMsgsRes.data ?? [])) {
        if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m.body
      }

      const unreadSet = new Set<string>()
      for (const r of (unreadRes.data ?? [])) unreadSet.add(r.conversation_id)

      return convs.map((c: ConvRow) => {
        const otherId = c.participant_1 === user!.id ? c.participant_2 : c.participant_1
        return {
          id: c.id,
          other: profileMap[otherId] ?? { id: otherId, name: 'Usuario', avatar_url: null, avatar_emoji: null },
          last_message_at: c.last_message_at,
          last_message: lastMsgMap[c.id] ?? null,
          unread: unreadSet.has(c.id),
        }
      })
    },
    enabled: !!user,
    refetchInterval: 20_000,
  })

  async function handleSearch(q: string) {
    setSearch(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, avatar_emoji')
      .ilike('name', `%${q.trim()}%`)
      .neq('id', user!.id)
      .limit(8)
    setSearchResults((data ?? []) as OtherUser[])
    setSearching(false)
  }

  const startConvMutation = useMutation({
    mutationFn: async (otherId: string) => {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        user_a: user!.id,
        user_b: otherId,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (convId) => {
      setSearch(''); setSearchResults([])
      qc.invalidateQueries({ queryKey: ['conversations', user?.id] })
      navigate(`/mensajes/${convId}`)
    },
  })

  return (
    <div className="min-h-svh" style={{ paddingBottom: 100 }}>
      <div className="sticky top-0 z-10 px-4 py-3 flex items-center gap-3"
        style={{ background: 'rgb(var(--bg-deep))', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h1 className="text-base font-bold text-white shrink-0">Mensajes</h1>
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar persona…"
            className="glass-input w-full rounded-xl pl-8 pr-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col">
        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="border-b border-white/6">
            {searchResults.map((u) => (
              <button
                key={u.id}
                onClick={() => startConvMutation.mutate(u.id)}
                disabled={startConvMutation.isPending}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/4 transition-colors"
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, rgba(var(--glow-color),0.7), rgba(var(--glass-tint),0.8))' }}>
                    {u.avatar_emoji ?? u.name[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-white/80 font-medium">{u.name}</span>
                {startConvMutation.isPending && <div className="ml-auto w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />}
              </button>
            ))}
          </div>
        )}

        {/* Conversation list */}
        {isLoading ? (
          <div className="px-4 pt-3 flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl h-16 shimmer" />
            ))}
          </div>
        ) : convItems.length === 0 && !search ? (
          <div className="text-center py-24 text-white/30 text-sm">
            <div className="text-4xl mb-3">💬</div>
            Sin mensajes todavía
            <p className="text-xs mt-1 text-white/20">Busca a alguien para empezar</p>
          </div>
        ) : (
          convItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(`/mensajes/${item.id}`)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/4 transition-colors border-b border-white/4"
            >
              <div className="relative shrink-0">
                {item.other.avatar_url ? (
                  <img src={item.other.avatar_url} className="w-12 h-12 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, rgba(var(--glow-color),0.7), rgba(var(--glass-tint),0.8))' }}>
                    {item.other.avatar_emoji ?? item.other.name[0]?.toUpperCase()}
                  </div>
                )}
                {item.unread && (
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                    style={{ background: 'rgba(var(--glow-color),1)', borderColor: 'rgb(var(--bg-deep))' }} />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white/85">{item.other.name}</span>
                  <span className="text-[10px] text-white/25 shrink-0">
                    {formatDistanceToNow(new Date(item.last_message_at), { addSuffix: false, locale: es })}
                  </span>
                </div>
                {item.last_message && (
                  <p className="text-xs text-white/40 truncate mt-0.5">{item.last_message}</p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
