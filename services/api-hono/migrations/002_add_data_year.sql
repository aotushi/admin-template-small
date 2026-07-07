-- 添加数据年份字段到 excel_files 表
-- 这样每个上传的文件都明确标注数据属于哪一年

ALTER TABLE excel_files ADD COLUMN data_year INTEGER;

-- 为已存在的文件设置默认年份（使用上传时间的年份）
UPDATE excel_files
SET data_year = CAST(strftime('%Y', created_at) AS INTEGER)
WHERE data_year IS NULL;

-- 创建索引优化按年份查询
CREATE INDEX IF NOT EXISTS idx_excel_files_data_year ON excel_files(data_year);
