CREATE TABLE IF NOT EXISTS user_writing_profile (
  user_id UUID PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  sample_size INTEGER NOT NULL DEFAULT 0,
  reference_post_ids UUID[] NOT NULL DEFAULT '{}',
  profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_writing_profile_updated_at
ON user_writing_profile(updated_at DESC);
