CREATE TABLE IF NOT EXISTS forum_manager (
  forum_id UUID NOT NULL REFERENCES forum(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  granted_by_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (forum_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_manager_user_updated
ON forum_manager(user_id, updated_at DESC);
