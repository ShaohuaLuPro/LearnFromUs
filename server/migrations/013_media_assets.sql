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

CREATE INDEX IF NOT EXISTS idx_media_asset_owner_created
  ON media_asset(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_asset_status_created
  ON media_asset(status, created_at DESC);
