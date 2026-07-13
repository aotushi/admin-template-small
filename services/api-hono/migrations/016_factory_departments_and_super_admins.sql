-- 016_factory_departments_and_super_admins.sql
-- Add a factory organization tree and support multiple super administrators.

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES departments(id) ON DELETE RESTRICT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_departments_parent_id
  ON departments(parent_id);
CREATE INDEX IF NOT EXISTS idx_departments_sort_order
  ON departments(sort_order);

ALTER TABLE users
  ADD COLUMN department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE users
  ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_users_department_id
  ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_super_admin
  ON users(role, admin_level);

INSERT OR IGNORE INTO departments (code, name, sort_order)
VALUES
  ('finance', '财务部', 10),
  ('sales', '销售部', 20),
  ('workshop', '生产车间', 30),
  ('public-relations', '公关部', 40),
  ('technology', '技术部', 50);

INSERT OR IGNORE INTO departments (parent_id, code, name, sort_order)
VALUES
  ((SELECT id FROM departments WHERE code = 'finance'), 'finance-accounting', '会计核算组', 10),
  ((SELECT id FROM departments WHERE code = 'finance'), 'finance-cost', '成本控制组', 20),
  ((SELECT id FROM departments WHERE code = 'finance'), 'finance-treasury', '资金结算组', 30),
  ((SELECT id FROM departments WHERE code = 'finance'), 'finance-tax', '税务管理组', 40),
  ((SELECT id FROM departments WHERE code = 'sales'), 'sales-domestic', '国内销售组', 10),
  ((SELECT id FROM departments WHERE code = 'sales'), 'sales-overseas', '海外销售组', 20),
  ((SELECT id FROM departments WHERE code = 'sales'), 'sales-channel', '渠道管理组', 30),
  ((SELECT id FROM departments WHERE code = 'sales'), 'sales-service', '客户服务组', 40),
  ((SELECT id FROM departments WHERE code = 'workshop'), 'workshop-assembly-a', '装配一车间', 10),
  ((SELECT id FROM departments WHERE code = 'workshop'), 'workshop-assembly-b', '装配二车间', 20),
  ((SELECT id FROM departments WHERE code = 'workshop'), 'workshop-quality', '质量检验组', 30),
  ((SELECT id FROM departments WHERE code = 'workshop'), 'workshop-maintenance', '设备维护组', 40),
  ((SELECT id FROM departments WHERE code = 'public-relations'), 'pr-brand', '品牌传播组', 10),
  ((SELECT id FROM departments WHERE code = 'public-relations'), 'pr-media', '媒体关系组', 20),
  ((SELECT id FROM departments WHERE code = 'public-relations'), 'pr-government', '政府事务组', 30),
  ((SELECT id FROM departments WHERE code = 'technology'), 'tech-research', '产品研发组', 10),
  ((SELECT id FROM departments WHERE code = 'technology'), 'tech-process', '工艺工程组', 20),
  ((SELECT id FROM departments WHERE code = 'technology'), 'tech-operations', '信息化运维组', 30),
  ((SELECT id FROM departments WHERE code = 'technology'), 'tech-support', '技术支持组', 40);

-- The bootstrap account is protected and reserved for emergency recovery.
UPDATE users
SET
  role = 'admin',
  admin_level = 'super',
  department_id = NULL,
  is_system = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE username = 'vben';

-- All seeded accounts use password 123456 for local development only.
INSERT INTO users (
  username, password, role, email, admin_level, created_by, department_id, is_system
)
VALUES (
  'factory.director',
  '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y',
  'admin',
  'factory.director@example.com',
  'super',
  (SELECT id FROM users WHERE username = 'vben'),
  NULL,
  0
)
ON CONFLICT(username) DO UPDATE SET
  password = excluded.password,
  role = excluded.role,
  email = excluded.email,
  admin_level = excluded.admin_level,
  created_by = excluded.created_by,
  department_id = excluded.department_id,
  is_system = excluded.is_system,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO users (
  username, password, role, email, admin_level, created_by, department_id, is_system
)
VALUES
  ('finance.accounting', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'admin', 'finance.accounting@example.com', 'sub', (SELECT id FROM users WHERE username = 'factory.director'), (SELECT id FROM departments WHERE code = 'finance-accounting'), 0),
  ('sales.domestic', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'admin', 'sales.domestic@example.com', 'sub', (SELECT id FROM users WHERE username = 'factory.director'), (SELECT id FROM departments WHERE code = 'sales-domestic'), 0),
  ('workshop.assembly', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'admin', 'workshop.assembly@example.com', 'sub', (SELECT id FROM users WHERE username = 'factory.director'), (SELECT id FROM departments WHERE code = 'workshop-assembly-a'), 0),
  ('pr.brand', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'admin', 'pr.brand@example.com', 'sub', (SELECT id FROM users WHERE username = 'factory.director'), (SELECT id FROM departments WHERE code = 'pr-brand'), 0),
  ('tech.research', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'admin', 'tech.research@example.com', 'sub', (SELECT id FROM users WHERE username = 'factory.director'), (SELECT id FROM departments WHERE code = 'tech-research'), 0)
