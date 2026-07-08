import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import { applyTheme, DEFAULT_THEME } from './themes'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  themeId: string
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
  refresh: () => Promise<string>
  setTheme: (id: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      themeId: DEFAULT_THEME,

      setTheme: (id) => {
        set({ themeId: id })
        applyTheme(id)
      },

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),

      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null })
      },

      refresh: async () => {
        const { refreshToken } = get()
        if (!refreshToken) throw new Error('No refresh token')

        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (!res.ok) {
          set({ user: null, accessToken: null, refreshToken: null })
          throw new Error('Session expired')
        }
        const data = await res.json()
        set({ accessToken: data.accessToken, refreshToken: data.refreshToken })
        return data.accessToken
      },
    }),
    {
      name: 'dreamlog-auth',
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        themeId: s.themeId,
      }),
    }
  )
)
