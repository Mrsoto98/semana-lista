// src/pages/Auth.tsx
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type Mode = 'login' | 'registro'

function traducirError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (msg.includes('Email not confirmed'))       return 'Confirma tu email antes de entrar. Revisa tu bandeja de entrada.'
  if (msg.includes('User already registered'))   return 'Ya existe una cuenta con ese email. Inicia sesión.'
  if (msg.includes('Password should be'))        return 'La contraseña debe tener al menos 6 caracteres.'
  if (msg.includes('Unable to validate'))        return 'Email inválido. Comprueba que está bien escrito.'
  if (msg.includes('rate limit'))                return 'Demasiados intentos. Espera unos minutos.'
  if (msg.includes('network'))                   return 'Error de conexión. Comprueba tu red.'
  return msg
}

export default function Auth() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmacionEnviada, setConfirmacionEnviada] = useState(false)

  useEffect(() => {
    if (!loading && user) redirectAfterLogin()
  }, [user, loading])

  async function redirectAfterLogin() {
    const { data } = await supabase
      .from('perfiles')
      .select('id')
      .eq('usuario_id', user!.id)
      .maybeSingle()
    navigate(data ? '/menu' : '/onboarding', { replace: true })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      if (mode === 'registro') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        // Si session es null significa que necesita confirmar email
        if (!data.session) {
          setConfirmacionEnviada(true)
          return
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(traducirError(msg))
    } finally {
      setEnviando(false)
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
  }

  if (loading) return null

  // Pantalla de confirmación de email
  if (confirmacionEnviada) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-5xl mb-4">📬</p>
          <h1 className="text-xl font-bold mb-2">Revisa tu email</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            Hemos enviado un enlace de confirmación a <strong>{email}</strong>.
            Ábrelo y vuelve aquí para entrar.
          </p>
          <button
            onClick={() => { setConfirmacionEnviada(false); setMode('login') }}
            className="text-green-select font-medium hover:underline text-sm"
          >
            Ya lo confirmé → Iniciar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 page-enter">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-5xl mb-3">🥗</p>
          <h1 className="text-3xl font-black tracking-tight mb-1">Semana Lista</h1>
          <p className="text-gray-400 text-sm">Tu planificador semanal con IA</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border rounded-card px-4 py-2 bg-white dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-select"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full border rounded-card px-4 py-2 bg-white dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-select"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-green-select text-white rounded-card py-2 font-semibold hover:bg-green-600 disabled:opacity-50"
          >
            {enviando ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-xs text-gray-400">o</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>

        <button
          onClick={handleGoogle}
          className="mt-4 w-full border rounded-card py-2 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continuar con Google
        </button>

        <p className="mt-6 text-center text-sm text-gray-500">
          {mode === 'login' ? '¿Sin cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'registro' : 'login'); setError(null) }}
            className="text-green-select font-medium hover:underline"
          >
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>

        <p className="mt-8 text-center text-xs text-gray-400">
          Al continuar aceptas nuestra{' '}
          <Link to="/privacidad" className="underline hover:text-gray-600">política de privacidad</Link>
        </p>
      </div>
    </div>
  )
}
