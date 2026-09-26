import { Router } from 'express'
import { query } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// userId param placeholder is passed as a string like '$1', '$4', etc.
const dreamSelect = (userIdParam: string) => `
  d.id, d.title, d.body, d.dream_date, d.visibility,
  d.is_lucid, d.sleep_quality, d.tags, d.emotions, d.created_at,
  d.allow_comments,
  u.id AS author_id, u.name AS author_name, u.avatar_url AS author_avatar,
  da.summary, da.themes, da.symbols, da.emotional_tone,
  (SELECT COUNT(*) FROM dream_comments dc WHERE dc.dream_id = d.id)::int AS comment_count,
  (SELECT COUNT(*) FROM dream_likes dl WHERE dl.dream_id = d.id)::int AS like_count,
  EXISTS(SELECT 1 FROM dream_likes dl WHERE dl.dream_id = d.id AND dl.user_id = ${userIdParam}) AS user_liked
`

// ── GET /feed/friends ────────────────────────────────────────
router.get('/friends', async (req, res) => {
  const userId = req.user!.id
  const limit  = Math.min(Number(req.query.limit ?? 20), 100)
  const offset = Number(req.query.offset ?? 0)
  const sort   = req.query.sort === 'popular' ? 'like_count DESC, d.created_at DESC' : 'd.dream_date DESC, d.created_at DESC'

  // userId = $1, limit = $2, offset = $3
  const { rows } = await query(
    `SELECT ${dreamSelect('$1')}
     FROM dreams d
     JOIN profiles u ON u.id = d.user_id
     LEFT JOIN dream_analyses da ON da.dream_id = d.id
     WHERE d.visibility IN ('friends','public')
       AND d.user_id != $1
       AND EXISTS (
         SELECT 1 FROM friendships f
         WHERE f.status = 'accepted'
           AND ((f.requester_id = $1 AND f.addressee_id = d.user_id)
             OR (f.requester_id = d.user_id AND f.addressee_id = $1))
       )
     ORDER BY ${sort}
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  )
  res.json(rows)
})

// ── GET /feed/public ─────────────────────────────────────────
router.get('/public', async (req, res) => {
  const userId = req.user!.id
  const limit  = Math.min(Number(req.query.limit ?? 20), 100)
  const offset = Number(req.query.offset ?? 0)
  const search = req.query.search as string | undefined
  const sort   = req.query.sort === 'popular' ? 'like_count DESC, d.created_at DESC' : 'd.dream_date DESC, d.created_at DESC'

  // userId = $1, limit = $2, offset = $3 (search adds $4 if present)
  const params: unknown[] = [userId, limit, offset]
  let searchClause = ''

  if (search) {
    params.push(`%${search}%`)
    const idx = params.length
    searchClause = `AND (d.tags::text ILIKE $${idx} OR da.themes::text ILIKE $${idx} OR da.symbols::text ILIKE $${idx})`
  }

  const { rows } = await query(
    `SELECT ${dreamSelect('$1')}
     FROM dreams d
     JOIN profiles u ON u.id = d.user_id
     LEFT JOIN dream_analyses da ON da.dream_id = d.id
     WHERE d.visibility = 'public'
       ${searchClause}
     ORDER BY ${sort}
     LIMIT $2 OFFSET $3`,
    params
  )
  res.json(rows)
})

export default router
