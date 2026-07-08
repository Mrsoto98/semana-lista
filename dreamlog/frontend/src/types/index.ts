export type Visibility = 'private' | 'friends' | 'public'
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked'
export type CoincidenceStatus = 'suggested' | 'accepted' | 'dismissed'

export interface User {
  id: string
  email: string
  name: string
  avatar_url: string | null
  avatar_emoji: string | null
  bio: string | null
  email_verified: boolean
  default_visibility: Visibility
  user_number: number | null
  birth_date: string | null
  birth_visibility: 'date' | 'age' | 'none'
  onboarding_done: boolean
  instagram_username: string | null
  created_at: string
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
  allow_comments: boolean
  created_at: string
  updated_at: string
  // joined from dream_analyses
  summary?: string | null
  themes?: string[]
  symbols?: string[]
  emotional_tone?: string | null
  interpretations?: { text: string; confidence: number }[]
  // engagement
  like_count?: number
  comment_count?: number
}

export interface DreamComment {
  id: string
  body: string
  created_at: string
  user_id: string
  user_name: string
  user_avatar: string | null
  parent_comment_id: string | null
}

export interface DreamPoll {
  id: string
  dream_id: string
  question: string
  options: string[]
  created_at: string
  vote_counts: number[]
  total_votes: number
  user_vote: number | null
}

export interface FeedDream extends Dream {
  author_id: string
  author_name: string
  author_avatar: string | null
  like_count: number
  user_liked: boolean
  comment_count: number
}

export interface DreamAnalysis {
  id: string
  dream_id: string
  summary: string
  themes: string[]
  symbols: string[]
  emotional_tone: string
  interpretations: { text: string; confidence: number }[]
  model_id: string
  created_at: string
  cached?: boolean
}

export interface Friend {
  id: string
  name: string
  avatar_url: string | null
  bio: string | null
  status: FriendshipStatus
  direction: 'sent' | 'received'
}

export interface Coincidence {
  id: string
  score: number
  scope: 'friends' | 'public'
  status: CoincidenceStatus
  accepted_a: boolean
  accepted_b: boolean
  created_at: string
  // my dream
  my_dream_id: string
  my_dream_title: string | null
  my_dream_date: string
  my_dream_tags: string[]
  // their dream
  their_dream_id: string
  their_dream_date: string
  their_dream_tags: string[]
  their_dream_title: string | null
  // author (may be anonymized)
  their_user_id: string | null
  their_user_name: string
  their_avatar: string | null
  i_accepted: boolean
}

export interface Stats {
  totals: { total: string; lucid: string; avg_quality: string }
  lucidRatio: string
  streak: number
  byVisibility: { visibility: Visibility; count: string }[]
  byMonth: { month: string; count: string }[]
  byWeekday: { dow: number; count: string }[]
  topEmotions: { emotion: string; count: string }[]
  topTags: { tag: string; count: string }[]
  topSymbols: { symbol: string; count: string }[]
}
