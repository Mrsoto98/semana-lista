import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { enqueueDreamEmbedding } from '../jobs/embedding.queue.js'

const router = Router()
router.use(requireAuth)

const DreamSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(10000),
  dream_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  visibility: z.enum(['private', 'friends', 'public']).default('private'),
  is_lucid: z.boolean().default(false),
  sleep_quality: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  emotions: z.array(z.string().max(50)).max(10).default([]),
  allow_comments: z.boolean().default(true),
  tagged_user_ids: z.array(z.string().uuid()).max(10).optional(),
})

// ── POST /dreams ─────────────────────────────────────────────
router.post('/', validate(DreamSchema), async (req, res) => {
  const userId = req.user!.id
  const { title, body, dream_date, visibility, is_lucid, sleep_quality, tags, emotions, allow_comments, tagged_user_ids } = req.body

  const { rows } = await query<{ id: string }>(
    `INSERT INTO dreams (user_id, title, body, dream_date, visibility, is_lucid, sleep_quality, tags, emotions, allow_comments)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [userId, title ?? null, body, dream_date, visibility, is_lucid, sleep_quality ?? null, tags, emotions, allow_comments ?? true]
  )

  const dreamId = rows[0].id

  if (tagged_user_ids?.length) {
    const placeholders = tagged_user_ids.map((_: string, i: number) => `($1, $${i + 2})`).join(', ')
    await query(
      `INSERT INTO dream_mentions (dream_id, mentioned_user_id) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      [dreamId, ...tagged_user_ids]
    ).catch(err => console.error('[dream_mentions insert]', err))
  }

  // Only enqueue embedding if dream will be discoverable (not private)
  if (visibility !== 'private') {
    await enqueueDreamEmbedding(dreamId).catch(console.error)
  }

  res.status(201).json({ id: dreamId })
})

// ── GET /dreams (own diary, paginated) ───────────────────────
router.get('/', async (req, res) => {
  const userId = req.user!.id
  const limit = Math.min(Number(req.query.limit ?? 20), 100)
  const offset = Number(req.query.offset ?? 0)

  const { rows } = await query(
    `SELECT d.*, da.summary, da.themes, da.symbols, da.emotional_tone,
            (SELECT COUNT(*) FROM dream_likes dl WHERE dl.dream_id = d.id)::int AS like_count,
            (SELECT COUNT(*) FROM dream_comments dc WHERE dc.dream_id = d.id)::int AS comment_count
     FROM dreams d
     LEFT JOIN dream_analyses da ON da.dream_id = d.id
     WHERE d.user_id = $1
     ORDER BY d.dream_date DESC, d.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  )
  res.json(rows)
})

// ── GET /dreams/:id ──────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params

  const { rows } = await query(
    `SELECT d.*, da.summary, da.themes, da.symbols, da.emotional_tone, da.interpretations
     FROM dreams d
     LEFT JOIN dream_analyses da ON da.dream_id = d.id
     WHERE d.id = $1`,
    [id]
  )

  if (!rows.length) {
    res.status(404).json({ error: 'Sueño no encontrado' })
    return
  }

  const dream = rows[0]

  // Access control
  if (dream.user_id === userId) {
    res.json(dream)
    return
  }

  if (dream.visibility === 'private') {
    res.status(403).json({ error: 'No tienes acceso a este sueño' })
    return
  }

  if (dream.visibility === 'friends') {
    const { rowCount } = await query(
      `SELECT 1 FROM friendships
       WHERE status = 'accepted'
       AND ((requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1))`,
      [userId, dream.user_id]
    )
    if (!rowCount) {
      res.status(403).json({ error: 'Solo amigos pueden ver este sueño' })
      return
    }
  }

  res.json(dream)
})

// ── PATCH /dreams/:id ────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params

  const { rows } = await query<{ user_id: string; visibility: string }>(
    'SELECT user_id, visibility FROM dreams WHERE id = $1',
    [id]
  )
  if (!rows.length) {
    res.status(404).json({ error: 'Sueño no encontrado' })
    return
  }
  if (rows[0].user_id !== userId) {
    res.status(403).json({ error: 'No autorizado' })
    return
  }

  const patch = DreamSchema.partial().safeParse(req.body)
  if (!patch.success) {
    res.status(400).json({ error: 'Datos inválidos', details: patch.error.flatten() })
    return
  }

  const fields = patch.data
  const sets: string[] = []
  const values: unknown[] = []
  let idx = 1

  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) {
      sets.push(`${key} = $${idx++}`)
      values.push(val)
    }
  }
  sets.push(`updated_at = now()`)
  values.push(id)

  const { rows: updated } = await query(
    `UPDATE dreams SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  )

  // Re-enqueue embedding if visibility changed to non-private or body changed
  const wasPrivate = rows[0].visibility === 'private'
  const nowVisible = (fields.visibility ?? rows[0].visibility) !== 'private'
  if ((wasPrivate && nowVisible) || fields.body) {
    await enqueueDreamEmbedding(id).catch(console.error)
  }

  res.json(updated[0])
})

