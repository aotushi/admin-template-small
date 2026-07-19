-- 022: 退役 users.role / users.admin_level，角色归属唯一来源切换为 user_roles 表
-- 前置：迁移 019 已按归一规则回填 user_roles；此处先兜底补齐缺失绑定再删列

-- 1. 兜底回填：还没有任何角色绑定的用户，按旧列归一规则补一条
INSERT OR IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = CASE
  WHEN u.role = 'admin' AND u.admin_level = 'super' THEN 'super'
  WHEN u.role = 'admin' THEN 'admin'
  ELSE 'user'
END
WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id);

-- 2. 删除引用旧列的索引（DROP COLUMN 前必须先删）
DROP INDEX IF EXISTS idx_users_super_admin;

-- 3. 删列
ALTER TABLE users DROP COLUMN admin_level;
ALTER TABLE users DROP COLUMN role;
