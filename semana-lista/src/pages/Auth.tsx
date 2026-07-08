// src/pages/Auth.tsx
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../hooks/useI18n'
import { esNativo } from '../lib/ads'

const REDIRECT_URL = esNativo() ? 'com.semanalista.app://auth/callback' : `${window.location.origin}/`

async function abrirOAuthNativo(url: string) {
  try {
    // @ts-ignore — @capacitor/browser solo disponible en build Android
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url, windowName: '_self' })
  } catch (e) {
    // Fallback: abrir en el navegador del sistema si @capacitor/browser falla
    console.error('Browser plugin error:', e)
    window.open(url, '_system')
  }
}

type Mode = 'login' | 'registro'

export default function Auth() {
  const { t, lang } = useI18n()
  const { user, loading } = useAuth()

  function traducirError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return t.auth_err_credenciales
    if (msg.includes('Email not confirmed'))       return t.auth_err_confirma
    if (msg.includes('User already registered'))   return t.auth_err_existe
    if (msg.includes('Password should be'))        return t.auth_err_password
    if (msg.includes('Unable to validate'))        return t.auth_err_email
    if (msg.includes('rate limit'))                return t.auth_err_intentos
    if (msg.includes('network'))                   return t.auth_err_conexion
    return msg
  }
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
    setError(null)
    setEnviando(true)
    try {
      if (esNativo()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
        })
        if (error) throw error
        if (data.url) await abrirOAuthNativo(data.url)
        else throw new Error('No se recibió URL de autenticación')
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: REDIRECT_URL },
        })
        if (error) throw error
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar con Google'
      setError(traducirError(msg))
    } finally {
      setEnviando(false)
    }
  }


  if (loading) return null

  // Pantalla de confirmación de email
  if (confirmacionEnviada) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-5xl mb-4">📬</p>
          <h1 className="text-xl font-bold mb-2">{t.auth_revisa_email}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            {t.auth_enviado} <strong>{email}</strong>.
          </p>
          <button
            onClick={() => { setConfirmacionEnviada(false); setMode('login') }}
            className="text-green-select font-medium hover:underline text-sm block mx-auto"
          >
            {t.auth_ya_confirme}
          </button>
          <button
            onClick={() => { setConfirmacionEnviada(false); setMode('registro') }}
            className="mt-3 text-gray-400 hover:text-gray-500 text-xs block mx-auto hover:underline"
          >
            {t.auth_email_incorrecto}
          </button>
        </div>
      </div>
    )
  }

  const inputCls = "w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-select/50 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
    + " bg-white/60 dark:bg-white/8 backdrop-blur-md border border-white/70 dark:border-white/10"
    + " shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"

  return (
    <div className="min-h-screen flex items-center justify-center p-4 page-enter">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-4 shadow-xl"
            style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)' }}>
            <span className="text-4xl">🥗</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-1">{t.auth_titulo}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t.auth_subtitulo}</p>
        </div>

        <div className="card p-6 mb-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t.auth_email}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t.auth_password}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className={inputCls}
              />
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="btn-liquid w-full bg-green-select text-white rounded-xl py-3 font-black text-sm shadow-lg shadow-green-select/25 disabled:opacity-50"
            >
              {enviando ? t.auth_cargando : mode === 'login' ? t.auth_entrar : t.auth_crear_cuenta}
            </button>
          </form>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs text-gray-400">{t.auth_o}</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          <button
            onClick={handleGoogle}
            className="mt-4 w-full glass rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
            </svg>
            {t.auth_google}
          </button>
        </div>

        <p className="text-center text-sm text-gray-500">
          {mode === 'login' ? t.auth_sin_cuenta : t.auth_ya_cuenta}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'registro' : 'login'); setError(null) }}
            className="text-green-select font-semibold hover:underline"
          >
            {mode === 'login' ? t.auth_registrate : t.auth_inicia_sesion}
          </button>
        </p>

        <p className="mt-4 text-center text-xs text-gray-400">
          {lang === 'ca' ? (
            <>En continuar acceptes la nostra <Link to="/privacidad" className="underline hover:text-gray-600">política de privacitat</Link></>
          ) : (
            <>Al continuar aceptas nuestra <Link to="/privacidad" className="underline hover:text-gray-600">política de privacidad</Link></>
          )}
        </p>
      </div>
    </div>
  )
}