// ── DELETE /dreams/:id ───────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params

  const { rowCount } = await query(
    'DELETE FROM dreams WHERE id = $1 AND user_id = $2',
    [id, userId]
  )

  if (!rowCount) {
    res.status(404).json({ error: 'Sueño no encontrado o no autorizado' })
    return
  }

  res.status(204).send()
})

// ── GET /dreams/:id/comments ──────────────────────────────────
router.get('/:id/comments', async (req, res) => {
  const { id } = req.params
  const { rows } = await query(
    `SELECT c.id, c.body, c.created_at, c.parent_comment_id,
            p.id AS user_id, p.name AS user_name, p.avatar_url AS user_avatar
     FROM dream_comments c
     JOIN profiles p ON p.id = c.user_id
     WHERE c.dream_id = $1
     ORDER BY c.created_at ASC`,
    [id]
  )
  res.json(rows)
})

// ── POST /dreams/:id/comments ─────────────────────────────────
router.post('/:id/comments', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params
  const { body, parent_comment_id } = req.body

  if (!body || body.trim().length === 0 || body.length > 1000) {
    res.status(400).json({ error: 'Comentario inválido' })
    return
  }

  const { rows: dream } = await query(
    `SELECT d.allow_comments FROM dreams d WHERE d.id = $1`,
    [id]
  )
  if (!dream.length) { res.status(404).json({ error: 'Sueño no encontrado' }); return }
  if (!dream[0].allow_comments) { res.status(403).json({ error: 'Este sueño no admite comentarios' }); return }

  const { rows } = await query(
    `INSERT INTO dream_comments (dream_id, user_id, body, parent_comment_id)
     VALUES ($1,$2,$3,$4) RETURNING id, body, created_at, parent_comment_id`,
    [id, userId, body.trim(), parent_comment_id ?? null]
  )

  const { rows: profile } = await query(
    'SELECT id AS user_id, name AS user_name, avatar_url AS user_avatar FROM profiles WHERE id = $1',
    [userId]
  )

  res.status(201).json({ ...rows[0], ...profile[0] })
})

// ── DELETE /comments/:commentId ───────────────────────────────
router.delete('/comments/:commentId', async (req, res) => {
  const userId = req.user!.id
  const { commentId } = req.params

  const { rowCount } = await query(
    'DELETE FROM dream_comments WHERE id = $1 AND user_id = $2',
    [commentId, userId]
  )
  if (!rowCount) { res.status(404).json({ error: 'Comentario no encontrado o no autorizado' }); return }
  res.status(204).send()
})

