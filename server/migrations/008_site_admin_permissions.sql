CREATE TABLE IF NOT EXISTS site_admin_access (
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  granted_by_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

CREATE INDEX IF NOT EXISTS idx_site_admin_access_updated
ON site_admin_access(updated_at DESC);
