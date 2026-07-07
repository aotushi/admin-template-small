-- Migration 014: 修复 product_urls 表的 UNIQUE 约束
-- 问题：url TEXT UNIQUE 不允许多用户共享同一URL
-- 修复：改为 UNIQUE(url, user_id)，同一用户下URL唯一，允许多用户共享同一URL

-- 1. 创建新表（结构与原表一致，仅修改UNIQUE约束）
CREATE TABLE IF NOT EXISTS product_urls_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  url        TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE(url, user_id)  -- 修复：同一用户下URL唯一，允许多用户共享
);

-- 2. 迁移现有数据
INSERT INTO product_urls_new (id, product_id, user_id, url, created_at)
SELECT id, product_id, user_id, url, created_at
FROM product_urls;

-- 3. 替换旧表
DROP TABLE product_urls;
ALTER TABLE product_urls_new RENAME TO product_urls;

-- 4. 重建索引
CREATE INDEX IF NOT EXISTS idx_product_urls_product_id ON product_urls(product_id);
CREATE INDEX IF NOT EXISTS idx_product_urls_user_id    ON product_urls(user_id);
CREATE INDEX IF NOT EXISTS idx_product_urls_url        ON product_urls(url);

-- 验证
SELECT 'product_urls UNIQUE constraint fixed' as status, COUNT(*) as row_count FROM product_urls;