// ── GET /dreams/:id/poll ──────────────────────────────────────
router.get('/:id/poll', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params

  const { rows: polls } = await query(
    `SELECT dp.id, dp.question, dp.options, dp.created_at,
            (SELECT option_index FROM dream_poll_votes WHERE poll_id = dp.id AND user_id = $2) AS user_vote
     FROM dream_polls dp WHERE dp.dream_id = $1`,
    [id, userId]
  )
  if (!polls.length) { res.json(null); return }

  const poll = polls[0]
  const { rows: votes } = await query(
    `SELECT option_index, COUNT(*)::int AS count
     FROM dream_poll_votes WHERE poll_id = $1 GROUP BY option_index`,
    [poll.id]
  )

  const options: string[] = poll.options
  const vote_counts = options.map((_, i) => {
    const v = votes.find((v: { option_index: number }) => v.option_index === i)
    return v ? v.count : 0
  })
  const total_votes = vote_counts.reduce((a: number, b: number) => a + b, 0)

  res.json({ ...poll, vote_counts, total_votes, user_vote: poll.user_vote ?? null })
})

// ── POST /dreams/:id/poll ─────────────────────────────────────
router.post('/:id/poll', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params
  const { question, options } = req.body

  if (!question?.trim() || !Array.isArray(options) || options.length < 2 || options.length > 4) {
    res.status(400).json({ error: 'Encuesta inválida: necesita pregunta y 2-4 opciones' }); return
  }

  const { rows: dream } = await query('SELECT user_id FROM dreams WHERE id = $1', [id])
  if (!dream.length || dream[0].user_id !== userId) {
    res.status(403).json({ error: 'No autorizado' }); return
  }

  const { rows } = await query(
    `INSERT INTO dream_polls (dream_id, question, options)
     VALUES ($1,$2,$3)
     ON CONFLICT (dream_id) DO UPDATE SET question = EXCLUDED.question, options = EXCLUDED.options
     RETURNING id, question, options, created_at`,
    [id, question.trim(), JSON.stringify(options.map((o: string) => o.trim()).filter(Boolean))]
  )
  res.status(201).json({ ...rows[0], vote_counts: options.map(() => 0), total_votes: 0, user_vote: null })
})

// ── POST /dreams/:id/poll/vote ────────────────────────────────
router.post('/:id/poll/vote', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params
  const { option_index } = req.body

  if (typeof option_index !== 'number') { res.status(400).json({ error: 'option_index requerido' }); return }

  const { rows: polls } = await query('SELECT id, options FROM dream_polls WHERE dream_id = $1', [id])
  if (!polls.length) { res.status(404).json({ error: 'Encuesta no encontrada' }); return }

  const poll = polls[0]
  if (option_index < 0 || option_index >= (poll.options as string[]).length) {
    res.status(400).json({ error: 'Opción inválida' }); return
  }

  await query(
    `INSERT INTO dream_poll_votes (poll_id, user_id, option_index)
     VALUES ($1,$2,$3) ON CONFLICT (poll_id, user_id) DO UPDATE SET option_index = EXCLUDED.option_index`,
    [poll.id, userId, option_index]
  )
  res.status(201).json({ ok: true })
})

// ── DELETE /dreams/:id/poll/vote ──────────────────────────────
router.delete('/:id/poll/vote', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params

  const { rows: polls } = await query('SELECT id FROM dream_polls WHERE dream_id = $1', [id])
  if (!polls.length) { res.status(404).json({ error: 'Encuesta no encontrada' }); return }

  await query('DELETE FROM dream_poll_votes WHERE poll_id = $1 AND user_id = $2', [polls[0].id, userId])
  res.status(204).send()
})

// ── POST /dreams/:id/like ─────────────────────────────────────
router.post('/:id/like', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params
  await query(
    `INSERT INTO dream_likes (dream_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [id, userId]
  )
  const { rows } = await query(
    `SELECT COUNT(*)::int AS like_count FROM dream_likes WHERE dream_id = $1`, [id]
  )
  res.json({ like_count: rows[0].like_count, user_liked: true })
})

// ── DELETE /dreams/:id/like ───────────────────────────────────
router.delete('/:id/like', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params
  await query('DELETE FROM dream_likes WHERE dream_id = $1 AND user_id = $2', [id, userId])
  const { rows } = await query(
    `SELECT COUNT(*)::int AS like_count FROM dream_likes WHERE dream_id = $1`, [id]
  )
  res.json({ like_count: rows[0].like_count, user_liked: false })
})

export default router
