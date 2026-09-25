import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import type { User } from '../types'
import { CosmicBackground } from '../components/common/CosmicBackground'

interface Props {
  mode?: 'login' | 'register'
}

export default function AuthPage({ mode = 'login' }: Props) {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const user = useAuthStore((s) => s.user)

  const [isLogin, setIsLogin] = useState(mode === 'login')
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    if (user) navigate('/perfil', { replace: true })
  }, [user, navigate])

  async function loadProfile(userId: string, accessToken: string, refreshToken: string) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (!profile) return
    setAuth(profile as unknown as User, accessToken, refreshToken)
    navigate((profile as { onboarding_done?: boolean }).onboarding_done ? '/perfil' : '/bienvenida', { replace: true })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw new Error(error.message)
        await loadProfile(data.user.id, data.session.access_token, data.session.refresh_token)
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } },
        })
        if (error) throw new Error(error.message)
        if (data.session) {
          // Auto-confirmed — create profile and navigate
          await supabase.from('profiles').upsert({
            id: data.user!.id, email, name,
            email_verified: true, onboarding_done: false, default_visibility: 'private', birth_visibility: 'none',
          })
          await loadProfile(data.user!.id, data.session.access_token, data.session.refresh_token)
        } else {
          setError('Revisa tu email para confirmar la cuenta antes de entrar.')
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message ?? (isLogin ? 'Credenciales incorrectas' : 'Error al registrarse'))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  function toggleMode() {
    setIsLogin((v) => !v)
    setError('')
    setName('')
  }

  return (
    <div className="relative min-h-svh flex flex-col items-center justify-center px-4 py-6 overflow-y-auto">
      <CosmicBackground />

      <div className="relative z-10 w-full max-w-[380px]">
        {/* Logo + tagline */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-5"
        >
          <img
            src="/logo.png"
            alt="myDreams"
            className="mx-auto w-full max-w-[220px] select-none -mb-1"
          />
          <p className="text-sm text-white/40 italic">
            Tu diario de sueños compartido
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="glass rounded-[24px] p-5"
        >
          {/* Mode toggle */}
          <div className="flex rounded-xl overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setIsLogin(m === 'login')}
                className="flex-1 py-2.5 text-sm font-medium transition-all duration-200"
                style={{
                  background: (m === 'login') === isLogin
                    ? `rgba(var(--glow), 0.22)`
                    : 'transparent',
                  color: (m === 'login') === isLogin
                    ? `hsl(var(--accent-h), var(--accent-s), 82%)`
                    : 'rgba(255,255,255,0.38)',
                  borderRadius: 10,
                }}
              >
                {m === 'login' ? 'Entrar' : 'Registrarse'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name field — only for register */}
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className="block text-xs font-medium text-white/50 mb-1.5">Nombre</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="¿Cómo te llamas?"
                    required={!isLogin}
                    className="glass-input px-4 py-3 text-sm"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="email"
                className="glass-input px-4 py-3 text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="glass-input px-4 py-3 text-sm pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/65 transition-colors"
                  aria-label={showPass ? 'Ocultar' : 'Mostrar'}
                >
                  {showPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(232,88,88,0.12)', color: '#E85858', border: '1px solid rgba(232,88,88,0.2)' }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              className="glass-btn-primary w-full py-3 text-sm font-semibold"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner /> {isLogin ? 'Entrando...' : 'Creando cuenta...'}
                </span>
              ) : (
                isLogin ? 'Entrar al diario' : 'Crear mi diario'
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <span className="text-xs text-white/25">o</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Google OAuth */}
          <motion.button
            type="button"
            onClick={handleGoogle}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.97 }}
            className="glass-btn-secondary w-full py-3 text-sm font-medium flex items-center justify-center gap-2.5"
          >
            <GoogleLogo />
            Continuar con Google
          </motion.button>
        </motion.div>

        {/* Link to switch */}
        <p className="text-center text-xs text-white/30 mt-5">
          {isLogin ? '¿Nuevo aquí?' : '¿Ya tienes cuenta?'}{' '}
          <button
            type="button"
            onClick={toggleMode}
            className="underline text-white/50 hover:text-white/75 transition-colors"
          >
            {isLogin ? 'Crear cuenta' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
      </path>
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
