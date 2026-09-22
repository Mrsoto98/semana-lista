import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import type { DreamComment } from '../../types'

interface Props {
  dreamId: string
  allowComments: boolean
  forceOpen?: boolean
}

function CommentBubble({
  comment, myId, onReply, onDelete, indent = 0,
}: {
  comment: DreamComment
  myId?: string
  onReply: (parentId: string, mentionName: string) => void
  onDelete: () => void
  indent?: number
}) {
  return (
    <div className="flex gap-2.5 items-start" style={{ marginLeft: indent * 28 }}>
      {comment.user_avatar ? (
        <img src={comment.user_avatar} className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" alt="" />
      ) : (
        <div className="w-6 h-6 rounded-full shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, rgba(var(--glow-color),0.7), rgba(var(--glass-tint),0.8))' }}>
          {comment.user_name?.[0]?.toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0 bg-white/4 rounded-xl px-3 py-2">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-[11px] font-semibold text-white/70">{comment.user_name}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/25">
              {new Date(comment.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            </span>
            {comment.user_id === myId && (
              <button onClick={onDelete} className="text-[10px] text-red-400/40 hover:text-red-400 transition-colors">✕</button>
            )}
          </div>
        </div>
        <p className="text-xs text-white/60 leading-relaxed">{comment.body}</p>
        <button
          onClick={() => onReply(comment.parent_comment_id ?? comment.id, comment.user_name)}
          className="mt-1.5 text-[10px] text-white/25 hover:text-white/50 transition-colors flex items-center gap-1"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
          </svg>
          Responder
        </button>
      </div>
    </div>
  )
}

async function fetchComments(dreamId: string): Promise<DreamComment[]> {
  const { data, error } = await supabase
    .from('dream_comments')
    .select('id, body, created_at, user_id, parent_comment_id, profiles!dream_comments_user_id_fkey(name, avatar_url)')
    .eq('dream_id', dreamId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((c: any) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    user_id: c.user_id,
    parent_comment_id: c.parent_comment_id ?? null,
    user_name: c.profiles?.name ?? 'Soñador',
    user_avatar: c.profiles?.avatar_url ?? null,
  }))
}

export function CommentSection({ dreamId, allowComments, forceOpen }: Props) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [replyingTo, setReplyingTo] = useState<{ parentId: string; mention: string } | null>(null)
  const [replyText, setReplyText] = useState('')

  const isOpen = forceOpen ?? open

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', dreamId],
    queryFn: () => fetchComments(dreamId),
    enabled: isOpen,
  })

  const postMutation = useMutation({
    mutationFn: async ({ body, parentId }: { body: string; parentId?: string }) => {
      if (!user) throw new Error('No autenticado')
      const { error } = await supabase.from('dream_comments').insert({
        dream_id: dreamId,
        user_id: user.id,
        body,
        parent_comment_id: parentId ?? null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      setText(''); setReplyText(''); setReplyingTo(null)
      qc.invalidateQueries({ queryKey: ['comments', dreamId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('dream_comments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', dreamId] }),
  })

  if (!allowComments) return null

  const topLevel = comments.filter(c => !c.parent_comment_id)
  const repliesMap: Record<string, DreamComment[]> = {}
  comments.filter(c => c.parent_comment_id).forEach(c => {
    const pid = c.parent_comment_id!
    if (!repliesMap[pid]) repliesMap[pid] = []
    repliesMap[pid].push(c)
  })

  function handleReply(parentId: string, mentionName: string) {
    setReplyingTo(r => r?.parentId === parentId ? null : { parentId, mention: mentionName })
    setReplyText(`@${mentionName} `)
  }

  return (
    <div className={forceOpen ? '' : 'mt-3 border-t border-white/6 pt-3'}>
      {!forceOpen && (
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {open ? 'Cerrar' : `Comentarios${comments.length > 0 ? ` (${comments.length})` : ''}`}
        </button>
      )}

      {isOpen && (
        <div className="flex flex-col gap-2" style={{ marginTop: forceOpen ? 0 : 12 }}>
          {isLoading ? (
            <div className="h-8 shimmer rounded-xl" />
          ) : topLevel.length === 0 ? (
            <p className="text-xs text-white/25 italic">Sin comentarios aún. ¡Sé el primero!</p>
          ) : (
            topLevel.map((c) => (
              <div key={c.id} className="flex flex-col gap-1.5">
                <CommentBubble
                  comment={c} myId={user?.id} indent={0}
                  onReply={handleReply}
                  onDelete={() => deleteMutation.mutate(c.id)}
                />
                {repliesMap[c.id]?.map((reply) => (
                  <CommentBubble
                    key={reply.id}
                    comment={reply} myId={user?.id} indent={1}
                    onReply={handleReply}
                    onDelete={() => deleteMutation.mutate(reply.id)}
                  />
                ))}
                {replyingTo?.parentId === c.id && (
                  <div className="ml-7 flex gap-2">
                    <input
                      autoFocus
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && replyText.trim()) {
                          e.preventDefault()
                          postMutation.mutate({ body: replyText.trim(), parentId: replyingTo.parentId })
                        }
                        if (e.key === 'Escape') setReplyingTo(null)
                      }}
                      placeholder="Respondiendo…"
                      maxLength={1000}
                      className="glass-input flex-1 rounded-xl px-3 py-1.5 text-xs"
                    />
                    <button onClick={() => postMutation.mutate({ body: replyText.trim(), parentId: replyingTo.parentId })}
                      disabled={!replyText.trim() || postMutation.isPending}
                      className="glass-btn-primary px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                    </button>
                    <button onClick={() => setReplyingTo(null)} className="text-white/25 hover:text-white/50 text-xs px-1">✕</button>
                  </div>
                )}
              </div>
            ))
          )}

          {user && (
            <div className="flex flex-col gap-1.5 mt-1">
              {postMutation.isError && (
                <p className="text-[11px] text-red-400/80 px-1">
                  Error: {(postMutation.error as Error)?.message ?? 'No se pudo enviar'}
                </p>
              )}
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
                      e.preventDefault()
                      postMutation.mutate({ body: text.trim() })
                    }
                  }}
                  placeholder="Escribe un comentario…"
                  maxLength={1000}
                  className="glass-input flex-1 rounded-xl px-3 py-2 text-xs"
                />
                <button
                  onClick={() => postMutation.mutate({ body: text.trim() })}
                  disabled={!text.trim() || postMutation.isPending}
                  className="glass-btn-primary px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40"
                >
                  {postMutation.isPending
                    ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
