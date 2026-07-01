import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../lib/api'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setStatus('error'); return }
    api.get(`/auth/verify-email?token=${token}`)
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'))
  }, [params])

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-2 border-dream-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Verificando tu email…</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-white mb-2">Email verificado</h2>
            <p className="text-slate-400 mb-6">Ya puedes iniciar sesión en DreamLog.</p>
            <Link to="/login" className="text-dream-400 hover:text-dream-300">Ir al inicio de sesión →</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-white mb-2">Enlace inválido</h2>
            <p className="text-slate-400 mb-6">El enlace ya fue usado o ha caducado.</p>
            <Link to="/login" className="text-dream-400 hover:text-dream-300">Volver al inicio</Link>
          </>
        )}
      </div>
    </div>
  )
}
