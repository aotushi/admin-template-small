-- 回滚索引优化
-- 如果索引导致问题，执行此文件可以删除所有索引
-- 创建时间: 2025-12-05

-- 删除所有在 003_optimize_users_indexes.sql 中创建的索引
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_admin_level;
DROP INDEX IF EXISTS idx_users_created_by;
DROP INDEX IF EXISTS idx_users_role_admin_level;

-- 说明:
-- 1. 删除索引是安全操作，不会影响数据
-- 2. 删除索引后，查询会恢复到之前的速度
-- 3. 删除索引不会删除任何数据
-- 4. 可以随时重新创建索引

-- 验证索引已删除:
-- SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='users';
