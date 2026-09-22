import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

interface Message {
  id: string
  sender_id: string
  body: string
  read: boolean
  created_at: string
}

interface OtherUser {
  id: string
  name: string
  avatar_url: string | null
  avatar_emoji: string | null
}

export default function ConversationPage() {
  const { id: convId } = useParams<{ id: string }>()
  const { user }        = useAuthStore()
  const navigate        = useNavigate()
  const qc              = useQueryClient()
  const [text, setText] = useState('')
  const bottomRef       = useRef<HTMLDivElement>(null)

  const { data: otherUser } = useQuery({
    queryKey: ['conv-other', convId, user?.id],
    queryFn: async (): Promise<OtherUser | null> => {
      const { data } = await supabase
        .from('conversations')
        .select('participant_1, participant_2')
        .eq('id', convId!)
        .single()
      if (!data) return null
      const otherId = data.participant_1 === user!.id ? data.participant_2 : data.participant_1
      const { data: p } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, avatar_emoji')
        .eq('id', otherId)
        .single()
      return p as OtherUser | null
    },
    enabled: !!convId && !!user,
  })

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', convId],
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, body, read, created_at')
        .eq('conversation_id', convId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Message[]
    },
    enabled: !!convId,
  })

  // Real-time subscription
  useEffect(() => {
    if (!convId) return
    const channel = supabase
      .channel(`conv:${convId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: ['messages', convId] })
        qc.invalidateQueries({ queryKey: ['unread-msg', user?.id] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [convId])

  // Mark messages as read when opening
  useEffect(() => {
    if (!convId || !user || !messages.length) return
    const unread = messages.filter((m) => !m.read && m.sender_id !== user.id)
    if (!unread.length) return
    supabase
      .from('messages')
      .update({ read: true })
      .in('id', unread.map((m) => m.id))
      .then(() => {
        qc.invalidateQueries({ queryKey: ['unread-msg', user.id] })
        qc.invalidateQueries({ queryKey: ['conversations', user.id] })
      })
  }, [messages.length, convId, user])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: user!.id,
        body,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['messages', convId] })
      qc.invalidateQueries({ queryKey: ['conversations', user?.id] })
    },
  })

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sendMutation.isPending) return
    sendMutation.mutate(trimmed)
  }

  function formatTime(ts: string) {
    const d = new Date(ts)
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDay(ts: string) {
    const d = new Date(ts)
    const today = new Date()
    const diff = today.setHours(0,0,0,0) - d.setHours(0,0,0,0)
    if (diff === 0) return 'Hoy'
    if (diff === 86_400_000) return 'Ayer'
    return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }

  // Group messages by day
  const grouped: { day: string; messages: Message[] }[] = []
  for (const m of messages) {
    const day = new Date(m.created_at).toDateString()
    const last = grouped[grouped.length - 1]
    if (!last || last.day !== day) grouped.push({ day, messages: [m] })
    else last.messages.push(m)
  }

  return (
    <div className="flex flex-col min-h-svh" style={{ paddingBottom: 'max(80px, env(safe-area-inset-bottom) + 64px)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 pt-12 pb-3"
        style={{ background: 'rgb(var(--bg-deep))', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => navigate('/mensajes')} className="text-white/40 hover:text-white/70 transition-colors mr-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        {otherUser?.avatar_url ? (
          <img src={otherUser.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, rgba(var(--glow-color),0.7), rgba(var(--glass-tint),0.8))' }}>
            {otherUser?.avatar_emoji ?? otherUser?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-white leading-none">{otherUser?.name ?? '…'}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {grouped.map(({ day, messages: dayMsgs }) => (
          <div key={day}>
            <div className="text-center my-3">
              <span className="text-[10px] text-white/25 bg-white/5 rounded-full px-3 py-0.5">
                {formatDay(dayMsgs[0].created_at)}
              </span>
            </div>
            {dayMsgs.map((m) => {
              const isMine = m.sender_id === user?.id
              return (
                <div key={m.id} className={`flex mb-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[78%] rounded-2xl px-3.5 py-2.5"
                    style={{
                      background: isMine
                        ? `rgba(var(--glow-color), 0.55)`
                        : 'rgba(255,255,255,0.08)',
                      borderBottomRightRadius: isMine ? 6 : undefined,
                      borderBottomLeftRadius: !isMine ? 6 : undefined,
                    }}
                  >
                    <p className="text-sm text-white leading-snug break-words">{m.body}</p>
                    <p className="text-[9px] text-white/35 text-right mt-0.5 leading-none">{formatTime(m.created_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center gap-2 px-4 py-3"
        style={{
          background: 'rgb(var(--bg-deep))',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          placeholder="Mensaje…"
          maxLength={2000}
          className="glass-input flex-1 rounded-full px-4 py-2.5 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
          className="glass-btn-primary w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 transition-all active:scale-90"
        >
          {sendMutation.isPending
            ? <div className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin" />
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
          }
        </button>
      </div>
    </div>
  )
}
