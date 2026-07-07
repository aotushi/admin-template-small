-- 004_add_data_report_system.sql
-- 添加数据报告管理系统相关表
-- 创建时间: 2025-12-18 15:10:45

-- ============================================
-- 1. 创建产品表 (products)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,              -- 产品名称（全局唯一）
  description TEXT,                        -- 产品描述
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 产品表索引
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

-- ============================================
-- 2. 创建产品URL映射表 (product_urls)
-- ============================================
CREATE TABLE IF NOT EXISTS product_urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,             -- 关联产品ID
  url TEXT UNIQUE NOT NULL,                -- URL地址（全局唯一）
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

-- 产品URL表索引
CREATE INDEX IF NOT EXISTS idx_product_urls_product_id ON product_urls(product_id);
CREATE INDEX IF NOT EXISTS idx_product_urls_url ON product_urls(url);

-- ============================================
-- 3. 创建用户产品关联表 (user_products)
-- ============================================
CREATE TABLE IF NOT EXISTS user_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,                -- 关联用户ID
  product_id INTEGER NOT NULL,             -- 关联产品ID
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  UNIQUE(user_id, product_id)              -- 防止重复关联
);

-- 用户产品关联表索引
CREATE INDEX IF NOT EXISTS idx_user_products_user_id ON user_products(user_id);
CREATE INDEX IF NOT EXISTS idx_user_products_product_id ON user_products(product_id);

-- ============================================
-- 4. 创建数据报告表 (data_reports)
-- ============================================
CREATE TABLE IF NOT EXISTS data_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                      -- 数据日期（格式：YYYY-MM-DD）
  product_id INTEGER NOT NULL,             -- 关联产品ID

  -- 聚合数据字段（全部使用 TEXT 存储，便于跨平台兼容和未来迁移）
  requests TEXT NOT NULL DEFAULT '0',
  matches TEXT NOT NULL DEFAULT '0',
  match_rate TEXT NOT NULL DEFAULT '0.0000',       -- 保留4位小数（文本存储）
  impressions TEXT NOT NULL DEFAULT '0',
  impression_rate TEXT NOT NULL DEFAULT '0.0000',  -- 保留4位小数（文本存储）
  clicks TEXT NOT NULL DEFAULT '0',
  ctr TEXT NOT NULL DEFAULT '0.0000',              -- 保留4位小数（文本存储）
  ecpm TEXT NOT NULL DEFAULT '0.00',               -- 保留2位小数（文本存储）
  revenue TEXT NOT NULL DEFAULT '0.00',            -- 保留2位小数（文本存储）

  -- 状态管理
  status TEXT NOT NULL DEFAULT 'draft',    -- 状态：draft（草稿）/ published（已发布）
  uploaded_by INTEGER NOT NULL,            -- 上传者ID

  -- 时间戳
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  published_at TEXT,                       -- 发布时间

  FOREIGN KEY (product_id) REFERENCES products (id),
  FOREIGN KEY (uploaded_by) REFERENCES users (id),
  UNIQUE(date, product_id)                 -- 同一天同一产品只有一条聚合记录
);

-- 数据报告表索引
CREATE INDEX IF NOT EXISTS idx_data_reports_date ON data_reports(date);
CREATE INDEX IF NOT EXISTS idx_data_reports_product_id ON data_reports(product_id);
CREATE INDEX IF NOT EXISTS idx_data_reports_status ON data_reports(status);
CREATE INDEX IF NOT EXISTS idx_data_reports_uploaded_by ON data_reports(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_data_reports_date_product ON data_reports(date, product_id);

-- ============================================
-- 5. 创建原始数据表 (raw_data)
-- ============================================
CREATE TABLE IF NOT EXISTS raw_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,              -- 关联的聚合报告ID
  date TEXT NOT NULL,                      -- 数据日期
  url TEXT NOT NULL,                       -- 原始URL

  -- 原始数据字段（全部使用 TEXT 存储，与 data_reports 表保持一致）
  requests TEXT NOT NULL DEFAULT '0',
  matches TEXT NOT NULL DEFAULT '0',
  impressions TEXT NOT NULL DEFAULT '0',
  clicks TEXT NOT NULL DEFAULT '0',
  ecpm TEXT NOT NULL DEFAULT '0.00',
  revenue TEXT NOT NULL DEFAULT '0.00',

  created_at TEXT DEFAULT (datetime('now', 'localtime')),

  FOREIGN KEY (report_id) REFERENCES data_reports (id) ON DELETE CASCADE
);

-- 原始数据表索引
CREATE INDEX IF NOT EXISTS idx_raw_data_report_id ON raw_data(report_id);
CREATE INDEX IF NOT EXISTS idx_raw_data_date ON raw_data(date);
CREATE INDEX IF NOT EXISTS idx_raw_data_url ON raw_data(url);

-- ============================================
-- 6. 验证迁移结果
-- ============================================
-- 检查所有新表是否创建成功
SELECT
  name,
  type
FROM sqlite_master
WHERE type='table'
  AND name IN ('products', 'product_urls', 'user_products', 'data_reports', 'raw_data')
ORDER BY name;

-- 检查所有新索引是否创建成功
SELECT
  name,
  tbl_name
FROM sqlite_master
WHERE type='index'
  AND sql IS NOT NULL
  AND tbl_name IN ('products', 'product_urls', 'user_products', 'data_reports', 'raw_data')
ORDER BY tbl_name, name;
