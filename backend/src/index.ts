import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import cron from 'node-cron'
import authRouter from './routes/auth.js'
import dreamsRouter from './routes/dreams.js'
import feedRouter from './routes/feed.js'
import friendsRouter from './routes/friends.js'
import analysisRouter from './routes/analysis.js'
import coincidencesRouter from './routes/coincidences.js'
import statsRouter from './routes/stats.js'
import userRouter from './routes/user.js'
import notificationsRouter, { sendMorningReminders } from './routes/notifications.js'
import { startEmbeddingWorker } from './jobs/embedding.queue.js'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '64kb' }))

// Auth endpoints: stricter rate limit
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }))

app.use('/auth', authRouter)
app.use('/dreams', dreamsRouter)
app.use('/feed', feedRouter)
app.use('/friends', friendsRouter)
app.use('/dreams', analysisRouter)       // POST /dreams/:id/analyze
app.use('/coincidences', coincidencesRouter)
app.use('/stats', statsRouter)
app.use('/user', userRouter)
app.use('/notifications', notificationsRouter)

app.get('/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`DreamLog API running on :${PORT}`)
  startEmbeddingWorker()
  console.log('Embedding worker started')
})

cron.schedule('0 8 * * *', sendMorningReminders, { timezone: 'Europe/Madrid' })
console.log('Morning reminder cron scheduled (8am Europe/Madrid)')
