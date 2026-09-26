-- Add theme_id to profiles for persistent theme preference per user
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme_id TEXT
  CHECK (theme_id IN ('cosmos', 'abismo', 'selva', 'petalo'));
