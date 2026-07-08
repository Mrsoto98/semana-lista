import { Router } from 'express'
import { query } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// ── GET /friends ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const userId = req.user!.id
  const { rows } = await query(
    `SELECT u.id, u.name, u.avatar_url, u.bio,
            f.status,
            CASE WHEN f.requester_id = $1 THEN 'sent' ELSE 'received' END AS direction
     FROM friendships f
     JOIN profiles u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE (f.requester_id = $1 OR f.addressee_id = $1)
       AND f.status != 'blocked'
            ORDER BY f.updated_at DESC`,
    [userId]
  )
  res.json(rows)
})

// ── POST /friends/request ─────────────────────────────────────
router.post('/request', async (req, res) => {
  const userId = req.user!.id
  const { targetId } = req.body

  if (!targetId || targetId === userId) {
    res.status(400).json({ error: 'targetId inválido' })
    return
  }

  // Check target exists
  const target = await query('SELECT id FROM profiles WHERE id = $1', [targetId])
  if (!target.rowCount) {
    res.status(404).json({ error: 'Usuario no encontrado' })
    return
  }

  // Check no existing relationship in either direction
  const existing = await query(
    `SELECT status FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)`,
    [userId, targetId]
  )

  if (existing.rowCount) {
    const status = existing.rows[0].status
    if (status === 'blocked') {
      res.status(403).json({ error: 'No puedes enviar solicitud a este usuario' })
      return
    }
    res.status(409).json({ error: 'Ya existe una relación con este usuario', status })
    return
  }

  await query(
    'INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2)',
    [userId, targetId]
  )

  res.status(201).json({ message: 'Solicitud enviada' })
})

// ── POST /friends/accept ──────────────────────────────────────
router.post('/accept', async (req, res) => {
  const userId = req.user!.id
  const { requesterId } = req.body

  const { rowCount } = await query(
    `UPDATE friendships SET status = 'accepted', updated_at = now()
     WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
    [requesterId, userId]
  )

  if (!rowCount) {
    res.status(404).json({ error: 'Solicitud no encontrada' })
    return
  }

  res.json({ message: 'Solicitud aceptada' })
})

// ── POST /friends/decline ─────────────────────────────────────
router.post('/decline', async (req, res) => {
  const userId = req.user!.id
  const { requesterId } = req.body

  await query(
    `DELETE FROM friendships
     WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
    [requesterId, userId]
  )

  res.json({ message: 'Solicitud rechazada' })
})

// ── DELETE /friends/:id ───────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const userId = req.user!.id
  const { id: otherId } = req.params

  await query(
    `DELETE FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)`,
    [userId, otherId]
  )

  res.status(204).send()
})

// ── POST /friends/block ───────────────────────────────────────
router.post('/block', async (req, res) => {
  const userId = req.user!.id
  const { targetId } = req.body

  // Remove any existing friendship first
  await query(
    `DELETE FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)`,
    [userId, targetId]
  )

  await query(
    `INSERT INTO friendships (requester_id, addressee_id, status)
     VALUES ($1, $2, 'blocked')
     ON CONFLICT (requester_id, addressee_id) DO UPDATE SET status = 'blocked', updated_at = now()`,
    [userId, targetId]
  )

  res.json({ message: 'Usuario bloqueado' })
})

// ── GET /friends/search?q= ───────────────────────────────────
router.get('/search', async (req, res) => {
  const userId = req.user!.id
  const q = req.query.q as string

  if (!q || q.length < 2) {
    res.status(400).json({ error: 'Búsqueda demasiado corta' })
    return
  }

  // Parse formatted user number (e.g. "0001" → 1, "A0001" → 10000)
  function parseFormattedNumber(s: string): number | null {
    const upper = s.trim().toUpperCase()
    const pureDigits = /^(\d{1,4})$/.exec(upper)
    if (pureDigits) return parseInt(pureDigits[1], 10)
    const withLetter = /^([A-Z])(\d{1,4})$/.exec(upper)
    if (withLetter) {
      const letterIndex = withLetter[1].charCodeAt(0) - 64
      const remainder   = parseInt(withLetter[2], 10)
      return 9999 + (letterIndex - 1) * 9999 + remainder
    }
    return null
  }

  const parsedNum = parseFormattedNumber(q)
  const isFormattedNumber = parsedNum !== null

  const { rows } = await query(
    isFormattedNumber
      ? `SELECT id, name, avatar_url, bio, user_number
         FROM profiles
         WHERE user_number = $1 AND id != $2
         LIMIT 10`
      : `SELECT id, name, avatar_url, bio, user_number
         FROM profiles
         WHERE (name ILIKE $1 OR email ILIKE $1)
           AND id != $2
         LIMIT 20`,
    isFormattedNumber ? [parsedNum, userId] : [`%${q}%`, userId]
  )

  res.json(rows)
})

export default router
