CREATE TABLE IF NOT EXISTS forum_follow (
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  forum_id UUID NOT NULL REFERENCES forum(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, forum_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_follow_forum_created
ON forum_follow(forum_id, created_at DESC);
