-- Add model_id column to dream_analyses if it doesn't exist
ALTER TABLE dream_analyses ADD COLUMN IF NOT EXISTS model_id TEXT;
