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
})

// ── POST /dreams ─────────────────────────────────────────────
router.post('/', validate(DreamSchema), async (req, res) => {
  const userId = req.user!.id
  const { title, body, dream_date, visibility, is_lucid, sleep_quality, tags, emotions } = req.body

  const { rows } = await query<{ id: string }>(
    `INSERT INTO dreams (user_id, title, body, dream_date, visibility, is_lucid, sleep_quality, tags, emotions)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [userId, title ?? null, body, dream_date, visibility, is_lucid, sleep_quality ?? null, tags, emotions]
  )

  const dreamId = rows[0].id

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
    `SELECT d.*, da.summary, da.themes, da.symbols, da.emotional_tone
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

export default router
