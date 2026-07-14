-- 017_create_refresh_sessions.sql
-- Store hashed, rotating browser refresh sessions. Raw refresh credentials
-- exist only in the HttpOnly cookie issued to the browser.

CREATE TABLE IF NOT EXISTS refresh_sessions (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  parent_id TEXT REFERENCES refresh_sessions(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  revoked_at INTEGER,
  replaced_by TEXT,
  revoke_reason TEXT,
  CHECK (length(token_hash) = 64),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_id
  ON refresh_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_sessions_family_id
  ON refresh_sessions(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_sessions_expires_at
  ON refresh_sessions(expires_at);

-- A rotated child may only be inserted after its parent has been atomically
-- marked as replaced by that exact child. This makes the D1 batch fail and
-- roll back if two requests attempt to rotate the same credential.
CREATE TRIGGER IF NOT EXISTS validate_refresh_session_rotation
BEFORE INSERT ON refresh_sessions
WHEN NEW.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM refresh_sessions
    WHERE id = NEW.parent_id
      AND replaced_by = NEW.id
      AND revoked_at IS NOT NULL
  )
BEGIN
  SELECT RAISE(ABORT, 'invalid refresh session rotation');
END;
