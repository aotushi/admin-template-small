-- 015_seed_frontend_demo_users.sql
-- Align local/frontend demo login accounts.
-- Password for all demo accounts: 123456

-- Keep the original seeded super-admin identity but rename it to the
-- frontend's Super quick-login account when the new account does not exist.
UPDATE users
SET
  username = 'vben',
  password = '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y',
  role = 'admin',
  email = 'vben@example.com',
  admin_level = 'super',
  created_by = NULL,
  updated_at = CURRENT_TIMESTAMP
WHERE username = 'admin'
  AND NOT EXISTS (SELECT 1 FROM users WHERE username = 'vben');

INSERT INTO users (username, password, role, email, admin_level, created_by)
SELECT
  'vben',
  '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y',
  'admin',
  'vben@example.com',
  'super',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'vben');

UPDATE users
SET
  password = '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y',
  role = 'admin',
  email = 'vben@example.com',
  admin_level = 'super',
  created_by = NULL,
  updated_at = CURRENT_TIMESTAMP
WHERE username = 'vben';

INSERT INTO users (username, password, role, email, admin_level, created_by)
SELECT
  'admin',
  '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y',
  'admin',
  'admin@example.com',
  'sub',
  (SELECT id FROM users WHERE username = 'vben')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

UPDATE users
SET
  password = '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y',
  role = 'admin',
  email = 'admin@example.com',
  admin_level = 'sub',
  created_by = (SELECT id FROM users WHERE username = 'vben'),
  updated_at = CURRENT_TIMESTAMP
WHERE username = 'admin';

INSERT INTO users (username, password, role, email, admin_level, created_by)
SELECT
  'jack',
  '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y',
  'user',
  'jack@example.com',
  NULL,
  (SELECT id FROM users WHERE username = 'admin')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'jack');

UPDATE users
SET
  password = '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y',
  role = 'user',
  email = 'jack@example.com',
  admin_level = NULL,
  created_by = (SELECT id FROM users WHERE username = 'admin'),
  updated_at = CURRENT_TIMESTAMP
WHERE username = 'jack';

SELECT id, username, role, email, admin_level, created_by
FROM users
WHERE username IN ('vben', 'admin', 'jack')
ORDER BY
  CASE username
    WHEN 'vben' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'jack' THEN 3
  END;
