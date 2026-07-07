-- 001_add_admin_hierarchy.sql
-- 添加管理员层级支持

-- 1. 添加管理员层级字段
ALTER TABLE users ADD COLUMN admin_level TEXT;
-- 取值: 'super' | 'sub' | NULL

-- 2. 添加创建者关联字段
ALTER TABLE users ADD COLUMN created_by INTEGER;
-- 记录是哪个用户创建的此用户

-- 3. 将现有的 admin 用户设置为 super 级别
UPDATE users SET admin_level = 'super' WHERE role = 'admin';

-- 4. 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_users_admin_level ON users(admin_level);
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by);

-- 5. 验证迁移结果
SELECT
  id,
  username,
  role,
  admin_level,
  created_by,
  created_at
FROM users
LIMIT 5;
