import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { api } from '../lib/api'
import type { Session } from '@supabase/supabase-js'
import type { User } from '../types'

export default function AuthCallback() {
  const navigate    = useNavigate()
  const { setAuth } = useAuthStore()
  // useRef survives StrictMode double-invocation
  const resolved = useRef(false)

  useEffect(() => {
    async function handleSession(session: Session) {
      if (resolved.current) return
      resolved.current = true
      console.log('[AuthCallback] got session, user id:', session.user.id)

      useAuthStore.setState({
        accessToken:  session.access_token,
        refreshToken: session.refresh_token ?? '',
      })

      try {
        const { data: user } = await api.get<User>('/auth/me')
        setAuth(user, session.access_token, session.refresh_token ?? '')
        navigate(user.onboarding_done ? '/diary' : '/onboarding')
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status
        console.log('[AuthCallback] /auth/me status:', status)

        if (status === 404 || status === 500) {
          const meta       = session.user.user_metadata
          const name       = meta?.full_name ?? meta?.name ?? session.user.email?.split('@')[0] ?? 'Usuario'
          const avatar_url = meta?.avatar_url ?? meta?.picture ?? null
          try {
            await api.post('/auth/oauth-profile', { name, avatar_url })
            const { data: user } = await api.get<User>('/auth/me')
            setAuth(user, session.access_token, session.refresh_token ?? '')
            navigate('/onboarding')  // new user → onboarding
          } catch (e) {
            console.error('[AuthCallback] oauth-profile failed:', e)
            navigate('/login')
          }
        } else {
          navigate('/login')
        }
      }
    }

    console.log('[AuthCallback] mounted. hash:', window.location.hash.slice(0, 60))

    // 1. Listen for SIGNED_IN (Supabase fires this after parsing the hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthCallback] auth event:', event, !!session)
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        handleSession(session)
      }
    })

    // 2. Also check immediately — session may already exist
    supabase.auth.getSession().then(({ data, error }) => {
      console.log('[AuthCallback] getSession:', !!data.session, error?.message)
      if (data.session) { handleSession(data.session); return }

      // 3. Parse hash manually as last resort
      const params = new URLSearchParams(window.location.hash.substring(1))
      const access_token  = params.get('access_token')
      const refresh_token = params.get('refresh_token') ?? ''
      console.log('[AuthCallback] hash access_token present:', !!access_token)

      if (access_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data: sd, error: se }) => {
          console.log('[AuthCallback] setSession result:', !!sd.session, se?.message)
          if (!se && sd.session) handleSession(sd.session)
        })
      }
    })

    const timeout = setTimeout(() => {
      if (!resolved.current) {
        console.warn('[AuthCallback] timeout — no session found, redirecting to login')
        resolved.current = true
        navigate('/login')
      }
    }, 10_000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [navigate, setAuth])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      <p className="text-white/40 text-sm">Iniciando sesión…</p>
    </div>
  )
}
