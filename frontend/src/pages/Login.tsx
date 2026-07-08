import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../lib/queries'
import { signInWithGoogle } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { applyTheme, DEFAULT_THEME } from '../lib/themes'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function Login() {
  const navigate = useNavigate()
  const { setAuth, themeId } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    applyTheme(themeId ?? DEFAULT_THEME)
  }, [themeId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.login({ email, password })
      setAuth(data.user, data.accessToken, data.refreshToken)
      navigate('/diary')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background orbs */}
      <div
        className="orb w-[500px] h-[500px] top-[-150px] left-[-150px] opacity-30"
        style={{ background: `radial-gradient(circle, rgba(var(--glow-color),0.5) 0%, transparent 70%)` }}
      />
      <div
        className="orb w-[350px] h-[350px] bottom-[-100px] right-[-80px] opacity-20"
        style={{ background: `radial-gradient(circle, rgba(var(--glow-color),0.4) 0%, transparent 70%)` }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4 animate-float inline-block">🌙</div>
          <h1 className="text-2xl font-bold text-white accent-glow">Bitácora del Sueño</h1>
          <p className="text-white/30 mt-1 text-sm">Tu diario de sueños compartido</p>
        </div>

        {/* Glass panel */}
        <div className="glass rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-6">Iniciar sesión</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoComplete="email"
            />
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            {error && (
              <p className="text-xs text-red-400/80 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" loading={loading} size="lg" className="mt-2 w-full">
              Entrar
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/25 text-xs">o continúa con</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Google button */}
          <button
            type="button"
            disabled={googleLoading}
            onClick={async () => {
              setGoogleLoading(true)
              try { await signInWithGoogle() } catch { setError('Error al conectar con Google') ; setGoogleLoading(false) }
            }}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition-colors text-white/80 text-sm font-medium disabled:opacity-50"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLoading ? 'Redirigiendo...' : 'Google'}
          </button>

          <p className="text-center text-xs text-white/25 mt-5">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="accent-text hover:opacity-80 transition-opacity">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
