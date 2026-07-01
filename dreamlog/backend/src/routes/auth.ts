import { Router } from 'express'
import argon2 from 'argon2'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { query } from '../db/client.js'
import { signAccess, signRefresh, verifyRefresh } from '../utils/jwt.js'
import { sendVerificationEmail } from '../utils/email.js'
import { validate } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

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

  const exists = await query('SELECT id FROM users WHERE email = $1', [email])
  if (exists.rowCount) {
    res.status(409).json({ error: 'El email ya está registrado' })
    return
  }

  const password_hash = await argon2.hash(password)
  const email_verify_token = randomBytes(32).toString('hex')

  const { rows } = await query<{ id: string }>(
    `INSERT INTO users (name, email, password_hash, email_verify_token)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, email, password_hash, email_verify_token]
  )

  await sendVerificationEmail(email, email_verify_token).catch((err) =>
    console.error('Email send failed', err)
  )

  res.status(201).json({
    message: 'Cuenta creada. Revisa tu correo para verificarla.',
    userId: rows[0].id,
  })
})

// ── GET /auth/verify-email ───────────────────────────────────
router.get('/verify-email', async (req, res) => {
  const { token } = req.query
  if (typeof token !== 'string') {
    res.status(400).json({ error: 'Token requerido' })
    return
  }

  const { rowCount } = await query(
    `UPDATE users
     SET email_verified = TRUE, email_verify_token = NULL
     WHERE email_verify_token = $1 AND deleted_at IS NULL`,
    [token]
  )

  if (!rowCount) {
    res.status(400).json({ error: 'Token inválido o ya usado' })
    return
  }

  res.json({ message: 'Email verificado. Ya puedes iniciar sesión.' })
})

// ── POST /auth/login ─────────────────────────────────────────
router.post('/login', validate(LoginSchema), async (req, res) => {
  const { email, password } = req.body

  const { rows } = await query<{
    id: string; password_hash: string; email_verified: boolean; name: string
  }>(
    `SELECT id, password_hash, email_verified, name
     FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email]
  )

  if (!rows.length || !(await argon2.verify(rows[0].password_hash, password))) {
    res.status(401).json({ error: 'Credenciales incorrectas' })
    return
  }

  if (!rows[0].email_verified) {
    res.status(403).json({ error: 'Verifica tu email antes de entrar' })
    return
  }

  const payload = { sub: rows[0].id, email }
  const accessToken = signAccess(payload)
  const refreshToken = signRefresh(payload)

  const refreshHash = await argon2.hash(refreshToken)
  await query('UPDATE users SET refresh_token_hash = $1 WHERE id = $2', [refreshHash, rows[0].id])

  res.json({ accessToken, refreshToken, user: { id: rows[0].id, name: rows[0].name, email } })
})

// ── POST /auth/refresh ───────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken requerido' })
    return
  }

  let payload: { sub: string; email: string }
  try {
    payload = verifyRefresh(refreshToken) as { sub: string; email: string }
  } catch {
    res.status(401).json({ error: 'Refresh token inválido' })
    return
  }

  const { rows } = await query<{ refresh_token_hash: string }>(
    'SELECT refresh_token_hash FROM users WHERE id = $1 AND deleted_at IS NULL',
    [payload.sub]
  )

  if (!rows.length || !(await argon2.verify(rows[0].refresh_token_hash ?? '', refreshToken))) {
    res.status(401).json({ error: 'Refresh token inválido o revocado' })
    return
  }

  const newAccess = signAccess(payload)
  const newRefresh = signRefresh(payload)
  const newHash = await argon2.hash(newRefresh)
  await query('UPDATE users SET refresh_token_hash = $1 WHERE id = $2', [newHash, payload.sub])

  res.json({ accessToken: newAccess, refreshToken: newRefresh })
})

// ── POST /auth/logout ────────────────────────────────────────
router.post('/logout', requireAuth, async (req, res) => {
  await query('UPDATE users SET refresh_token_hash = NULL WHERE id = $1', [req.user!.id])
  res.json({ message: 'Sesión cerrada' })
})

// ── GET /auth/me ─────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT id, email, name, avatar_url, bio, email_verified, default_visibility, created_at
     FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [req.user!.id]
  )
  if (!rows.length) {
    res.status(404).json({ error: 'Usuario no encontrado' })
    return
  }
  res.json(rows[0])
})

export default router
