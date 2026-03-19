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
  restored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_post_author_created ON post(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_created ON post(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_deleted_by_admin_at ON post(deleted_by_admin_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_post_created ON comment(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vote_post ON post_vote(post_id);
CREATE INDEX IF NOT EXISTS idx_user_follow_following ON user_follow(following_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_writing_profile_updated_at ON user_writing_profile(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_daily_usage_usage_date ON ai_daily_usage(usage_date DESC, usage_count DESC);