ON CONFLICT(username) DO UPDATE SET
  password = excluded.password,
  role = excluded.role,
  email = excluded.email,
  admin_level = excluded.admin_level,
  created_by = excluded.created_by,
  department_id = excluded.department_id,
  is_system = excluded.is_system,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO users (
  username, password, role, email, admin_level, created_by, department_id, is_system
)
VALUES
  ('finance.cost', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'user', 'finance.cost@example.com', NULL, (SELECT id FROM users WHERE username = 'finance.accounting'), (SELECT id FROM departments WHERE code = 'finance-cost'), 0),
  ('finance.treasury', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'user', 'finance.treasury@example.com', NULL, (SELECT id FROM users WHERE username = 'finance.accounting'), (SELECT id FROM departments WHERE code = 'finance-treasury'), 0),
  ('finance.tax', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'user', 'finance.tax@example.com', NULL, (SELECT id FROM users WHERE username = 'finance.accounting'), (SELECT id FROM departments WHERE code = 'finance-tax'), 0),
  ('sales.overseas', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'user', 'sales.overseas@example.com', NULL, (SELECT id FROM users WHERE username = 'sales.domestic'), (SELECT id FROM departments WHERE code = 'sales-overseas'), 0),
  ('sales.channel', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'user', 'sales.channel@example.com', NULL, (SELECT id FROM users WHERE username = 'sales.domestic'), (SELECT id FROM departments WHERE code = 'sales-channel'), 0),
  ('workshop.assembly-b', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'user', 'workshop.assembly-b@example.com', NULL, (SELECT id FROM users WHERE username = 'workshop.assembly'), (SELECT id FROM departments WHERE code = 'workshop-assembly-b'), 0),
  ('workshop.quality', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'user', 'workshop.quality@example.com', NULL, (SELECT id FROM users WHERE username = 'workshop.assembly'), (SELECT id FROM departments WHERE code = 'workshop-quality'), 0),
  ('workshop.maintenance', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'user', 'workshop.maintenance@example.com', NULL, (SELECT id FROM users WHERE username = 'workshop.assembly'), (SELECT id FROM departments WHERE code = 'workshop-maintenance'), 0),
  ('pr.media', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'user', 'pr.media@example.com', NULL, (SELECT id FROM users WHERE username = 'pr.brand'), (SELECT id FROM departments WHERE code = 'pr-media'), 0),
  ('pr.government', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'user', 'pr.government@example.com', NULL, (SELECT id FROM users WHERE username = 'pr.brand'), (SELECT id FROM departments WHERE code = 'pr-government'), 0),
  ('tech.process', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'user', 'tech.process@example.com', NULL, (SELECT id FROM users WHERE username = 'tech.research'), (SELECT id FROM departments WHERE code = 'tech-process'), 0),
  ('tech.support', '$2a$10$KhI0kTgxGGrgksnwa9O8u.oLxYBFGiz7Cf8vQ4VSlwFG03gFiKu2y', 'user', 'tech.support@example.com', NULL, (SELECT id FROM users WHERE username = 'tech.research'), (SELECT id FROM departments WHERE code = 'tech-support'), 0)
ON CONFLICT(username) DO UPDATE SET
  password = excluded.password,
  role = excluded.role,
  email = excluded.email,
  admin_level = excluded.admin_level,
  created_by = excluded.created_by,
  department_id = excluded.department_id,
  is_system = excluded.is_system,
  updated_at = CURRENT_TIMESTAMP;

UPDATE users
SET
  role = 'admin',
  admin_level = 'sub',
  department_id = (SELECT id FROM departments WHERE code = 'tech-operations'),
  created_by = (SELECT id FROM users WHERE username = 'factory.director'),
  is_system = 0,
  updated_at = CURRENT_TIMESTAMP
WHERE username = 'admin';

UPDATE users
SET
  role = 'user',
  admin_level = NULL,
  department_id = (SELECT id FROM departments WHERE code = 'sales-service'),
  created_by = (SELECT id FROM users WHERE username = 'sales.domestic'),
  is_system = 0,
  updated_at = CURRENT_TIMESTAMP
WHERE username = 'jack';

