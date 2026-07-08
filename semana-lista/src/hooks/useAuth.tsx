// src/hooks/useAuth.tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthCtx {
  user: User | null
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthCtx>({ user: null, session: null, loading: true })

const ACTIVE_USER_KEY = 'semana-lista:_active_user'

function limpiarStorageDeOtroUsuario(nuevoUserId: string | null) {
  const prevId = localStorage.getItem(ACTIVE_USER_KEY)
  const hayDatos = Object.keys(localStorage).some(k => k.startsWith('semana-lista:') && k !== ACTIVE_USER_KEY)

  // Limpiar si: hay un usuario nuevo Y (el ID cambió O no había ID guardado pero sí había datos de otro)
  if (nuevoUserId && (prevId !== nuevoUserId) && (prevId !== null || hayDatos)) {
    const keysToDelete = Object.keys(localStorage).filter(k => k.startsWith('semana-lista:') && k !== ACTIVE_USER_KEY)
    keysToDelete.forEach(k => localStorage.removeItem(k))
  }
  if (nuevoUserId) {
    localStorage.setItem(ACTIVE_USER_KEY, nuevoUserId)
  } else {
    localStorage.removeItem(ACTIVE_USER_KEY)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      limpiarStorageDeOtroUsuario(data.session?.user.id ?? null)
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      limpiarStorageDeOtroUsuario(s?.user.id ?? null)
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
