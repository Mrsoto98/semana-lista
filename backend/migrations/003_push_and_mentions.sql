-- Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Dream mentions (friend tagging)
CREATE TABLE IF NOT EXISTS dream_mentions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dream_id           uuid NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
  mentioned_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at         timestamptz DEFAULT now(),
  UNIQUE(dream_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_dream_mentions_mentioned ON dream_mentions(mentioned_user_id);
