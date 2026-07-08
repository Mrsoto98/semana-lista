import { Router } from 'express'
import { query } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { analyzeDream, MODEL } from '../services/analysis.js'

const router = Router()
router.use(requireAuth)

// ── POST /dreams/:id/analyze ──────────────────────────────────
// Generates (or returns cached) AI analysis for a dream
router.post('/:id/analyze', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params

  const { rows } = await query<{
    id: string; user_id: string; title: string | null; body: string
  }>(
    'SELECT id, user_id, title, body FROM dreams WHERE id = $1',
    [id]
  )

  if (!rows.length) {
    res.status(404).json({ error: 'Sueño no encontrado' })
    return
  }

  if (rows[0].user_id !== userId) {
    res.status(403).json({ error: 'Solo el autor puede analizar su sueño' })
    return
  }

  // Return cached analysis if it exists
  const cached = await query(
    'SELECT * FROM dream_analyses WHERE dream_id = $1',
    [id]
  )
  if (cached.rowCount) {
    res.json({ ...cached.rows[0], cached: true })
    return
  }

  const dream = rows[0]
  const result = await analyzeDream(dream.title, dream.body)

  const { rows: saved } = await query(
    `INSERT INTO dream_analyses
       (dream_id, summary, themes, symbols, emotional_tone, interpretations, model_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      id,
      result.summary,
      result.themes,
      result.symbols,
      result.emotional_tone,
      JSON.stringify(result.interpretations),
      MODEL,
    ]
  )

  res.json(saved[0])
})

// ── DELETE /dreams/:id/analyze ────────────────────────────────
// Force re-analysis by clearing cached result
router.delete('/:id/analyze', async (req, res) => {
  const userId = req.user!.id
  const { id } = req.params

  const { rows } = await query<{ user_id: string }>(
    'SELECT user_id FROM dreams WHERE id = $1',
    [id]
  )
  if (!rows.length || rows[0].user_id !== userId) {
    res.status(403).json({ error: 'No autorizado' })
    return
  }

  await query('DELETE FROM dream_analyses WHERE dream_id = $1', [id])
  res.status(204).send()
})

export default router
