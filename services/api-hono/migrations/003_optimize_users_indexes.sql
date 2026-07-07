-- 优化用户表索引以提升登录性能
-- 创建时间: 2025-12-05
-- 目的: 优化登录接口查询性能，减少 Wall Time

-- username 已经有 UNIQUE 约束，自动创建了索引，但我们显式创建以确保
-- 注意: SQLite 的 UNIQUE 约束会自动创建索引，但为了明确性和跨数据库兼容性，显式声明

-- 为常用查询字段创建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 为 admin_level 创建索引（用于管理员层级查询）
CREATE INDEX IF NOT EXISTS idx_users_admin_level ON users(admin_level);

-- 为 created_by 创建索引（用于查询某个管理员创建的用户）
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by);

-- 组合索引：角色+层级（用于查询特定类型的管理员）
CREATE INDEX IF NOT EXISTS idx_users_role_admin_level ON users(role, admin_level);

-- 说明:
-- 1. idx_users_username: 加速登录查询 (WHERE username = ?)
-- 2. idx_users_email: 加速邮箱查询和验证
-- 3. idx_users_role: 加速按角色筛选
-- 4. idx_users_admin_level: 加速管理员层级查询
-- 5. idx_users_created_by: 加速查询某管理员创建的用户列表
-- 6. idx_users_role_admin_level: 加速复合条件查询（如查找所有子管理员）
