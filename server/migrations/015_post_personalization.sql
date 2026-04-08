CREATE TABLE IF NOT EXISTS post_like (
  post_id UUID NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_bookmark (
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

CREATE INDEX IF NOT EXISTS idx_post_like_user_created ON post_like(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_like_post_created ON post_like(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_bookmark_user_created ON post_bookmark(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_bookmark_post_created ON post_bookmark(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_engagement_post_updated ON post_engagement(post_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_engagement_user_updated ON post_engagement(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_tag_interest_user_score ON user_tag_interest(user_id, score DESC, updated_at DESC);
