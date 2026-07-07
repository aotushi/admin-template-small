-- 每日数据统计表（URL级汇总，不含国家维度）
-- 用于 Cron 定时保存和历史数据查询

CREATE TABLE IF NOT EXISTS daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                    -- 日期 (YYYY-MM-DD)
  url TEXT NOT NULL,                     -- URL
  username TEXT NOT NULL DEFAULT '',     -- 用户名
  app_id TEXT,                           -- 应用ID
  app_name TEXT,                         -- 应用名称
  request INTEGER DEFAULT 0,             -- 请求数量
  response INTEGER DEFAULT 0,            -- 响应数量
  impression INTEGER DEFAULT 0,          -- 展示数量
  click INTEGER DEFAULT 0,               -- 点击数量
  fill_rate REAL DEFAULT 0,              -- 填充率
  impression_rate REAL DEFAULT 0,        -- 展示率
  click_rate REAL DEFAULT 0,             -- 点击率
  ecpm REAL DEFAULT 0,                   -- eCPM
  revenue REAL DEFAULT 0,                -- 收入
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, url, username)            -- 同一天同一URL同一用户唯一
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date_url ON daily_stats(date, url);
