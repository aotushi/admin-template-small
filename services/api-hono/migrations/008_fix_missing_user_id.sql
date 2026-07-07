-- 008_fix_missing_user_id.sql
-- 修复 Migration 007 导致的 user_id 字段丢失问题
-- 创建时间: 2025-12-25
-- 说明: Migration 007 在重建 data_reports 表时丢失了 user_id 字段，此脚本进行修复

-- ⚠️ 警告：由于 user_id 字段已丢失，旧数据的 user_id 信息无法恢复
-- ⚠️ 需要根据 product_id 推断 user_id（通过 products.user_id）

-- 关闭外键约束（迁移期间）
PRAGMA foreign_keys = OFF;

-- ============================================
-- 1. 备份当前 data_reports 表数据
-- ============================================
CREATE TABLE IF NOT EXISTS data_reports_backup AS
SELECT * FROM data_reports;

-- ============================================
-- 2. 重建 data_reports 表（包含 user_id 字段）
-- ============================================

-- 2.1 删除旧表
DROP TABLE data_reports;

-- 2.2 创建新表（完整结构，包含 user_id 和 CASCADE）
CREATE TABLE IF NOT EXISTS data_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,                -- 恢复 user_id 字段

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

  -- 外键约束（包含 CASCADE）
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (uploaded_by) REFERENCES users (id),
  UNIQUE(date, product_id, user_id)        -- 完整的唯一约束
);

-- 2.3 从备份恢复数据（通过 JOIN products 表推断 user_id）
INSERT INTO data_reports (
  id, date, product_id, user_id,
  requests, matches, match_rate,
  impressions, impression_rate,
  clicks, ctr, ecpm, revenue,
  status, uploaded_by,
  created_at, updated_at, published_at
)
SELECT
  b.id, b.date, b.product_id, p.user_id,  -- 从 products 表推断 user_id
  b.requests, b.matches, b.match_rate,
  b.impressions, b.impression_rate,
  b.clicks, b.ctr, b.ecpm, b.revenue,
  b.status, b.uploaded_by,
  b.created_at, b.updated_at, b.published_at
FROM data_reports_backup b
JOIN products p ON b.product_id = p.id;

-- 2.4 重建索引
CREATE INDEX IF NOT EXISTS idx_data_reports_date ON data_reports(date);
CREATE INDEX IF NOT EXISTS idx_data_reports_product_id ON data_reports(product_id);
CREATE INDEX IF NOT EXISTS idx_data_reports_user_id ON data_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_data_reports_status ON data_reports(status);
CREATE INDEX IF NOT EXISTS idx_data_reports_uploaded_by ON data_reports(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_data_reports_date_product_user ON data_reports(date, product_id, user_id);

-- ============================================
-- 3. 验证迁移结果
-- ============================================

-- 3.1 检查表结构
PRAGMA table_info(data_reports);

-- 3.2 检查外键约束
PRAGMA foreign_key_list(data_reports);

-- 3.3 检查数据完整性
SELECT 'data_reports_backup' as table_name, COUNT(*) as row_count FROM data_reports_backup
UNION ALL
SELECT 'data_reports' as table_name, COUNT(*) as row_count FROM data_reports;

-- 3.4 检查是否有数据丢失（因为 JOIN 失败）
SELECT
  'Missing records' as warning,
  COUNT(*) as count
FROM data_reports_backup b
LEFT JOIN products p ON b.product_id = p.id
WHERE p.id IS NULL;

-- ============================================
-- 4. 清理备份表（可选，保留以防万一）
-- ============================================
-- DROP TABLE data_reports_backup;  -- 暂时保留，确认数据无误后可手动删除

-- ============================================
-- 5. 迁移完成提示
-- ============================================
SELECT '✅ Migration 008 执行完成！' as message;
SELECT '📌 user_id 字段已恢复到 data_reports 表' as info;
SELECT '⚠️ user_id 通过 products.user_id 推断得出' as warning;
SELECT '💾 备份表 data_reports_backup 已保留，确认无误后可手动删除' as info;

-- 重新开启外键约束
PRAGMA foreign_keys = ON;
