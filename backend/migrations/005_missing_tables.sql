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

ALTER TABLE coincidences ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "coincidences_read" ON coincidences FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM dreams d WHERE d.id = dream_a_id AND d.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM dreams d WHERE d.id = dream_b_id AND d.user_id = auth.uid())
  );
CREATE POLICY IF NOT EXISTS "coincidences_update" ON coincidences FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM dreams d WHERE d.id = dream_a_id AND d.user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM dreams d WHERE d.id = dream_b_id AND d.user_id = auth.uid())
  );

-- ─── DREAM POLLS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dream_polls (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dream_id   UUID UNIQUE NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
  question   TEXT NOT NULL,
  options    JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dream_polls_dream ON dream_polls(dream_id);

ALTER TABLE dream_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "dream_polls_read" ON dream_polls FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "dream_polls_insert" ON dream_polls FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM dreams d WHERE d.id = dream_id AND d.user_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "dream_polls_update" ON dream_polls FOR UPDATE
  USING (EXISTS (SELECT 1 FROM dreams d WHERE d.id = dream_id AND d.user_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "dream_polls_delete" ON dream_polls FOR DELETE
  USING (EXISTS (SELECT 1 FROM dreams d WHERE d.id = dream_id AND d.user_id = auth.uid()));

-- ─── DREAM POLL VOTES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dream_poll_votes (
  poll_id      UUID NOT NULL REFERENCES dream_polls(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_dream_poll_votes_poll ON dream_poll_votes(poll_id);

ALTER TABLE dream_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "dream_poll_votes_read" ON dream_poll_votes FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "dream_poll_votes_insert" ON dream_poll_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "dream_poll_votes_update" ON dream_poll_votes FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "dream_poll_votes_delete" ON dream_poll_votes FOR DELETE
  USING (auth.uid() = user_id);
