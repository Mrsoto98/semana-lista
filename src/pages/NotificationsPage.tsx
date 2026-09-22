import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

interface Notification {
  id: string
  type: 'like' | 'comment' | 'comment_reply' | 'follow'
  actor_id: string | null
  actor_name: string | null
  dream_id: string | null
  dream_title: string | null
  comment_body: string | null
  read: boolean
  created_at: string
}

function typeIcon(type: Notification['type']) {
  if (type === 'like') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-rose-400 shrink-0 mt-0.5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
  if (type === 'comment_reply') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-400 shrink-0 mt-0.5">
      <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
    </svg>
  )
  if (type === 'follow') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0 mt-0.5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  )
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400 shrink-0 mt-0.5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function typeText(n: Notification) {
  const actor = n.actor_name ?? 'Alguien'
  const title = n.dream_title ? `"${n.dream_title}"` : 'tu sueño'
  if (n.type === 'like') return <><span className="text-white/80 font-semibold">{actor}</span> dio like a {title}</>
  if (n.type === 'comment_reply') return <><span className="text-white/80 font-semibold">{actor}</span> respondió a tu comentario en {title}</>
  if (n.type === 'follow') return <><span className="text-white/80 font-semibold">{actor}</span> ha empezado a seguirte</>
  return <><span className="text-white/80 font-semibold">{actor}</span> comentó {title}</>
}

export default function NotificationsPage() {
  const { user } = useAuthStore()
  const navigate  = useNavigate()
  const qc        = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as Notification[]
    },
    enabled: !!user,
  })

  // Mark all as read when page opens
  useEffect(() => {
    if (!user || !notifications.some((n) => !n.read)) return
    supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['unread-notif', user.id] })
        qc.invalidateQueries({ queryKey: ['notifications', user.id] })
      })
  }, [user, notifications.length])

  return (
    <div className="min-h-svh" style={{ paddingBottom: 100 }}>
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 pt-12 pb-4"
        style={{ background: 'rgb(var(--bg-deep))', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => navigate(-1)} className="text-white/40 hover:text-white/70 transition-colors mr-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-lg font-bold text-white">Notificaciones</h1>
      </div>

      <div className="px-4 py-3 flex flex-col gap-1">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-16 shimmer" />
          ))
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 text-white/30 text-sm">
            <div className="text-4xl mb-3">🔔</div>
            Sin notificaciones aún
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                if (n.type === 'follow' && n.actor_id) navigate(`/perfil/${n.actor_id}`)
                else if (n.dream_id) navigate(`/sueno/${n.dream_id}`)
              }}
              className="glass-card w-full rounded-2xl px-4 py-3 flex items-start gap-3 text-left transition-all active:scale-[0.98]"
              style={{ opacity: n.read ? 0.6 : 1 }}
            >
              {!n.read && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                  style={{ background: 'rgba(var(--glow-color),1)' }} />
              )}
              {typeIcon(n.type)}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60 leading-snug">{typeText(n)}</p>
                {n.comment_body && (
                  <p className="text-[10px] text-white/35 mt-1 italic line-clamp-1">"{n.comment_body}"</p>
                )}
                <p className="text-[10px] text-white/25 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
