import { Request, Response, NextFunction } from 'express'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://nqusbtmgctafpnztrxgn.supabase.co'
const JWKS_URL = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`

const JWKS = createRemoteJWKSet(new URL(JWKS_URL))

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }

  const token = header.slice(7)

  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: SUPABASE_URL + '/auth/v1' })
    req.user = {
      id: payload.sub!,
      email: (payload as { email?: string }).email ?? '',
    }
    next()
  } catch (err) {
    console.error('[requireAuth] JWT verification failed:', (err as Error).message)
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}
