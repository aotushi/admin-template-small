-- 009_add_scheduled_publish_to_data_reports.sql
-- 为 data_reports 表添加定时发布功能
-- 创建时间: 2025-12-30

-- ============================================
-- 添加定时发布相关字段
-- ============================================

-- 1. 添加 display_time 字段（展示时间）
ALTER TABLE data_reports ADD COLUMN display_time TEXT;

-- 2. 添加 scheduled_publish 字段（是否启用定时发布，0=否，1=是）
ALTER TABLE data_reports ADD COLUMN scheduled_publish INTEGER DEFAULT 0;

-- ============================================
-- 添加索引（可选，用于查询优化）
-- ============================================

-- 为 scheduled_publish 字段添加索引，方便查询定时发布的报告
CREATE INDEX IF NOT EXISTS idx_data_reports_scheduled_publish ON data_reports(scheduled_publish);

-- 为 display_time 字段添加索引，方便按时间查询
CREATE INDEX IF NOT EXISTS idx_data_reports_display_time ON data_reports(display_time);
