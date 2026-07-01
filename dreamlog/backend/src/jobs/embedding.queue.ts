// No Redis/BullMQ — embeddings run synchronously after dream save.
// For a first free version this is fine; add a queue later if load increases.

import { query } from '../db/client.js'
import { embed, MODEL } from '../services/embedding.js'

const SIMILARITY_THRESHOLD = 0.82

export async function enqueueDreamEmbedding(dreamId: string) {
  // Run in background without blocking the HTTP response
  setImmediate(() => processDreamEmbedding(dreamId).catch(console.error))
}

async function processDreamEmbedding(dreamId: string) {
  const { rows } = await query<{
    id: string; title: string | null; body: string; visibility: string; user_id: string
  }>(
    'SELECT id, title, body, visibility, user_id FROM dreams WHERE id = $1',
    [dreamId]
  )

  if (!rows.length) return
  const dream = rows[0]
  if (dream.visibility === 'private') return

  const text = dream.title ? `${dream.title}\n\n${dream.body}` : dream.body
  const vector = await embed(text)

  await query(
    `UPDATE dreams SET embedding = $1, embedding_model = $2, updated_at = now() WHERE id = $3`,
    [`[${vector.join(',')}]`, MODEL, dreamId]
  )

  await findCoincidences(dreamId, vector, dream.visibility as 'friends' | 'public', dream.user_id)
}

async function findCoincidences(
  dreamId: string,
  vector: number[],
  visibility: 'friends' | 'public',
  userId: string
) {
  let scopeFilter: string
  const params: unknown[] = [`[${vector.join(',')}]`, userId, SIMILARITY_THRESHOLD, dreamId]

  if (visibility === 'friends') {
    scopeFilter = `
      AND d.visibility IN ('friends','public')
      AND d.user_id != $2
      AND EXISTS (
        SELECT 1 FROM friendships f
        WHERE f.status = 'accepted'
          AND ((f.requester_id = $2 AND f.addressee_id = d.user_id)
            OR (f.requester_id = d.user_id AND f.addressee_id = $2))
      )`
  } else {
    scopeFilter = `AND d.visibility = 'public' AND d.user_id != $2`
  }

  const { rows: similar } = await query<{ id: string; score: number }>(
    `SELECT d.id, 1 - (d.embedding <=> $1::vector) AS score
     FROM dreams d
     WHERE d.embedding IS NOT NULL
       AND d.id != $4
       AND 1 - (d.embedding <=> $1::vector) >= $3
       ${scopeFilter}
     ORDER BY score DESC LIMIT 10`,
    params
  )

  for (const match of similar) {
    const [a, b] = [dreamId, match.id].sort()
    await query(
      `INSERT INTO coincidences (dream_a_id, dream_b_id, score, scope)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (dream_a_id, dream_b_id) DO UPDATE
         SET score = GREATEST(coincidences.score, $3)`,
      [a, b, match.score, visibility]
    )
  }
}

export function startEmbeddingWorker() {
  // No-op: no worker needed without Redis
  console.log('Embedding: synchronous mode (no Redis required)')
}
