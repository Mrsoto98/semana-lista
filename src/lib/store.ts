import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, ThemeId, DiarySkin } from '../types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  themeId: ThemeId
  diarySkin: DiarySkin
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  updateUser: (patch: Partial<User>) => void
  logout: () => void
  refresh: () => Promise<string>
  setTheme: (id: ThemeId) => void
  setDiarySkin: (skin: DiarySkin) => void
}

function applyTheme(id: ThemeId) {
  document.documentElement.removeAttribute('data-theme')
  if (id !== 'cosmos') document.documentElement.setAttribute('data-theme', id)
}

export const DEFAULT_THEME: ThemeId = 'cosmos'

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      themeId: DEFAULT_THEME,
      diarySkin: 'cosmico',

      setTheme: (id) => {
        set({ themeId: id })
        applyTheme(id)
      },

      setDiarySkin: (skin) => set({ diarySkin: skin }),

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),

      updateUser: (patch) =>
        set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),

      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null })
      },

      refresh: async () => {
        const { refreshToken } = get()
        if (!refreshToken) throw new Error('No refresh token')

        const doRefresh = () => fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })

        let res = await doRefresh()
        // Render free tier cold start can cause 504 — retry once after 3s
        if (res.status >= 500) {
          await new Promise(r => setTimeout(r, 3000))
          res = await doRefresh()
        }
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
      name: 'dreamlog-v2',
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        themeId: s.themeId,
        diarySkin: s.diarySkin,
      }),
    }
  )
)

// Apply persisted theme on store load
const stored = localStorage.getItem('dreamlog-v2')
if (stored) {
  try {
    const { state } = JSON.parse(stored)
    if (state?.themeId) applyTheme(state.themeId)
  } catch { /* ignore */ }
}
