import { Router } from 'express'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import multer from 'multer'
import { query } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Solo se permiten imágenes') as unknown as null, false)
  },
})

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
  birth_visibility: z.enum(['date', 'age', 'date_age', 'none']).optional(),
  onboarding_done: z.boolean().optional(),
  instagram_username: z.string().max(30).nullable().optional(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/).nullable().optional(),
})

// ── GET /user/username-available ─────────────────────────────
// Public endpoint — no auth required
router.get('/username-available', async (req, res) => {
  const { username } = req.query as { username?: string }
  if (!username || !/^[a-z0-9_]{3,30}$/.test(username)) {
    res.json({ available: false })
    return
  }
  const { rows } = await query('SELECT 1 FROM profiles WHERE username = $1', [username])
  res.json({ available: rows.length === 0 })
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
     RETURNING id, name, avatar_url, avatar_emoji, bio, instagram_username, username,
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
    'SELECT id, name, avatar_url, bio, instagram_username, username, user_number, created_at FROM profiles WHERE id = $1',
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

  res.setHeader('Content-Disposition', 'attachment; filename=mydreams-export.json')
  res.json({
    exportedAt: new Date().toISOString(),
    profile: profile.rows[0],
    dreams: dreams.rows,
    analyses: analyses.rows,
    friendships: friendships.rows,
  })
})

// ── POST /user/avatar ─────────────────────────────────────────
router.post('/avatar', upload.single('file'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No se envió ningún archivo' }); return }
  const userId = req.user!.id
  const ext    = req.file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
  const path   = `${userId}/avatar.${ext}`

  // Delete any existing avatar for this user (handles extension changes)
  const { data: existing } = await supabase.storage.from('avatars').list(userId)
  if (existing?.length) {
    await supabase.storage.from('avatars').remove(existing.map(f => `${userId}/${f.name}`))
  }

  const { error } = await supabase.storage.from('avatars').upload(path, req.file.buffer, {
    contentType:  req.file.mimetype,
    cacheControl: '31536000',
    upsert:       true,
  })
  if (error) { res.status(500).json({ error: 'Error al subir la imagen' }); return }

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
  res.json({ url: `${publicUrl}?t=${Date.now()}` })
})

// ── DELETE /user ──────────────────────────────────────────────
router.delete('/', async (req, res) => {
  const userId = req.user!.id
  const errors: string[] = []

  const run = async (label: string, sql: string, params: unknown[]) => {
    try {
      const r = await query(sql, params)
      console.log(`[deleteAccount] ${label}: ${r.rowCount} rows deleted`)
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('does not exist')) {
        console.log(`[deleteAccount] ${label}: table does not exist, skipping`)
        return
      }
      console.error(`[deleteAccount] FAILED ${label}:`, msg)
      errors.push(`${label}: ${msg}`)
    }
  }

  // FK-safe deletion order
  await run('dream_poll_votes',
    `DELETE FROM dream_poll_votes
     WHERE user_id = $1
        OR poll_id IN (SELECT dp.id FROM dream_polls dp JOIN dreams d ON d.id = dp.dream_id WHERE d.user_id = $1)`,
    [userId])
  await run('dream_polls',
    `DELETE FROM dream_polls WHERE dream_id IN (SELECT id FROM dreams WHERE user_id = $1)`,
    [userId])
  await run('dream_likes',
    `DELETE FROM dream_likes WHERE user_id = $1 OR dream_id IN (SELECT id FROM dreams WHERE user_id = $1)`,
    [userId])
  await run('dream_comments',
    `DELETE FROM dream_comments WHERE user_id = $1 OR dream_id IN (SELECT id FROM dreams WHERE user_id = $1)`,
    [userId])
  await run('dream_mentions',
    `DELETE FROM dream_mentions WHERE mentioned_user_id = $1 OR dream_id IN (SELECT id FROM dreams WHERE user_id = $1)`,
    [userId])
  await run('dream_analyses',
    `DELETE FROM dream_analyses WHERE dream_id IN (SELECT id FROM dreams WHERE user_id = $1)`,
    [userId])
  await run('coincidences',
    `DELETE FROM coincidences
     WHERE dream_a_id IN (SELECT id FROM dreams WHERE user_id = $1)
        OR dream_b_id IN (SELECT id FROM dreams WHERE user_id = $1)`,
    [userId])
  await run('reports',         `DELETE FROM reports WHERE reporter_id = $1`, [userId])
  await run('dreams',          `DELETE FROM dreams WHERE user_id = $1`, [userId])
  await run('push_subscriptions', `DELETE FROM push_subscriptions WHERE user_id = $1`, [userId])
  await run('friendships',
    `DELETE FROM friendships WHERE requester_id = $1 OR addressee_id = $1`,
    [userId])
  await run('messages',
    `DELETE FROM messages
     WHERE sender_id = $1
        OR conversation_id IN (SELECT id FROM conversations WHERE participant_1 = $1 OR participant_2 = $1)`,
    [userId])
  await run('conversations',
    `DELETE FROM conversations WHERE participant_1 = $1 OR participant_2 = $1`,
    [userId])
  await run('notifications',
    `DELETE FROM notifications WHERE user_id = $1 OR actor_id = $1`,
    [userId])
  await run('profiles', `DELETE FROM profiles WHERE id = $1`, [userId])

  // Remove from Supabase Auth (always non-fatal — DB data already cleaned)
  try {
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)
    if (authError) {
      console.log('[deleteAccount] Auth removal skipped:', (authError as Error).message ?? String(authError))
    } else {
      console.log('[deleteAccount] Auth user deleted')
    }
  } catch (e) {
    console.log('[deleteAccount] Auth removal skipped (exception):', (e as Error).message ?? String(e))
  }

  if (errors.length > 0) {
    console.error('[deleteAccount] Completed with errors:', errors)
    res.status(500).json({ error: 'Algunos datos no pudieron eliminarse', details: errors })
    return
  }

  res.json({ ok: true })
})

export default router
