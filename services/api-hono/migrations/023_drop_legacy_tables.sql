-- 023: 删除老项目遗留业务表
-- 这批表属于 admin-backend 老项目的业务（Excel 报表 / 产品 URL / 第三方数据统计 / API Key），
-- 本模板前端零引用，对应路由与服务代码已同步删除。
-- 保留表：users / departments / roles / menus / user_roles / role_menus / refresh_sessions。
-- 按外键依赖先删子表再删父表。

DROP TABLE IF EXISTS excel_data;
DROP TABLE IF EXISTS excel_file_permissions;
DROP TABLE IF EXISTS excel_files;

DROP TABLE IF EXISTS data_reports;
DROP TABLE IF EXISTS data_reports_backup;
DROP TABLE IF EXISTS raw_data;

DROP TABLE IF EXISTS product_urls;
DROP TABLE IF EXISTS products;

DROP TABLE IF EXISTS api_logs;
DROP TABLE IF EXISTS api_keys;

DROP TABLE IF EXISTS daily_stats;
