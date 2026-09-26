import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import type { Session } from '@supabase/supabase-js'
import type { User } from '../types'

export default function AuthCallback() {
  const navigate    = useNavigate()
  const { setAuth } = useAuthStore()
  const resolved = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlError = params.get('error_description') ?? params.get('error')
    if (urlError) {
      setError('No se pudo iniciar sesión. Redirigiendo…')
      setTimeout(() => navigate('/entrada'), 3000)
      return
    }

    async function handleSession(session: Session) {
      if (resolved.current) return
      resolved.current = true

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (error && error.code !== 'PGRST116') {
          setError('Error al cargar tu perfil. Redirigiendo…')
          setTimeout(() => navigate('/entrada'), 3000)
          return
        }

        let user: User

        if (!profile) {
          const meta       = session.user.user_metadata
          const name       = meta?.full_name ?? meta?.name ?? session.user.email?.split('@')[0] ?? 'Usuario'
          const avatar_url = meta?.avatar_url ?? meta?.picture ?? null

          const { data: created, error: insertErr } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              email: session.user.email ?? '',
              name,
              avatar_url,
              email_verified: true,
              onboarding_done: false,
              default_visibility: 'private',
              birth_visibility: 'none',
            })
            .select()
            .single()

          if (insertErr) {
            setError('Error al crear tu perfil. Redirigiendo…')
            setTimeout(() => navigate('/entrada'), 3000)
            return
          }
          user = toUser(created)
        } else {
          user = toUser(profile)
        }

        setAuth(user, session.access_token, session.refresh_token ?? '')
        navigate(user.onboarding_done ? '/perfil' : '/bienvenida')
      } catch {
        setError('Algo salió mal. Redirigiendo…')
        setTimeout(() => navigate('/entrada'), 3000)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session) {
        handleSession(session)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { handleSession(data.session); return }

      const hash = new URLSearchParams(window.location.hash.substring(1))
      const access_token  = hash.get('access_token')
      const refresh_token = hash.get('refresh_token') ?? ''
      if (access_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data: sd, error: se }) => {
          if (se) { setError('Error al establecer sesión. Redirigiendo…'); setTimeout(() => navigate('/entrada'), 3000); return }
          if (sd.session) handleSession(sd.session)
        })
      }
    })

    const timeout = setTimeout(() => {
      if (!resolved.current) {
        resolved.current = true
        setError('La sesión tardó demasiado. Redirigiendo…')
        setTimeout(() => navigate('/entrada'), 2000)
      }
    }, 10_000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [navigate, setAuth])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <img src="/icon.svg" alt="myDreams" className="w-16 h-16 opacity-90" />
      <span
        className="text-2xl text-white/90"
        style={{ fontFamily: "'Instrument Serif', serif" }}
      >
        myDreams
      </span>
      {error ? (
        <p className="text-white/50 text-sm text-center px-8">{error}</p>
      ) : (
        <div className="w-5 h-5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
      )}
    </div>
  )
}

function toUser(p: Record<string, unknown>): User {
  return {
    id:                   p.id as string,
    email:                (p.email as string) ?? '',
    name:                 (p.name as string) ?? '',
    avatar_url:           (p.avatar_url as string | null) ?? null,
    avatar_emoji:         (p.avatar_emoji as string | null) ?? null,
    bio:                  (p.bio as string | null) ?? null,
    email_verified:       (p.email_verified as boolean) ?? true,
    default_visibility:   (p.default_visibility as User['default_visibility']) ?? 'private',
    user_number:          (p.user_number as number | null) ?? null,
    birth_date:           (p.birth_date as string | null) ?? null,
    birth_visibility:     (p.birth_visibility as User['birth_visibility']) ?? 'none',
    birth_time:           (p.birth_time as string | null) ?? null,
    location:             (p.location as string | null) ?? null,
    country:              (p.country as string | null) ?? null,
    residence_city:       (p.residence_city as string | null) ?? null,
    residence_country:    (p.residence_country as string | null) ?? null,
    location_visibility:  (p.location_visibility as User['location_visibility']) ?? 'birth',
    show_zodiac:          (p.show_zodiac as boolean) ?? false,
    onboarding_done:      (p.onboarding_done as boolean) ?? false,
    instagram_username:   (p.instagram_username as string | null) ?? null,
    created_at:           p.created_at as string,
  }
}
