CREATE TABLE IF NOT EXISTS post_appeal_message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  author_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('author', 'admin')),
  message TEXT NOT NULL CHECK (length(trim(message)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_appeal_message_post_created
  ON post_appeal_message(post_id, created_at ASC);

INSERT INTO post_appeal_message (post_id, author_id, author_role, message, created_at)
SELECT p.id,
       p.author_id,
       'author',
       trim(p.appeal_note),
       COALESCE(p.appeal_requested_at, p.updated_at, p.created_at, NOW())
FROM post p
WHERE p.appeal_note IS NOT NULL
  AND length(trim(p.appeal_note)) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM post_appeal_message pam
    WHERE pam.post_id = p.id
      AND pam.author_role = 'author'
      AND pam.message = trim(p.appeal_note)
  );
