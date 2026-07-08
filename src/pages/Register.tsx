import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../lib/queries'
import { signInWithGoogle } from '../lib/supabase'
import { applyTheme, DEFAULT_THEME } from '../lib/themes'
import { useAuthStore } from '../lib/store'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function Register() {
  const { themeId } = useAuthStore()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => { applyTheme(themeId ?? DEFAULT_THEME) }, [themeId])

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setLoading(true)
    try {
      await authApi.register(form)
      setDone(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-10 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">📬</div>
          <h2 className="text-xl font-bold text-white mb-2">Revisa tu correo</h2>
          <p className="text-white/40 text-sm mb-6">
            Te hemos enviado un enlace de verificación. Confírmalo para empezar.
          </p>
          <Link to="/login" className="accent-text text-sm hover:opacity-80 transition-opacity">
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="orb w-[500px] h-[500px] top-[-150px] right-[-150px] opacity-25"
        style={{ background: `radial-gradient(circle, rgba(var(--glow-color),0.5) 0%, transparent 70%)` }}
      />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4 animate-float inline-block">🌙</div>
          <h1 className="text-2xl font-bold text-white accent-glow">Bitácora del Sueño</h1>
          <p className="text-white/30 mt-1 text-sm">Empieza tu diario de sueños</p>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-6">Crear cuenta</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Nombre" value={form.name} onChange={set('name')} placeholder="Tu nombre" required />
            <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="tu@email.com" required autoComplete="email" />
            <Input label="Contraseña" type="password" value={form.password} onChange={set('password')} placeholder="Mín. 8 caracteres" required autoComplete="new-password" />
            {error && (
              <p className="text-xs text-red-400/80 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" loading={loading} size="lg" className="mt-2 w-full">
              Crear cuenta
            </Button>
          </form>
          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/25 text-xs">o regístrate con</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Google button */}
          <button
            type="button"
            disabled={googleLoading}
            onClick={async () => {
              setGoogleLoading(true)
              try { await signInWithGoogle() } catch { setError('Error al conectar con Google'); setGoogleLoading(false) }
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
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="accent-text hover:opacity-80 transition-opacity">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
