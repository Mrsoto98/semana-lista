import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()
router.use(requireAuth)

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  default_visibility: z.enum(['private', 'friends', 'public']).optional(),
})

// ── PATCH /user/profile ───────────────────────────────────────
router.patch('/profile', validate(UpdateProfileSchema), async (req, res) => {
  const userId = req.user!.id
  const fields = req.body

  const sets: string[] = []
  const values: unknown[] = []
  let idx = 1

  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) {
      sets.push(`${key} = $${idx++}`)
      values.push(val)
    }
  }

  if (!sets.length) {
    res.status(400).json({ error: 'Nada que actualizar' })
    return
  }

  values.push(userId)
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING
     id, email, name, avatar_url, bio, default_visibility, created_at`,
    values
  )

  res.json(rows[0])
})

// ── GET /user/export ──────────────────────────────────────────
// GDPR: export all personal data as JSON
router.get('/export', async (req, res) => {
  const userId = req.user!.id

  const [user, dreams, analyses, friendships] = await Promise.all([
    query('SELECT id, email, name, bio, created_at FROM users WHERE id = $1', [userId]),
    query('SELECT * FROM dreams WHERE user_id = $1 ORDER BY dream_date', [userId]),
    query(
      `SELECT da.* FROM dream_analyses da
       JOIN dreams d ON d.id = da.dream_id WHERE d.user_id = $1`,
      [userId]
    ),
    query(
      `SELECT f.*, u.name AS other_name FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       WHERE f.requester_id = $1 OR f.addressee_id = $1`,
      [userId]
    ),
  ])

  res.setHeader('Content-Disposition', 'attachment; filename=dreamlog-export.json')
  res.json({
    exportedAt: new Date().toISOString(),
    user: user.rows[0],
    dreams: dreams.rows,
    analyses: analyses.rows,
    friendships: friendships.rows,
  })
})

// ── DELETE /user ──────────────────────────────────────────────
// Soft delete — real purge runs via scheduled job after 30 days
router.delete('/', async (req, res) => {
  const userId = req.user!.id

  await query(
    `UPDATE users SET deleted_at = now(), refresh_token_hash = NULL WHERE id = $1`,
    [userId]
  )

  res.json({ message: 'Cuenta marcada para eliminación. Se borrará en 30 días.' })
})

export default router
