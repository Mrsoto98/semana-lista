import { Router } from 'express'
import { query } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { analyzeConnection } from '../services/analysis.js'

const router = Router()
router.use(requireAuth)

// ── GET /coincidences ─────────────────────────────────────────
// Returns coincidences for the requesting user
// Public coincidences are anonymized until both parties accept
router.get('/', async (req, res) => {
  const userId = req.user!.id
  const scope = req.query.scope as string | undefined

  // Whitelist scope to prevent injection; only 'friends' and 'public' are valid
  const validScope = scope === 'friends' || scope === 'public' ? scope : undefined

  const params: unknown[] = [userId]
  let scopeFilter = ''
  if (validScope) {
    params.push(validScope)
    scopeFilter = `AND c.scope = $${params.length}`
  }

  try {
    const { rows } = await query(
      `SELECT
         c.id, c.score, c.scope, c.status, c.accepted_a, c.accepted_b, c.created_at,
         -- My dream
         my_d.id          AS my_dream_id,
         my_d.title       AS my_dream_title,
         my_d.body        AS my_dream_body,
         my_d.dream_date  AS my_dream_date,
         my_d.tags        AS my_dream_tags,
         -- Their dream (anonymized unless accepted or friends scope)
         their_d.id       AS their_dream_id,
         their_d.dream_date AS their_dream_date,
         their_d.tags     AS their_dream_tags,
         CASE
           WHEN c.scope = 'friends' OR (c.accepted_a AND c.accepted_b)
           THEN their_d.title
           ELSE NULL
         END AS their_dream_title,
         CASE
           WHEN c.scope = 'friends' OR (c.accepted_a AND c.accepted_b)
           THEN their_d.body
           ELSE NULL
         END AS their_dream_body,
         -- Author info (anonymized unless friends or both accepted)
         CASE
           WHEN c.scope = 'friends' OR (c.accepted_a AND c.accepted_b)
           THEN their_u.id
           ELSE NULL
         END AS their_user_id,
         CASE
           WHEN c.scope = 'friends' OR (c.accepted_a AND c.accepted_b)
           THEN their_u.name
           ELSE 'Soñador anónimo'
         END AS their_user_name,
         CASE
           WHEN c.scope = 'friends' OR (c.accepted_a AND c.accepted_b)
           THEN their_u.avatar_url
           ELSE NULL
         END AS their_avatar,
         -- Am I dream_a or dream_b?
         CASE WHEN my_d.id = c.dream_a_id THEN c.accepted_a ELSE c.accepted_b END AS i_accepted
       FROM coincidences c
       JOIN dreams my_d ON (
         (c.dream_a_id = my_d.id OR c.dream_b_id = my_d.id)
         AND my_d.user_id = $1
       )
       JOIN dreams their_d ON (
         their_d.id = CASE WHEN c.dream_a_id = my_d.id THEN c.dream_b_id ELSE c.dream_a_id END
       )
       JOIN profiles their_u ON their_u.id = their_d.user_id
       WHERE c.status != 'dismissed'
         ${scopeFilter}
       ORDER BY c.score DESC, c.created_at DESC
       LIMIT 50`,
      params
    )
    res.json(rows)
  } catch (err) {
    console.error('[GET /coincidences]', err)
    res.status(500).json({ error: 'Error al obtener coincidencias' })
  }
})

// ── POST /coincidences/:id/accept ─────────────────────────────
router.post('/:id/accept', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const { rows } = await query<{
      dream_a_id: string; dream_b_id: string;
      dream_a_user: string; dream_b_user: string
    }>(
      `SELECT c.dream_a_id, c.dream_b_id, da.user_id AS dream_a_user, db.user_id AS dream_b_user
       FROM coincidences c
       JOIN dreams da ON da.id = c.dream_a_id
       JOIN dreams db ON db.id = c.dream_b_id
       WHERE c.id = $1`,
      [id]
    )

    if (!rows.length) {
      res.status(404).json({ error: 'Coincidencia no encontrada' })
      return
    }

    const c = rows[0]
    let updateCol: string

    if (c.dream_a_user === userId) updateCol = 'accepted_a'
    else if (c.dream_b_user === userId) updateCol = 'accepted_b'
    else {
      res.status(403).json({ error: 'No eres parte de esta coincidencia' })
      return
    }

    const { rows: updated } = await query(
      `UPDATE coincidences
       SET ${updateCol} = TRUE,
           status = CASE WHEN accepted_a AND accepted_b THEN 'accepted' ELSE status END
       WHERE id = $1
       RETURNING status, accepted_a, accepted_b`,
      [id]
    )

    res.json(updated[0])
  } catch (err) {
    console.error('[POST /coincidences/:id/accept]', err)
    res.status(500).json({ error: 'Error al aceptar coincidencia' })
  }
})

// ── POST /coincidences/:id/dismiss ────────────────────────────
router.post('/:id/dismiss', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const { rowCount } = await query(
      `UPDATE coincidences c
       SET status = 'dismissed'
       FROM dreams da, dreams db
       WHERE c.id = $1
         AND da.id = c.dream_a_id AND db.id = c.dream_b_id
         AND (da.user_id = $2 OR db.user_id = $2)`,
      [id, userId]
    )

    if (!rowCount) {
      res.status(404).json({ error: 'Coincidencia no encontrada' })
      return
    }

    res.status(204).send()
  } catch (err) {
    console.error('[POST /coincidences/:id/dismiss]', err)
    res.status(500).json({ error: 'Error al descartar coincidencia' })
  }
})

// ── POST /coincidences/:id/insight ───────────────────────────
router.post('/:id/insight', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params

  try {
    const { rows } = await query<{
      my_title: string | null; my_body: string;
      their_title: string | null; their_body: string;
    }>(
      `SELECT
         my_d.title AS my_title, my_d.body AS my_body,
         their_d.title AS their_title, their_d.body AS their_body
       FROM coincidences c
       JOIN dreams my_d ON (c.dream_a_id = my_d.id OR c.dream_b_id = my_d.id)
         AND my_d.user_id = $2
       JOIN dreams their_d ON their_d.id = CASE
         WHEN c.dream_a_id = my_d.id THEN c.dream_b_id ELSE c.dream_a_id END
       WHERE c.id = $1`,
      [id, userId]
    )

    if (!rows.length) {
      res.status(404).json({ error: 'Coincidencia no encontrada' })
      return
    }

    const { my_title, my_body, their_title, their_body } = rows[0]
    const insight = await analyzeConnection(my_title, my_body, their_title, their_body)
    res.json({ insight })
  } catch (err: any) {
    if (err?.status === 429 || err?.statusCode === 429) {
      res.status(429).json({ error: 'Límite alcanzado. Inténtalo en un momento.' })
      return
    }
    console.error('[POST /coincidences/:id/insight]', err)
    res.status(500).json({ error: 'No se pudo generar el análisis.' })
  }
})

export default router
