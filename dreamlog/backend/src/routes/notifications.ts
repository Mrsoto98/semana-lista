import { Router } from 'express'
import webpush from 'web-push'
import { z } from 'zod'
import { query } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()
router.use(requireAuth)

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL ?? 'hello@bitacoradelsueño.app'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

// POST /notifications/subscribe
router.post('/subscribe', validate(SubscribeSchema), async (req, res) => {
  const userId = req.user!.id
  const { endpoint, keys } = req.body

  try {
    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         endpoint = EXCLUDED.endpoint,
         p256dh   = EXCLUDED.p256dh,
         auth     = EXCLUDED.auth,
         updated_at = now()`,
      [userId, endpoint, keys.p256dh, keys.auth]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[notifications/subscribe]', err)
    res.status(500).json({ error: 'Error al guardar suscripción' })
  }
})

// DELETE /notifications/subscribe
router.delete('/subscribe', async (req, res) => {
  const userId = req.user!.id
  await query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId])
  res.json({ ok: true })
})

// Helper used by cron (exported)
export async function sendMorningReminders() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return
  const { rows } = await query<{ endpoint: string; p256dh: string; auth: string }>(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions'
  )
  const payload = JSON.stringify({
    title: '🌙 Bitácora del Sueño',
    body: '¿Tuviste algún sueño esta noche? Regístralo antes de que lo olvides ✨',
    url: '/diary',
  })
  const results = await Promise.allSettled(
    rows.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  )
  const failed = results.filter(r => r.status === 'rejected').length
  console.log(`[cron] Morning push sent to ${rows.length - failed}/${rows.length} devices`)
}

export default router
