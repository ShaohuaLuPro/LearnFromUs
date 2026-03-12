CREATE TABLE IF NOT EXISTS user_follow (
  follower_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follow_following
ON user_follow(following_id, created_at DESC);

ALTER TABLE post
ADD COLUMN IF NOT EXISTS deleted_by_admin_at TIMESTAMPTZ;

ALTER TABLE post
ADD COLUMN IF NOT EXISTS deleted_by_admin_id UUID REFERENCES app_user(id) ON DELETE SET NULL;

ALTER TABLE post
ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

ALTER TABLE post
ADD COLUMN IF NOT EXISTS appeal_requested_at TIMESTAMPTZ;

ALTER TABLE post
ADD COLUMN IF NOT EXISTS appeal_note TEXT;

ALTER TABLE post
ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_post_deleted_by_admin_at
ON post(deleted_by_admin_at DESC);
