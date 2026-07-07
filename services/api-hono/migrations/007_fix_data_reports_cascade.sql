-- 007_fix_data_reports_cascade.sql
-- 修复 data_reports 表的外键约束，添加 ON DELETE CASCADE
-- 创建时间: 2025-12-25
-- 说明: 当删除产品时，自动级联删除关联的数据报告

-- 关闭外键约束（迁移期间）
PRAGMA foreign_keys = OFF;

-- ============================================
-- 1. 重建 data_reports 表（添加 CASCADE 约束）
-- ============================================

-- 1.1 创建新表（添加 ON DELETE CASCADE）
CREATE TABLE IF NOT EXISTS data_reports_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  product_id INTEGER NOT NULL,

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

  -- 修复后的外键约束（添加 ON DELETE CASCADE）
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users (id),
  UNIQUE(date, product_id)
);

-- 1.2 复制旧表数据到新表
INSERT INTO data_reports_new (
  id, date, product_id,
  requests, matches, match_rate,
  impressions, impression_rate,
  clicks, ctr, ecpm, revenue,
  status, uploaded_by,
  created_at, updated_at, published_at
)
SELECT
  id, date, product_id,
  requests, matches, match_rate,
  impressions, impression_rate,
  clicks, ctr, ecpm, revenue,
  status, uploaded_by,
  created_at, updated_at, published_at
FROM data_reports;

-- 1.3 删除旧表
DROP TABLE data_reports;

-- 1.4 重命名新表
ALTER TABLE data_reports_new RENAME TO data_reports;

-- 1.5 重建索引
CREATE INDEX IF NOT EXISTS idx_data_reports_date ON data_reports(date);
CREATE INDEX IF NOT EXISTS idx_data_reports_product_id ON data_reports(product_id);
CREATE INDEX IF NOT EXISTS idx_data_reports_status ON data_reports(status);
CREATE INDEX IF NOT EXISTS idx_data_reports_uploaded_by ON data_reports(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_data_reports_date_product ON data_reports(date, product_id);

-- ============================================
-- 2. 验证迁移结果
-- ============================================

-- 2.1 检查表结构
PRAGMA table_info(data_reports);

-- 2.2 检查外键约束
PRAGMA foreign_key_list(data_reports);

-- 2.3 检查索引
SELECT name, tbl_name FROM sqlite_master
WHERE type='index'
  AND sql IS NOT NULL
  AND tbl_name = 'data_reports'
ORDER BY name;

-- 2.4 检查数据一致性
SELECT 'data_reports' as table_name, COUNT(*) as row_count FROM data_reports;

-- ============================================
-- 3. 迁移完成提示
-- ============================================

SELECT '✅ 迁移脚本执行完成！' as message;
SELECT '📌 data_reports表外键约束已添加 ON DELETE CASCADE' as info;
SELECT '🔗 删除产品时将自动级联删除关联的数据报告' as info;

-- 重新开启外键约束
PRAGMA foreign_keys = ON;
