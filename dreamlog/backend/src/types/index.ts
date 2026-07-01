export type Visibility = 'private' | 'friends' | 'public'
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked'
export type CoincidenceStatus = 'suggested' | 'accepted' | 'dismissed'
export type CoincidenceScope = 'friends' | 'public'

export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  bio: string | null
  email_verified: boolean
  default_visibility: Visibility
  deleted_at: Date | null
  created_at: Date
}

export interface Dream {
  id: string
  user_id: string
  title: string | null
  body: string
  dream_date: string
  visibility: Visibility
  is_lucid: boolean
  sleep_quality: number | null
  tags: string[]
  emotions: string[]
  embedding_model: string | null
  created_at: Date
  updated_at: Date
}

export interface DreamAnalysis {
  id: string
  dream_id: string
  summary: string | null
  themes: string[]
  symbols: string[]
  emotional_tone: string | null
  interpretations: { text: string; confidence: number }[]
  model_id: string | null
  created_at: Date
}

export interface Friendship {
  requester_id: string
  addressee_id: string
  status: FriendshipStatus
  created_at: Date
  updated_at: Date
}

export interface Coincidence {
  id: string
  dream_a_id: string
  dream_b_id: string
  score: number
  scope: CoincidenceScope
  status: CoincidenceStatus
  accepted_a: boolean
  accepted_b: boolean
  created_at: Date
}

// Express request augmentation
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string }
    }
  }
}
