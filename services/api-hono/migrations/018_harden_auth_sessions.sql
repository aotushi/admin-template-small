-- Add account availability and an absolute refresh-session lifetime.

ALTER TABLE users
  ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_users_is_active
  ON users(is_active);

ALTER TABLE refresh_sessions
  ADD COLUMN absolute_expires_at INTEGER NOT NULL DEFAULT 0;

-- Existing sessions keep their current expiry as their absolute limit.
UPDATE refresh_sessions
SET absolute_expires_at = expires_at
WHERE absolute_expires_at = 0;

CREATE INDEX IF NOT EXISTS idx_refresh_sessions_absolute_expires_at
  ON refresh_sessions(absolute_expires_at);
