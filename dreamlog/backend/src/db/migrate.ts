import { pool } from './client.js'

// Run this SQL directly in Supabase SQL Editor, or via npm run db:migrate
const MIGRATION = /* sql */ `
-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── USERS (mirrors Supabase auth.users) ─────────────────────
-- We store extra profile data here, linked to auth.users.id
CREATE TABLE IF NOT EXISTS profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL DEFAULT '',
  avatar_url         TEXT,
  bio                TEXT,
  default_visibility TEXT NOT NULL DEFAULT 'private'
                     CHECK (default_visibility IN ('private','friends','public')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── FRIENDSHIPS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friendships (
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','blocked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);

-- ─── DREAMS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dreams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT,
  body            TEXT NOT NULL,
  dream_date      DATE NOT NULL,
  visibility      TEXT NOT NULL DEFAULT 'private'
                  CHECK (visibility IN ('private','friends','public')),
  is_lucid        BOOLEAN NOT NULL DEFAULT FALSE,
  sleep_quality   SMALLINT CHECK (sleep_quality BETWEEN 1 AND 5),
  tags            TEXT[] NOT NULL DEFAULT '{}',
  emotions        TEXT[] NOT NULL DEFAULT '{}',
  embedding       vector(384),          -- HuggingFace all-MiniLM-L6-v2 = 384 dims
  embedding_model TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dreams_user ON dreams(user_id);
CREATE INDEX IF NOT EXISTS idx_dreams_date ON dreams(dream_date DESC);
CREATE INDEX IF NOT EXISTS idx_dreams_embedding
  ON dreams USING hnsw (embedding vector_cosine_ops)
  WHERE visibility != 'private' AND embedding IS NOT NULL;

-- ─── DREAM ANALYSES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dream_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dream_id        UUID UNIQUE NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
  summary         TEXT,
  themes          TEXT[] NOT NULL DEFAULT '{}',
  symbols         TEXT[] NOT NULL DEFAULT '{}',
  emotional_tone  TEXT,
  interpretations JSONB NOT NULL DEFAULT '[]',
  model_id        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── COINCIDENCES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coincidences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dream_a_id  UUID NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
  dream_b_id  UUID NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
  score       FLOAT NOT NULL CHECK (score BETWEEN 0 AND 1),
  scope       TEXT NOT NULL CHECK (scope IN ('friends','public')),
  status      TEXT NOT NULL DEFAULT 'suggested'
              CHECK (status IN ('suggested','accepted','dismissed')),
  accepted_a  BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_b  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dream_a_id, dream_b_id),
  CHECK (dream_a_id < dream_b_id)
);
CREATE INDEX IF NOT EXISTS idx_coincidences_a ON coincidences(dream_a_id);
CREATE INDEX IF NOT EXISTS idx_coincidences_b ON coincidences(dream_b_id);

-- ─── REPORTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  dream_id    UUID NOT NULL REFERENCES dreams(id),
  reason      TEXT NOT NULL,
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, dream_id)
);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE dreams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE coincidences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports       ENABLE ROW LEVEL SECURITY;

-- profiles: anyone can read, only owner can update
CREATE POLICY "profiles_read"   ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- friendships: involved parties can read
CREATE POLICY "friendships_read" ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships_insert" ON friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "friendships_update" ON friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "friendships_delete" ON friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- dreams: visibility-based access
CREATE POLICY "dreams_own" ON dreams FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "dreams_friends_read" ON dreams FOR SELECT
  USING (
    visibility IN ('friends','public')
    AND EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.addressee_id = user_id)
          OR (f.requester_id = user_id AND f.addressee_id = auth.uid()))
    )
  );

CREATE POLICY "dreams_public_read" ON dreams FOR SELECT
  USING (visibility = 'public' AND auth.uid() IS NOT NULL);

-- analyses: readable if you can read the dream
CREATE POLICY "analyses_read" ON dream_analyses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dreams d WHERE d.id = dream_id AND d.user_id = auth.uid()
    )
  );
CREATE POLICY "analyses_insert" ON dream_analyses FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM dreams d WHERE d.id = dream_id AND d.user_id = auth.uid())
  );
CREATE POLICY "analyses_delete" ON dream_analyses FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM dreams d WHERE d.id = dream_id AND d.user_id = auth.uid())
  );

-- coincidences: only parties involved
CREATE POLICY "coincidences_read" ON coincidences FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM dreams d WHERE d.id = dream_a_id AND d.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM dreams d WHERE d.id = dream_b_id AND d.user_id = auth.uid())
  );
CREATE POLICY "coincidences_update" ON coincidences FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM dreams d WHERE d.id = dream_a_id AND d.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM dreams d WHERE d.id = dream_b_id AND d.user_id = auth.uid())
  );
`

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('Running migrations…')
    await client.query(MIGRATION)
    console.log('Migrations complete.')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
