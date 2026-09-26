-- Add @username field to profiles: unique handle for each user
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE profiles
  ADD CONSTRAINT IF NOT EXISTS profiles_username_key UNIQUE (username);

ALTER TABLE profiles
  ADD CONSTRAINT IF NOT EXISTS profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,30}$');
