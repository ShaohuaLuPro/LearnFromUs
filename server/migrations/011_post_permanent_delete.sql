ALTER TABLE post
ADD COLUMN IF NOT EXISTS permanent_deleted_at TIMESTAMPTZ;

ALTER TABLE post
ADD COLUMN IF NOT EXISTS permanent_delete_note TEXT;

CREATE INDEX IF NOT EXISTS idx_post_permanent_deleted_at
  ON post(permanent_deleted_at DESC);
