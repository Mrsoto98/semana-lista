import { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }

  const token = header.slice(7)

  supabase.auth.getUser(token).then(({ data, error }) => {
    if (error || !data.user) {
      res.status(401).json({ error: 'Token inválido o expirado' })
      return
    }
    req.user = { id: data.user.id, email: data.user.email! }
    next()
  }).catch((err) => {
    console.error('[requireAuth] unexpected error:', err)
    res.status(500).json({ error: 'Error de autenticación' })
  })
}
