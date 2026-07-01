import { Request, Response, NextFunction } from 'express'
import { verifyAccess } from '../utils/jwt.js'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autorizado' })
    return
  }
  try {
    const payload = verifyAccess(header.slice(7))
    req.user = { id: payload.sub, email: payload.email }
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}
