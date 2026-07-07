-- 011_create_api_keys_tables.sql
-- 创建 API Keys 和 API Logs 表，用于用户 API 查询功能
-- 创建时间: 2026-01-29

-- ============================================
-- 1. 创建 api_keys 表
-- ============================================

CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,            -- 关联的用户ID（users表）
  api_key TEXT NOT NULL UNIQUE,        -- API Key（UUID格式）

  -- 状态和限制
  is_active INTEGER DEFAULT 1,         -- 是否启用（0=禁用，1=启用）
  rate_limit INTEGER DEFAULT 1000,     -- 速率限制（每小时请求次数）

  -- 时间戳
  created_at TEXT NOT NULL,            -- 创建时间
  created_by INTEGER NOT NULL,         -- 创建人（管理员ID）
  expires_at TEXT,                     -- 过期时间（可选）
  last_used_at TEXT,                   -- 最后使用时间

  -- 其他
  notes TEXT,                          -- 备注

  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- 2. 创建 api_keys 表索引
-- ============================================

-- 用户ID唯一索引（一个用户只能有一个API Key）
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- API Key索引（用于快速查找）
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(api_key);

-- 启用状态索引（用于查询活跃的API Keys）
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
