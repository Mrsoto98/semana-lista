import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { query } from '../db/client.js'
import { validate } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// Admin client (service role) — only used server-side
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const RegisterSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

// ── POST /auth/register ──────────────────────────────────────
router.post('/register', validate(RegisterSchema), async (req, res) => {
  const { name, email, password } = req.body

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })

  if (error) {
    res.status(400).json({ error: error.message })
    return
  }

  res.status(201).json({
    message: 'Cuenta creada. Revisa tu correo para verificarla.',
    userId: data.user?.id,
  })
})

// ── POST /auth/login ─────────────────────────────────────────
router.post('/login', validate(LoginSchema), async (req, res) => {
  const { email, password } = req.body

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    res.status(401).json({ error: 'Credenciales incorrectas' })
    return
  }

  // Fetch profile
  const { rows } = await query(
    `SELECT id, name, avatar_url, avatar_emoji, bio, instagram_username,
            default_visibility, user_number, birth_date, birth_visibility, onboarding_done, created_at
     FROM profiles WHERE id = $1`,
    [data.user.id]
  )

  const profile = rows[0] ?? {}
  res.json({
    accessToken: data.session!.access_token,
    refreshToken: data.session!.refresh_token,
    user: {
      ...profile,
      id: data.user.id,
      email: data.user.email,
      email_verified: !!data.user.email_confirmed_at,
      name: profile.name ?? data.user.user_metadata?.name ?? '',
    },
  })
})

// ── POST /auth/refresh ───────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken requerido' })
    return
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })

  if (error || !data.session) {
    res.status(401).json({ error: 'Refresh token inválido' })
    return
  }

  res.json({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  })
})

// ── POST /auth/logout ────────────────────────────────────────
router.post('/logout', requireAuth, async (_req, res) => {
  // Supabase tokens expire naturally; client should discard them
  res.json({ message: 'Sesión cerrada' })
})

// ── GET /auth/me ─────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, name, avatar_url, avatar_emoji, bio, instagram_username, default_visibility, user_number, birth_date, onboarding_done, created_at FROM profiles WHERE id = $1',
      [req.user!.id]
    )
    if (!rows.length) {
      res.status(404).json({ error: 'Perfil no encontrado' })
      return
    }
    res.json({ ...rows[0], email: req.user!.email, email_verified: true })
  } catch (err) {
    console.error('[GET /auth/me] DB error:', err)
    res.status(500).json({ error: 'Error al obtener perfil' })
  }
})

const OAuthProfileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  avatar_url: z.string().url().nullable().optional(),
})

// ── POST /auth/oauth-profile ─────────────────────────────────
router.post('/oauth-profile', requireAuth, validate(OAuthProfileSchema), async (req, res) => {
  const { name, avatar_url } = req.body
  const userId = req.user!.id
  const email  = req.user!.email
  const fallbackName = name ?? (email ? email.split('@')[0] : 'Soñador')

  try {
    // Assign next user_number atomically
    await query(
      `INSERT INTO profiles (id, name, avatar_url, user_number)
       VALUES ($1, $2, $3, (SELECT COALESCE(MAX(user_number), 0) + 1 FROM profiles))
       ON CONFLICT (id) DO UPDATE SET
         name       = CASE WHEN profiles.name = '' THEN EXCLUDED.name ELSE profiles.name END,
         avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
         user_number = COALESCE(profiles.user_number, EXCLUDED.user_number)`,
      [userId, fallbackName, avatar_url ?? null]
    )
    res.status(201).json({ ok: true })
  } catch (err) {
    console.error('[POST /auth/oauth-profile] error:', err)
    res.status(500).json({ error: 'Error al crear perfil' })
  }
})

// ── GET /auth/verify-email ───────────────────────────────────
// Supabase handles email verification automatically via magic link.
// This endpoint is just for the frontend redirect after clicking the link.
router.get('/verify-email', (_req, res) => {
  res.json({ message: 'Email verificado por Supabase.' })
})

export default router
