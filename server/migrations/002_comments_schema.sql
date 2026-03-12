CREATE TABLE IF NOT EXISTS comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  content_markdown TEXT NOT NULL CHECK (length(content_markdown) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_post_created
ON comment(post_id, created_at DESC);
