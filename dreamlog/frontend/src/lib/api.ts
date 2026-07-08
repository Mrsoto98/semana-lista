import axios from 'axios'
import { useAuthStore } from './store'

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}`
  : '/api'

export const api = axios.create({ baseURL: BASE_URL })

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
let refreshing: Promise<string> | null = null

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status !== 401 || original._retry) throw err

    original._retry = true

    if (!refreshing) {
      refreshing = useAuthStore
        .getState()
        .refresh()
        .finally(() => { refreshing = null })
    }

    await refreshing
    const token = useAuthStore.getState().accessToken
    original.headers.Authorization = `Bearer ${token}`
    return api(original)
  }
)
