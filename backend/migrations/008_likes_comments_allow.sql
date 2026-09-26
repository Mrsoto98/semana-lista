-- ─── ALLOW COMMENTS COLUMN ON DREAMS ─────────────────────────
ALTER TABLE dreams
  ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── DREAM LIKES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dream_likes (
  dream_id   UUID NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dream_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_dream_likes_dream ON dream_likes(dream_id);
CREATE INDEX IF NOT EXISTS idx_dream_likes_user  ON dream_likes(user_id);

ALTER TABLE dream_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dream_likes_read"   ON dream_likes;
CREATE POLICY "dream_likes_read" ON dream_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dreams d
      WHERE d.id = dream_id
        AND (d.visibility = 'public' OR d.user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "dream_likes_insert" ON dream_likes;
CREATE POLICY "dream_likes_insert" ON dream_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "dream_likes_delete" ON dream_likes;
CREATE POLICY "dream_likes_delete" ON dream_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── DREAM COMMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dream_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dream_id          UUID NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body              TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  parent_comment_id UUID REFERENCES dream_comments(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dream_comments_dream ON dream_comments(dream_id);
CREATE INDEX IF NOT EXISTS idx_dream_comments_user  ON dream_comments(user_id);

ALTER TABLE dream_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dream_comments_read"   ON dream_comments;
CREATE POLICY "dream_comments_read" ON dream_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dreams d
      WHERE d.id = dream_id
        AND (d.visibility = 'public' OR d.user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "dream_comments_insert" ON dream_comments;
CREATE POLICY "dream_comments_insert" ON dream_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM dreams d
      WHERE d.id = dream_id AND d.allow_comments = TRUE
    )
  );
DROP POLICY IF EXISTS "dream_comments_delete" ON dream_comments;
CREATE POLICY "dream_comments_delete" ON dream_comments FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM dreams d WHERE d.id = dream_id AND d.user_id = auth.uid())
  );

-- ─── MISSING PROFILE COLUMNS ─────────────────────────────────
-- Safe to run multiple times: ADD COLUMN IF NOT EXISTS is a no-op when column exists.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_emoji       TEXT,
  ADD COLUMN IF NOT EXISTS instagram_username TEXT,
  ADD COLUMN IF NOT EXISTS user_number        INTEGER,
  ADD COLUMN IF NOT EXISTS onboarding_done    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS birth_date         DATE,
  ADD COLUMN IF NOT EXISTS is_verified        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS show_zodiac        BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_public_stats  BOOLEAN DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_number
  ON profiles(user_number) WHERE user_number IS NOT NULL;
