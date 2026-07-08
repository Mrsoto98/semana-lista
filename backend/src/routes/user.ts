import { Router } from 'express'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { query } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()
router.use(requireAuth)

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  bio: z.string().max(500).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  avatar_emoji: z.string().max(10).nullable().optional(),
  default_visibility: z.enum(['private', 'friends', 'public']).optional(),
  birth_date: z.string().nullable().optional(),
  birth_visibility: z.enum(['date', 'age', 'none']).optional(),
  onboarding_done: z.boolean().optional(),
  instagram_username: z.string().max(30).nullable().optional(),
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
    `UPDATE profiles SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING id, name, avatar_url, avatar_emoji, bio, instagram_username,
               default_visibility, user_number, birth_date, birth_visibility, onboarding_done, created_at`,
    values
  )

  res.json(rows[0])
})

// ── GET /user/:id/profile ─────────────────────────────────────
// Public profile: returns user info + dreams filtered by relationship
router.get('/:id/profile', async (req, res) => {
  const viewerId = req.user!.id
  const targetId = req.params.id

  // Get profile
  const { rows: profiles } = await query(
    'SELECT id, name, avatar_url, bio, instagram_username, user_number, created_at FROM profiles WHERE id = $1',
    [targetId]
  )
  if (!profiles.length) { res.status(404).json({ error: 'Usuario no encontrado' }); return }

  // Check friendship
  const { rows: friendship } = await query(
    `SELECT status FROM friendships
     WHERE status = 'accepted'
       AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
    [viewerId, targetId]
  )
  const isFriend = friendship.length > 0
  const isSelf   = viewerId === targetId

  // Get visible dreams
  const visibilities = isSelf
    ? ["'private'", "'friends'", "'public'"]
    : isFriend
      ? ["'friends'", "'public'"]
      : ["'public'"]

  const { rows: dreams } = await query(
    `SELECT d.id, d.title, d.body, d.dream_date, d.visibility,
            d.is_lucid, d.tags, d.emotions, d.sleep_quality, d.created_at,
            da.summary, da.emotional_tone
     FROM dreams d
     LEFT JOIN dream_analyses da ON da.dream_id = d.id
     WHERE d.user_id = $1
       AND d.visibility IN (${visibilities.join(',')})
     ORDER BY d.dream_date DESC
     LIMIT 50`,
    [targetId]
  )

  // Friend count
  const { rows: fc } = await query(
    `SELECT COUNT(*) FROM friendships WHERE status='accepted' AND (requester_id=$1 OR addressee_id=$1)`,
    [targetId]
  )

  res.json({
    profile: { ...profiles[0], friend_count: Number(fc[0].count), dream_count: dreams.length },
    dreams,
    relationship: isSelf ? 'self' : isFriend ? 'friend' : 'stranger',
  })
})

// ── GET /user/export ──────────────────────────────────────────
router.get('/export', async (req, res) => {
  const userId = req.user!.id

  const [profile, dreams, analyses, friendships] = await Promise.all([
    query('SELECT id, name, bio, created_at FROM profiles WHERE id = $1', [userId]),
    query('SELECT * FROM dreams WHERE user_id = $1 ORDER BY dream_date', [userId]),
    query(
      `SELECT da.* FROM dream_analyses da JOIN dreams d ON d.id = da.dream_id WHERE d.user_id = $1`,
      [userId]
    ),
    query(
      `SELECT f.*, p.name AS other_name FROM friendships f
       JOIN profiles p ON p.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       WHERE f.requester_id = $1 OR f.addressee_id = $1`,
      [userId]
    ),
  ])

  res.setHeader('Content-Disposition', 'attachment; filename=bitacora-export.json')
  res.json({
    exportedAt: new Date().toISOString(),
    profile: profile.rows[0],
    dreams: dreams.rows,
    analyses: analyses.rows,
    friendships: friendships.rows,
  })
})

// ── DELETE /user ──────────────────────────────────────────────
router.delete('/', async (req, res) => {
  const userId = req.user!.id

  // Delete from Supabase Auth (cascades to profiles via FK)
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) {
    res.status(500).json({ error: 'Error al eliminar la cuenta' })
    return
  }

  res.json({ message: 'Cuenta eliminada correctamente.' })
})

export default router
