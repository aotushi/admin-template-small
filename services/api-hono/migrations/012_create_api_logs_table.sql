-- 012_create_api_logs_table.sql
-- 创建 API 调用日志表（可选功能）
-- 创建时间: 2026-01-29

-- ============================================
-- 1. 创建 api_logs 表
-- ============================================

CREATE TABLE IF NOT EXISTS api_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_id INTEGER NOT NULL,         -- API Key ID
  user_id INTEGER NOT NULL,            -- 用户ID
  endpoint TEXT NOT NULL,              -- 请求的接口路径
  method TEXT NOT NULL,                -- HTTP 方法
  ip_address TEXT,                     -- 请求IP
  response_status INTEGER,             -- 响应状态码
  response_time INTEGER,               -- 响应时间（毫秒）
  created_at TEXT NOT NULL,            -- 请求时间
  error_message TEXT,                  -- 错误信息（如果有）

  FOREIGN KEY (api_key_id) REFERENCES api_keys(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- 2. 创建 api_logs 表索引
-- ============================================

-- API Key ID索引（用于查询特定API Key的日志）
CREATE INDEX IF NOT EXISTS idx_api_logs_key_id ON api_logs(api_key_id);

-- 用户ID索引（用于查询特定用户的日志）
CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON api_logs(user_id);

-- 创建时间索引（用于按时间查询日志）
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at);
