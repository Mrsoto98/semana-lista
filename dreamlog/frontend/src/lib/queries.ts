import { api } from './api'
import type { Dream, FeedDream, Friend, Coincidence, Stats, DreamAnalysis, User } from '../types'

// ── Auth ─────────────────────────────────────────────────────
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<User>('/auth/me'),
}

// ── Dreams ───────────────────────────────────────────────────
export const dreamsApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    api.get<Dream[]>('/dreams', { params }),
  get: (id: string) => api.get<Dream>(`/dreams/${id}`),
  create: (data: Partial<Dream>) => api.post<{ id: string }>('/dreams', data),
  update: (id: string, data: Partial<Dream>) => api.patch<Dream>(`/dreams/${id}`, data),
  remove: (id: string) => api.delete(`/dreams/${id}`),
  analyze: (id: string) => api.post<DreamAnalysis>(`/dreams/${id}/analyze`),
  reanalyze: (id: string) =>
    api.delete(`/dreams/${id}/analyze`).then(() => api.post<DreamAnalysis>(`/dreams/${id}/analyze`)),
}

// ── Feed ─────────────────────────────────────────────────────
export const feedApi = {
  friends: (params?: { limit?: number; offset?: number }) =>
    api.get<FeedDream[]>('/feed/friends', { params }),
  public: (params?: { limit?: number; offset?: number; search?: string }) =>
    api.get<FeedDream[]>('/feed/public', { params }),
}

// ── Friends ──────────────────────────────────────────────────
export const friendsApi = {
  list: () => api.get<Friend[]>('/friends'),
  search: (q: string) => api.get<Omit<User, 'email_verified' | 'default_visibility'>[]>('/friends/search', { params: { q } }),
  request: (targetId: string) => api.post('/friends/request', { targetId }),
  accept: (requesterId: string) => api.post('/friends/accept', { requesterId }),
  decline: (requesterId: string) => api.post('/friends/decline', { requesterId }),
  remove: (id: string) => api.delete(`/friends/${id}`),
  block: (targetId: string) => api.post('/friends/block', { targetId }),
}

// ── Coincidences ─────────────────────────────────────────────
export const coincidencesApi = {
  list: (scope?: 'friends' | 'public') =>
    api.get<Coincidence[]>('/coincidences', { params: scope ? { scope } : undefined }),
  accept: (id: string) => api.post(`/coincidences/${id}/accept`),
  dismiss: (id: string) => api.post(`/coincidences/${id}/dismiss`),
}

// ── Stats ────────────────────────────────────────────────────
export const statsApi = {
  get: () => api.get<Stats>('/stats'),
}

// ── User ─────────────────────────────────────────────────────
export const userApi = {
  updateProfile: (data: Partial<User>) => api.patch<User>('/user/profile', data),
  export: () => api.get('/user/export', { responseType: 'blob' }),
  deleteAccount: () => api.delete('/user'),
}
