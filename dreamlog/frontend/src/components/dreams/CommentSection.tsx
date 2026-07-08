import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commentsApi, pollApi } from '../../lib/queries'
import { useAuthStore } from '../../lib/store'
import type { DreamComment, DreamPoll } from '../../types'

interface Props {
  dreamId: string
  allowComments: boolean
  forceOpen?: boolean
}

// ── Single comment bubble ─────────────────────────────────────
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

// ── Poll display ──────────────────────────────────────────────
function PollCard({ dreamId, poll: initial }: { dreamId: string; poll: DreamPoll }) {
  const qc = useQueryClient()
  const { data: poll = initial } = useQuery({
    queryKey: ['poll', dreamId],
    queryFn: () => pollApi.get(dreamId).then(r => r.data as DreamPoll),
    initialData: initial,
  })

  const voteMutation = useMutation({
    mutationFn: (idx: number) =>
      poll.user_vote === idx ? pollApi.unvote(dreamId) : pollApi.vote(dreamId, idx),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['poll', dreamId] }),
  })

  return (
    <div className="bg-white/4 rounded-xl p-3 mb-3 border border-white/6">
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-sm">📊</span>
        <p className="text-xs font-semibold text-white/75">{poll.question}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {poll.options.map((opt, i) => {
          const votes  = poll.vote_counts?.[i] ?? 0
          const total  = poll.total_votes ?? 0
          const pct    = total > 0 ? Math.round((votes / total) * 100) : 0
          const isMine = poll.user_vote === i
          return (
            <button key={i} onClick={() => voteMutation.mutate(i)}
              className="relative w-full text-left rounded-lg overflow-hidden transition-all active:scale-[0.99]"
              style={{ padding: '7px 10px', border: `1px solid ${isMine ? 'rgba(var(--glow-color),0.5)' : 'rgba(255,255,255,0.08)'}` }}>
              <div className="absolute inset-0 transition-all duration-500"
                style={{ width: `${pct}%`, background: isMine ? 'rgba(var(--glow-color),0.18)' : 'rgba(255,255,255,0.05)' }} />
              <div className="relative flex items-center justify-between">
                <span className={`text-xs ${isMine ? 'text-white font-medium' : 'text-white/60'}`}>{opt}</span>
                <span className="text-[10px] text-white/35 ml-2 shrink-0">{pct}%</span>
              </div>
            </button>
          )
        })}
      </div>
      <p className="text-[10px] text-white/20 mt-2">
        {poll.total_votes} {poll.total_votes === 1 ? 'voto' : 'votos'}
        {poll.user_vote !== null && <span className="ml-1">· Tu voto registrado</span>}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export function CommentSection({ dreamId, allowComments, forceOpen }: Props) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [text, setText]             = useState('')
  const [open, setOpen]             = useState(false)
  // replyingTo: { parentId = top-level comment id, mention = '@name' }
  const [replyingTo, setReplyingTo] = useState<{ parentId: string; mention: string } | null>(null)
  const [replyText, setReplyText]   = useState('')

  const isOpen = forceOpen ?? open

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', dreamId],
    queryFn: () => commentsApi.list(dreamId).then(r => r.data),
    enabled: isOpen,
  })

  const { data: poll } = useQuery({
    queryKey: ['poll', dreamId],
    queryFn: () => pollApi.get(dreamId).then(r => r.data),
    enabled: isOpen,
  })

  const postMutation = useMutation({
    mutationFn: (args: { body: string; parentId?: string }) =>
      commentsApi.post(dreamId, args.body, args.parentId),
    onSuccess: () => {
      setText(''); setReplyText(''); setReplyingTo(null)
      qc.invalidateQueries({ queryKey: ['comments', dreamId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => commentsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', dreamId] }),
  })

  if (!allowComments) return null

  // Build tree: top-level + replies grouped by parent
  const topLevel = (comments as DreamComment[]).filter(c => !c.parent_comment_id)
  const repliesMap: Record<string, DreamComment[]> = {}
  ;(comments as DreamComment[]).filter(c => c.parent_comment_id).forEach(c => {
    const pid = c.parent_comment_id!
    if (!repliesMap[pid]) repliesMap[pid] = []
    repliesMap[pid].push(c)
  })

  function handleReply(parentId: string, mentionName: string) {
    setReplyingTo(r => r?.parentId === parentId ? null : { parentId, mention: mentionName })
    setReplyText(`@${mentionName} `)
  }

  function submitReply() {
    if (!replyText.trim() || !replyingTo) return
    postMutation.mutate({ body: replyText.trim(), parentId: replyingTo.parentId })
  }

  return (
    <div className={forceOpen ? '' : 'mt-3 border-t border-white/6 pt-3'}>
      {!forceOpen && (
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {open ? 'Cerrar comentarios' : 'Comentarios'}
        </button>
      )}

      {isOpen && (
        <div className="flex flex-col gap-2 animate-fade-in" style={{ marginTop: forceOpen ? 0 : 12 }}>

          {/* Poll */}
          {poll && <PollCard dreamId={dreamId} poll={poll} />}

          {isLoading ? (
            <div className="h-8 shimmer rounded-xl" />
          ) : topLevel.length === 0 && !poll ? (
            <p className="text-xs text-white/25 italic">Sin comentarios aún. ¡Sé el primero!</p>
          ) : (
            topLevel.map((c: DreamComment) => (
              <div key={c.id} className="flex flex-col gap-1.5">
                {/* Top-level comment */}
                <CommentBubble
                  comment={c} myId={user?.id} indent={0}
                  onReply={handleReply}
                  onDelete={() => deleteMutation.mutate(c.id)}
                />

                {/* Replies */}
                {repliesMap[c.id]?.map((reply: DreamComment) => (
                  <CommentBubble
                    key={reply.id}
                    comment={reply} myId={user?.id} indent={1}
                    onReply={handleReply}
                    onDelete={() => deleteMutation.mutate(reply.id)}
                  />
                ))}

                {/* Inline reply input for this thread */}
                {replyingTo?.parentId === c.id && (
                  <div className="ml-7 flex gap-2 animate-fade-in">
                    <input
                      autoFocus
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && replyText.trim()) { e.preventDefault(); submitReply() }
                        if (e.key === 'Escape') setReplyingTo(null)
                      }}
                      placeholder={`Respondiendo…`}
                      maxLength={1000}
                      className="glass-input flex-1 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-white/20"
                    />
                    <button onClick={submitReply}
                      disabled={!replyText.trim() || postMutation.isPending}
                      className="glass-btn-primary px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition-all active:scale-95">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                    </button>
                    <button onClick={() => setReplyingTo(null)}
                      className="text-white/25 hover:text-white/50 text-xs px-1 transition-colors">✕</button>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Main comment input */}
          <div className="flex gap-2 mt-1">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && text.trim()) { e.preventDefault(); postMutation.mutate({ body: text.trim() }) } }}
              placeholder="Escribe un comentario…"
              maxLength={1000}
              className="glass-input flex-1 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/20"
            />
            <button
              onClick={() => postMutation.mutate({ body: text.trim() })}
              disabled={!text.trim() || postMutation.isPending}
              className="glass-btn-primary px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition-all active:scale-95"
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
  )
}
