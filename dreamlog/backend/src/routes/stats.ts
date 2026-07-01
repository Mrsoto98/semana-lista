import { Router } from 'express'
import { query } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// ── GET /stats ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const userId = req.user!.id

  const [totals, byVisibility, byMonth, lucid, topEmotions, topTags, topSymbols, streak] =
    await Promise.all([
      // Total counts
      query<{ total: string; lucid: string; avg_quality: string }>(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE is_lucid) AS lucid,
                ROUND(AVG(sleep_quality), 1) AS avg_quality
         FROM dreams WHERE user_id = $1`,
        [userId]
      ),
      // By visibility
      query(
        `SELECT visibility, COUNT(*) AS count
         FROM dreams WHERE user_id = $1
         GROUP BY visibility`,
        [userId]
      ),
      // Dreams per month (last 12 months)
      query(
        `SELECT TO_CHAR(dream_date, 'YYYY-MM') AS month, COUNT(*) AS count
         FROM dreams
         WHERE user_id = $1 AND dream_date >= now() - INTERVAL '12 months'
         GROUP BY month ORDER BY month`,
        [userId]
      ),
      // Lucid ratio
      query<{ ratio: string }>(
        `SELECT ROUND(
           100.0 * COUNT(*) FILTER (WHERE is_lucid) / NULLIF(COUNT(*), 0), 1
         ) AS ratio
         FROM dreams WHERE user_id = $1`,
        [userId]
      ),
      // Top emotions
      query(
        `SELECT emotion, COUNT(*) AS count
         FROM dreams, UNNEST(emotions) AS emotion
         WHERE user_id = $1
         GROUP BY emotion ORDER BY count DESC LIMIT 8`,
        [userId]
      ),
      // Top tags
      query(
        `SELECT tag, COUNT(*) AS count
         FROM dreams, UNNEST(tags) AS tag
         WHERE user_id = $1
         GROUP BY tag ORDER BY count DESC LIMIT 10`,
        [userId]
      ),
      // Top symbols from AI analyses
      query(
        `SELECT symbol, COUNT(*) AS count
         FROM dreams d
         JOIN dream_analyses da ON da.dream_id = d.id,
         UNNEST(da.symbols) AS symbol
         WHERE d.user_id = $1
         GROUP BY symbol ORDER BY count DESC LIMIT 10`,
        [userId]
      ),
      // Current streak (consecutive days with at least one dream)
      query<{ streak: string }>(
        `WITH dated AS (
           SELECT DISTINCT dream_date FROM dreams WHERE user_id = $1
         ),
         streaks AS (
           SELECT dream_date,
                  dream_date - (ROW_NUMBER() OVER (ORDER BY dream_date))::int AS grp
           FROM dated
         )
         SELECT COUNT(*) AS streak
         FROM streaks
         WHERE grp = (
           SELECT dream_date - (ROW_NUMBER() OVER (ORDER BY dream_date))::int
           FROM streaks ORDER BY dream_date DESC LIMIT 1
         )`,
        [userId]
      ),
    ])

  res.json({
    totals: totals.rows[0],
    lucidRatio: lucid.rows[0]?.ratio ?? '0',
    streak: Number(streak.rows[0]?.streak ?? 0),
    byVisibility: byVisibility.rows,
    byMonth: byMonth.rows,
    topEmotions: topEmotions.rows,
    topTags: topTags.rows,
    topSymbols: topSymbols.rows,
  })
})

export default router
