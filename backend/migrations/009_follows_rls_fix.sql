-- ─── FOLLOWS TABLE ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_read"   ON follows;
CREATE POLICY "follows_read" ON follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "follows_insert" ON follows;
CREATE POLICY "follows_insert" ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "follows_delete" ON follows;
CREATE POLICY "follows_delete" ON follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ─── FOLLOWER / FOLLOWING COUNT COLUMNS ──────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS followers_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count INTEGER NOT NULL DEFAULT 0;

-- Backfill current counts from existing follows rows (safe if table was just created)
UPDATE profiles p
SET
  followers_count = (SELECT COUNT(*) FROM follows f WHERE f.following_id = p.id),
  following_count = (SELECT COUNT(*) FROM follows f WHERE f.follower_id  = p.id);

-- Trigger: keep counts accurate on INSERT/DELETE in follows
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
    UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_follow_counts ON follows;
CREATE TRIGGER trg_follow_counts
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- ─── FIX birth_visibility: add 'date_age' to constraint ─────────────────────
DO $$
DECLARE c_name TEXT;
BEGIN
  SELECT con.conname INTO c_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'profiles' AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%birth_visibility%'
  LIMIT 1;
  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', c_name);
  END IF;
END;
$$;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_birth_visibility_check
  CHECK (birth_visibility IN ('date', 'age', 'date_age', 'none'));

-- ─── FIX RLS: dream_likes ── include 'friends' visibility ────────────────────
DROP POLICY IF EXISTS "dream_likes_read" ON dream_likes;
CREATE POLICY "dream_likes_read" ON dream_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dreams d
      WHERE d.id = dream_id
        AND (
          d.visibility = 'public'
          OR d.user_id = auth.uid()
          OR (
            d.visibility = 'friends'
            AND EXISTS (
              SELECT 1 FROM friendships f
              WHERE f.status = 'accepted'
                AND (
                  (f.requester_id = auth.uid() AND f.addressee_id = d.user_id)
                  OR (f.requester_id = d.user_id AND f.addressee_id = auth.uid())
                )
            )
          )
        )
    )
  );

-- ─── FIX RLS: dream_comments ── include 'friends' visibility ─────────────────
DROP POLICY IF EXISTS "dream_comments_read" ON dream_comments;
CREATE POLICY "dream_comments_read" ON dream_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dreams d
      WHERE d.id = dream_id
        AND (
          d.visibility = 'public'
          OR d.user_id = auth.uid()
          OR (
            d.visibility = 'friends'
            AND EXISTS (
              SELECT 1 FROM friendships f
              WHERE f.status = 'accepted'
                AND (
                  (f.requester_id = auth.uid() AND f.addressee_id = d.user_id)
                  OR (f.requester_id = d.user_id AND f.addressee_id = auth.uid())
                )
            )
          )
        )
    )
  );
