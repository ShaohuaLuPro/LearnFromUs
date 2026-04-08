-- LearnFromUs forum schema (PostgreSQL / Neon)
-- Run with:
-- psql "postgresql://USER:PASSWORD@HOST/DB?sslmode=require" -f database/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  section TEXT NOT NULL DEFAULT 'sde-general',
  title TEXT NOT NULL CHECK (length(title) BETWEEN 4 AND 180),
  content_markdown TEXT NOT NULL CHECK (length(content_markdown) BETWEEN 10 AND 20000),
  slug TEXT NOT NULL UNIQUE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_by_admin_at TIMESTAMPTZ,
  deleted_by_admin_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  deleted_reason TEXT,
  appeal_requested_at TIMESTAMPTZ,
  appeal_note TEXT,
  permanent_deleted_at TIMESTAMPTZ,
  permanent_delete_note TEXT,
  restored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_appeal_message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  author_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('author', 'admin')),
  message TEXT NOT NULL CHECK (length(trim(message)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  section_scope TEXT[] NOT NULL DEFAULT '{}',
  show_code_block_tools BOOLEAN NOT NULL DEFAULT TRUE,
  owner_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  created_by_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  is_core BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE forum
ADD COLUMN IF NOT EXISTS show_code_block_tools BOOLEAN NOT NULL DEFAULT TRUE;

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

CREATE TABLE IF NOT EXISTS tag (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_tag (
  post_id UUID NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  content_markdown TEXT NOT NULL CHECK (length(content_markdown) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_vote (
  post_id UUID NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_bookmark (
  post_id UUID NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_like (
  post_id UUID NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_engagement (
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_view_count INTEGER NOT NULL DEFAULT 0 CHECK (total_view_count >= 0),
  total_dwell_time_ms BIGINT NOT NULL DEFAULT 0 CHECK (total_dwell_time_ms >= 0),
  average_dwell_time_ms BIGINT NOT NULL DEFAULT 0 CHECK (average_dwell_time_ms >= 0),
  repeated_visit_count INTEGER NOT NULL DEFAULT 0 CHECK (repeated_visit_count >= 0),
  last_dwell_time_ms INTEGER NOT NULL DEFAULT 0 CHECK (last_dwell_time_ms >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS user_tag_interest (
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  bookmark_count INTEGER NOT NULL DEFAULT 0 CHECK (bookmark_count >= 0),
  click_count INTEGER NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  repeat_visit_count INTEGER NOT NULL DEFAULT 0 CHECK (repeat_visit_count >= 0),
  dwell_time_ms BIGINT NOT NULL DEFAULT 0 CHECK (dwell_time_ms >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tag)
);

CREATE TABLE IF NOT EXISTS user_follow (
  follower_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS user_writing_profile (
  user_id UUID PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  sample_size INTEGER NOT NULL DEFAULT 0,
  reference_post_ids UUID[] NOT NULL DEFAULT '{}',
  profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_daily_usage (
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date),
  CHECK (usage_count >= 0)
);

CREATE TABLE IF NOT EXISTS media_asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  storage_provider TEXT NOT NULL DEFAULT 's3' CHECK (storage_provider IN ('s3')),
  bucket TEXT NOT NULL,
  region TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  original_file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'failed', 'deleted')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  etag TEXT,
  uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_author_created ON post(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_appeal_message_post_created ON post_appeal_message(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_post_created ON post(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_deleted_by_admin_at ON post(deleted_by_admin_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_forum_created ON post(forum_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_permanent_deleted_at ON post(permanent_deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_post_created ON comment(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vote_post ON post_vote(post_id);
CREATE INDEX IF NOT EXISTS idx_post_like_user_created ON post_like(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_like_post_created ON post_like(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_bookmark_user_created ON post_bookmark(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_bookmark_post_created ON post_bookmark(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_engagement_post_updated ON post_engagement(post_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_engagement_user_updated ON post_engagement(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_owner_created ON forum(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_request_requester_created ON forum_request(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_request_status_created ON forum_request(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_follow_following ON user_follow(following_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_writing_profile_updated_at ON user_writing_profile(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_daily_usage_usage_date ON ai_daily_usage(usage_date DESC, usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_media_asset_owner_created ON media_asset(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_asset_status_created ON media_asset(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_tag_interest_user_score ON user_tag_interest(user_id, score DESC, updated_at DESC);
