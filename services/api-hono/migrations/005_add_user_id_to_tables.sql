-- 005_add_user_id_to_tables.sql
-- 为数据报告系统相关表增加 user_id 字段
-- 创建时间: 2025-12-23
-- 说明: 实现 URL-Product-User 三元关系，支持按用户分组聚合报告

-- ============================================
-- 重要说明
-- ============================================
-- SQLite 不支持直接修改表结构（如添加外键约束、修改唯一约束）
-- 因此需要采用"重建表"的方式：
-- 1. 创建新表（包含新字段和约束）
-- 2. 复制旧表数据到新表
-- 3. 删除旧表
-- 4. 重命名新表为原表名
-- 5. 重建索引

-- ============================================
-- 1. 重建 product_urls 表（增加 user_id 字段）
-- ============================================

-- 1.1 创建新表
CREATE TABLE IF NOT EXISTS product_urls_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,                -- 新增：URL所属用户
  url TEXT UNIQUE NOT NULL,                -- URL全局唯一
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 1.2 复制旧表数据到新表
-- 注意：将旧数据的 user_id 设置为 39 (test123 用户)
INSERT INTO product_urls_new (id, product_id, url, created_at, user_id)
SELECT id, product_id, url, created_at, 39 as user_id  -- 默认分配给 user_id=39 (test123)
FROM product_urls;

-- 1.3 删除旧表
DROP TABLE product_urls;

-- 1.4 重命名新表
ALTER TABLE product_urls_new RENAME TO product_urls;

-- 1.5 重建索引
CREATE INDEX IF NOT EXISTS idx_product_urls_product_id ON product_urls(product_id);
CREATE INDEX IF NOT EXISTS idx_product_urls_user_id ON product_urls(user_id);
CREATE INDEX IF NOT EXISTS idx_product_urls_url ON product_urls(url);

-- ============================================
-- 2. 重建 data_reports 表（增加 user_id 字段）
-- ============================================

-- 2.1 创建新表
CREATE TABLE IF NOT EXISTS data_reports_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,                -- 新增：报告所属用户

  -- 聚合数据字段
  requests TEXT NOT NULL DEFAULT '0',
  matches TEXT NOT NULL DEFAULT '0',
  match_rate TEXT NOT NULL DEFAULT '0.0000',
  impressions TEXT NOT NULL DEFAULT '0',
  impression_rate TEXT NOT NULL DEFAULT '0.0000',
  clicks TEXT NOT NULL DEFAULT '0',
  ctr TEXT NOT NULL DEFAULT '0.0000',
  ecpm TEXT NOT NULL DEFAULT '0.00',
  revenue TEXT NOT NULL DEFAULT '0.00',

  -- 状态管理
  status TEXT NOT NULL DEFAULT 'draft',
  uploaded_by INTEGER NOT NULL,

  -- 时间戳
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  published_at TEXT,

  FOREIGN KEY (product_id) REFERENCES products (id),
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (uploaded_by) REFERENCES users (id),
  UNIQUE(date, product_id, user_id)        -- 修改：同一天同一产品同一用户只有一条记录
);

-- 2.2 复制旧表数据到新表
INSERT INTO data_reports_new (
  id, date, product_id, user_id, requests, matches, match_rate,
  impressions, impression_rate, clicks, ctr, ecpm, revenue,
  status, uploaded_by, created_at, updated_at, published_at
)
SELECT
  id, date, product_id, 39 as user_id,  -- 默认分配给 user_id=39 (test123)
  requests, matches, match_rate,
  impressions, impression_rate, clicks, ctr, ecpm, revenue,
  status, uploaded_by, created_at, updated_at, published_at
FROM data_reports;

-- 2.3 删除旧表
DROP TABLE data_reports;

-- 2.4 重命名新表
ALTER TABLE data_reports_new RENAME TO data_reports;

-- 2.5 重建索引
CREATE INDEX IF NOT EXISTS idx_data_reports_date ON data_reports(date);
CREATE INDEX IF NOT EXISTS idx_data_reports_product_id ON data_reports(product_id);
CREATE INDEX IF NOT EXISTS idx_data_reports_user_id ON data_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_data_reports_status ON data_reports(status);
CREATE INDEX IF NOT EXISTS idx_data_reports_uploaded_by ON data_reports(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_data_reports_date_product_user ON data_reports(date, product_id, user_id);

-- ============================================
-- 3. 重建 raw_data 表（增加 user_id 字段，保持一致性）
-- ============================================

-- 3.1 创建新表
CREATE TABLE IF NOT EXISTS raw_data_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  url TEXT NOT NULL,
  user_id INTEGER NOT NULL,                -- 新增：原始数据所属用户

  -- 原始数据字段
  requests TEXT NOT NULL DEFAULT '0',
  matches TEXT NOT NULL DEFAULT '0',
  impressions TEXT NOT NULL DEFAULT '0',
  clicks TEXT NOT NULL DEFAULT '0',
  ecpm TEXT NOT NULL DEFAULT '0.00',
  revenue TEXT NOT NULL DEFAULT '0.00',

  created_at TEXT DEFAULT (datetime('now', 'localtime')),

  FOREIGN KEY (report_id) REFERENCES data_reports (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

-- 3.2 复制旧表数据到新表
INSERT INTO raw_data_new (
  id, report_id, date, url, user_id, requests, matches,
  impressions, clicks, ecpm, revenue, created_at
)
SELECT
  id, report_id, date, url, 39 as user_id,  -- 默认分配给 user_id=39 (test123)
  requests, matches, impressions, clicks, ecpm, revenue, created_at
FROM raw_data;

-- 3.3 删除旧表
DROP TABLE raw_data;

-- 3.4 重命名新表
ALTER TABLE raw_data_new RENAME TO raw_data;

-- 3.5 重建索引
CREATE INDEX IF NOT EXISTS idx_raw_data_report_id ON raw_data(report_id);
CREATE INDEX IF NOT EXISTS idx_raw_data_date ON raw_data(date);
CREATE INDEX IF NOT EXISTS idx_raw_data_url ON raw_data(url);
CREATE INDEX IF NOT EXISTS idx_raw_data_user_id ON raw_data(user_id);

-- ============================================
-- 4. 验证迁移结果
-- ============================================

-- 4.1 检查表结构
PRAGMA table_info(product_urls);
PRAGMA table_info(data_reports);
PRAGMA table_info(raw_data);

-- 4.2 检查索引
SELECT name, tbl_name FROM sqlite_master
WHERE type='index'
  AND sql IS NOT NULL
  AND tbl_name IN ('product_urls', 'data_reports', 'raw_data')
ORDER BY tbl_name, name;

-- 4.3 检查数据行数（确保数据没有丢失）
SELECT 'product_urls' as table_name, COUNT(*) as row_count FROM product_urls
UNION ALL
SELECT 'data_reports', COUNT(*) FROM data_reports
UNION ALL
SELECT 'raw_data', COUNT(*) FROM raw_data;

-- ============================================
-- 5. 迁移完成提示
-- ============================================
SELECT '✅ 迁移脚本执行完成！' as message;
SELECT '⚠️ 注意：旧数据的 user_id 已默认设置为 39 (test123)' as warning;
SELECT '⚠️ 如需修改，请手动更新相关记录的 user_id 字段' as warning;
