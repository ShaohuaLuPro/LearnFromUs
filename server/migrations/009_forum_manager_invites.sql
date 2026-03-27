CREATE TABLE IF NOT EXISTS forum_manager_invite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forum_id UUID NOT NULL REFERENCES forum(id) ON DELETE CASCADE,
  invitee_user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  invited_by_id UUID REFERENCES app_user(id) ON DELETE SET NULL,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_forum_manager_invite_pending_unique
ON forum_manager_invite(forum_id, invitee_user_id)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_forum_manager_invite_invitee_status
ON forum_manager_invite(invitee_user_id, status, created_at DESC);
