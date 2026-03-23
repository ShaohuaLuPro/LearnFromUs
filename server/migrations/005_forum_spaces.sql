CREATE TABLE IF NOT EXISTS forum (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  section_scope TEXT[] NOT NULL DEFAULT '{}',
  owner_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  created_by_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  is_core BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  forum_id UUID REFERENCES forum(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  section_scope TEXT[] NOT NULL DEFAULT '{}',
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE post
ADD COLUMN IF NOT EXISTS forum_id UUID REFERENCES forum(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_forum_owner_created
ON forum(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forum_request_requester_created
ON forum_request(requester_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forum_request_status_created
ON forum_request(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_forum_created
ON post(forum_id, created_at DESC);
