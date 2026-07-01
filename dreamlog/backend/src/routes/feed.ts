import { Router } from 'express'
import { query } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const DREAM_SELECT = `
  d.id, d.title, d.body, d.dream_date, d.visibility,
  d.is_lucid, d.sleep_quality, d.tags, d.emotions, d.created_at,
  u.id AS author_id, u.name AS author_name, u.avatar_url AS author_avatar,
  da.summary, da.themes, da.symbols, da.emotional_tone
`

// ── GET /feed/friends ────────────────────────────────────────
// Dreams from mutual friends with visibility 'friends' or 'public'
router.get('/friends', async (req, res) => {
  const userId = req.user!.id
  const limit = Math.min(Number(req.query.limit ?? 20), 100)
  const offset = Number(req.query.offset ?? 0)

  const { rows } = await query(
    `SELECT ${DREAM_SELECT}
     FROM dreams d
     JOIN users u ON u.id = d.user_id
     LEFT JOIN dream_analyses da ON da.dream_id = d.id
     WHERE d.visibility IN ('friends','public')
       AND u.deleted_at IS NULL
       AND d.user_id != $1
       AND EXISTS (
         SELECT 1 FROM friendships f
         WHERE f.status = 'accepted'
           AND ((f.requester_id = $1 AND f.addressee_id = d.user_id)
             OR (f.requester_id = d.user_id AND f.addressee_id = $1))
       )
     ORDER BY d.dream_date DESC, d.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  )

  res.json(rows)
})

// ── GET /feed/public ─────────────────────────────────────────
// All public dreams from non-deleted users
router.get('/public', async (req, res) => {
  const userId = req.user!.id
  const limit = Math.min(Number(req.query.limit ?? 20), 100)
  const offset = Number(req.query.offset ?? 0)
  const search = req.query.search as string | undefined

  let searchClause = ''
  const params: unknown[] = [userId, limit, offset]

  if (search) {
    params.push(`%${search}%`)
    const idx = params.length
    searchClause = `AND (d.tags::text ILIKE $${idx} OR da.themes::text ILIKE $${idx} OR da.symbols::text ILIKE $${idx})`
  }

  const { rows } = await query(
    `SELECT ${DREAM_SELECT}
     FROM dreams d
     JOIN users u ON u.id = d.user_id
     LEFT JOIN dream_analyses da ON da.dream_id = d.id
     WHERE d.visibility = 'public'
       AND u.deleted_at IS NULL
       AND d.user_id != $1
       ${searchClause}
     ORDER BY d.dream_date DESC, d.created_at DESC
     LIMIT $2 OFFSET $3`,
    params
  )

  res.json(rows)
})

export default router
