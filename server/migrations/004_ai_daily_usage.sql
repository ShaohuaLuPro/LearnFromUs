CREATE TABLE IF NOT EXISTS ai_daily_usage (
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date),
  CHECK (usage_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ai_daily_usage_usage_date
ON ai_daily_usage(usage_date DESC, usage_count DESC);
