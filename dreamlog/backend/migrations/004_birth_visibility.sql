-- Add birth_visibility preference to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS birth_visibility text NOT NULL DEFAULT 'age'
  CHECK (birth_visibility IN ('date', 'age', 'none'));
