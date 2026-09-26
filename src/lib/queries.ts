import { api } from './api'
import type {
  Dream, FeedDream, Coincidence, Stats,
  DreamAnalysis, User, DreamComment, DreamPoll,
  Whisper, WhisperReflection, WhisperFeed,
} from '../types'

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
  getAnalysis: (id: string) => api.get<DreamAnalysis>(`/dreams/${id}/analyze`),
  analyze: (id: string) => api.post<DreamAnalysis>(`/dreams/${id}/analyze`),
  reanalyze: (id: string) =>
    api.delete(`/dreams/${id}/analyze`).then(() => api.post<DreamAnalysis>(`/dreams/${id}/analyze`)),
  suggestTitle: (body: string) =>
    api.post<{ title: string }>('/dreams/suggest-title', { body }),
}

// ── Feed ─────────────────────────────────────────────────────
export const feedApi = {
  friends: (params?: { limit?: number; offset?: number; sort?: 'recent' | 'popular' }) =>
    api.get<FeedDream[]>('/feed/friends', { params }),
  public: (params?: { limit?: number; offset?: number; search?: string; sort?: 'recent' | 'popular' }) =>
    api.get<FeedDream[]>('/feed/public', { params }),
}

// ── Likes ─────────────────────────────────────────────────────
export const likesApi = {
  like:   (dreamId: string) => api.post<{ like_count: number; user_liked: boolean }>(`/dreams/${dreamId}/like`),
  unlike: (dreamId: string) => api.delete<{ like_count: number; user_liked: boolean }>(`/dreams/${dreamId}/like`),
}

// ── Friends ──────────────────────────────────────────────────
export const friendsApi = {
  list: () => api.get<any[]>('/friends'),
  search: (q: string) => api.get<Omit<User, 'email_verified' | 'default_visibility'>[]>('/friends/search', { params: { q } }),
  request: (targetId: string) => api.post('/friends/request', { targetId }),
  accept: (requesterId: string) => api.post('/friends/accept', { requesterId }),
  decline: (requesterId: string) => api.post('/friends/decline', { requesterId }),
  remove: (id: string) => api.delete(`/friends/${id}`),
  block: (targetId: string) => api.post('/friends/block', { targetId }),
}

// ── Whispers / Susurros ───────────────────────────────────────
export const whispersApi = {
  feed: (params?: { sort?: WhisperFeed; limit?: number; offset?: number }) =>
    api.get<Whisper[]>('/whispers', { params }),
  mine: () => api.get<Whisper[]>('/whispers/mine'),
  create: (data: { body: string; emotions?: string[]; dream_id?: string }) =>
    api.post<Whisper>('/whispers', data),
  remove: (id: string) => api.delete(`/whispers/${id}`),
  resono: (id: string) =>
    api.post<{ resono_count: number; user_resonated: boolean }>(`/whispers/${id}/resono`),
  unresono: (id: string) =>
    api.delete<{ resono_count: number; user_resonated: boolean }>(`/whispers/${id}/resono`),
  reflections: (id: string) => api.get<WhisperReflection[]>(`/whispers/${id}/reflections`),
  addReflection: (id: string, body: string) =>
    api.post<WhisperReflection>(`/whispers/${id}/reflections`, { body }),
  report: (id: string, reason: string) => api.post(`/whispers/${id}/report`, { reason }),
}

// ── Comments ─────────────────────────────────────────────────
export const commentsApi = {
  list: (dreamId: string) => api.get<DreamComment[]>(`/dreams/${dreamId}/comments`),
  post: (dreamId: string, body: string, parentCommentId?: string) =>
    api.post<DreamComment>(`/dreams/${dreamId}/comments`, { body, parent_comment_id: parentCommentId }),
  remove: (commentId: string) => api.delete(`/dreams/comments/${commentId}`),
}

export const pollApi = {
  get:    (dreamId: string) => api.get<DreamPoll | null>(`/dreams/${dreamId}/poll`),
  create: (dreamId: string, data: { question: string; options: string[] }) =>
    api.post<DreamPoll>(`/dreams/${dreamId}/poll`, data),
  vote:   (dreamId: string, optionIndex: number) =>
    api.post(`/dreams/${dreamId}/poll/vote`, { option_index: optionIndex }),
  unvote: (dreamId: string) => api.delete(`/dreams/${dreamId}/poll/vote`),
}

// ── Stats ────────────────────────────────────────────────────
export const statsApi = {
  get: () => api.get<Stats>('/stats'),
}

// ── Coincidencias ─────────────────────────────────────────────
export const coincidencesApi = {
  list: () => api.get<import('../types').Coincidence[]>('/coincidences'),
  accept: (id: string) => api.post(`/coincidences/${id}/accept`),
  dismiss: (id: string) => api.post(`/coincidences/${id}/dismiss`),
}

// ── Push notifications ────────────────────────────────────────
export const pushApi = {
  subscribe:   (sub: unknown) => api.post('/notifications/subscribe', sub),
  unsubscribe: ()              => api.delete('/notifications/subscribe'),
}

// ── User ─────────────────────────────────────────────────────
export const userApi = {
  updateProfile: (data: Partial<User>) => api.patch<User>('/user/profile', data),
  export: () => api.get('/user/export', { responseType: 'blob' }),
  deleteAccount: () => api.delete('/user'),
  publicProfile: (id: string) => api.get<User>(`/user/${id}`),
}
