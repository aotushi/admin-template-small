-- 006_products_belong_to_user.sql
-- 将产品改为属于用户（从多对多改为一对多）
-- 创建时间: 2025-12-24
-- 说明: 产品名称在用户范围内唯一，允许不同用户创建同名产品

-- 关闭外键约束（迁移期间）
PRAGMA foreign_keys = OFF;

-- ============================================
-- 1. 清理孤立数据
-- ============================================

-- 1.1 删除没有user_products关联的孤立产品（这些是创建失败的残留数据）
DELETE FROM products
WHERE id NOT IN (SELECT DISTINCT product_id FROM user_products);

-- 1.2 删除孤立产品的URLs
DELETE FROM product_urls
WHERE product_id NOT IN (SELECT id FROM products);

-- ============================================
-- 2. 重建 products 表（添加 user_id 字段）
-- ============================================

-- 2.1 创建新表
CREATE TABLE IF NOT EXISTS products_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  user_id INTEGER NOT NULL,              -- 新增：产品所属用户
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE(name, user_id)                  -- 产品名称在用户范围内唯一
);

-- 2.2 复制旧表数据到新表（从user_products获取user_id）
INSERT INTO products_new (id, name, user_id, created_at)
SELECT p.id, p.name, up.user_id, p.created_at
FROM products p
JOIN user_products up ON p.id = up.product_id;

-- 2.3 删除旧表
DROP TABLE products;

-- 2.4 重命名新表
ALTER TABLE products_new RENAME TO products;

-- 2.5 创建索引
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_name_user ON products(name, user_id);

-- ============================================
-- 3. 删除 user_products 关联表（不再需要多对多）
-- ============================================

DROP TABLE IF EXISTS user_products;

-- ============================================
-- 4. 验证迁移结果
-- ============================================

-- 4.1 检查表结构
PRAGMA table_info(products);

-- 4.2 检查索引
SELECT name, tbl_name FROM sqlite_master
WHERE type='index'
  AND sql IS NOT NULL
  AND tbl_name = 'products'
ORDER BY name;

-- 4.3 检查数据一致性
SELECT 'products' as table_name, COUNT(*) as row_count FROM products;

-- 4.4 验证product_urls的user_id与products的user_id是否一致
SELECT
  COUNT(*) as inconsistent_count
FROM product_urls pu
JOIN products p ON pu.product_id = p.id
WHERE pu.user_id != p.user_id;

-- ============================================
-- 5. 迁移完成提示
-- ============================================

SELECT '✅ 迁移脚本执行完成！' as message;
SELECT '📌 products表已添加user_id字段，产品名称在用户范围内唯一' as info;
SELECT '🗑️ user_products表已删除，产品改为属于用户（一对多关系）' as info;

-- 重新开启外键约束
PRAGMA foreign_keys = ON;
