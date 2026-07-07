import { Hono } from 'hono';
import { DatabaseWrapper } from '../models/database';
import type { Env } from '../index';
import { authMiddleware, adminMiddleware } from '../middlewares/auth';
import { getCurrentShanghaiTime } from '../utils/datetime';
import { logger } from '../utils/logger';
import { normalizeUrl } from '../utils/data-processor';
import { maskUrl } from '../utils/mask';

const products = new Hono<{ Bindings: Env }>();

// 获取产品列表 (仅管理员)
products.get('/list', authMiddleware, adminMiddleware, async c => {
  try {
    const db = new DatabaseWrapper(c.env.DB);

    const productsList = await db.all(`
      SELECT
        p.id,
        p.name,
        p.description,
        p.created_at,
        p.updated_at,
        COUNT(pu.id) as url_count
      FROM products p
      LEFT JOIN product_urls pu ON p.id = pu.product_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);

    return c.json({
      success: true,
      data: productsList
    });
  } catch (error) {
    logger.error('Products list error', error);
    return c.json({ error: '获取产品列表失败' }, 500);
  }
});

// 创建产品 (已废弃 - 产品现在属于用户，请通过用户创建/更新接口添加产品)
// DEPRECATED after migration 006: 产品必须属于用户，不支持独立创建
products.post('/create', authMiddleware, adminMiddleware, async c => {
  return c.json(
    {
      error:
        '此接口已废弃。产品现在属于用户，请通过用户创建/更新接口添加产品。',
      deprecated: true,
      alternative:
        'POST /api/users (创建用户时添加产品) 或 PUT /api/users/:id (更新用户时添加产品)'
    },
    410
  );
});

// 更新产品 (仅管理员)
products.put('/:id', authMiddleware, adminMiddleware, async c => {
  try {
    const productId = c.req.param('id');
    const { name, description } = await c.req.json();

    const db = new DatabaseWrapper(c.env.DB);

    // 检查产品是否存在
    const existingProduct = await db.get(
      'SELECT id FROM products WHERE id = ?',
      [productId]
    );

    if (!existingProduct) {
      return c.json({ error: '产品不存在' }, 404);
    }

    // 如果要更新名称，检查名称是否在同一用户范围内重复
    if (name && name.trim()) {
      const duplicateName = await db.get(
        `SELECT p.id FROM products p
         WHERE p.name = ? AND p.id != ?
         AND p.user_id = (SELECT user_id FROM products WHERE id = ?)`,
        [name.trim(), productId, productId]
      );

      if (duplicateName) {
        return c.json({ error: '该用户下已存在同名产品' }, 400);
      }
    }

    // 更新产品
    await db.run(
      'UPDATE products SET name = ?, description = ?, updated_at = datetime("now", "localtime") WHERE id = ?',
      [name?.trim() || null, description?.trim() || null, productId]
    );

    // 获取更新后的产品信息
    const updatedProduct = await db.get(
      'SELECT id, name, description, created_at, updated_at FROM products WHERE id = ?',
      [productId]
    );

    return c.json({
      success: true,
      data: updatedProduct
    });
  } catch (error) {
    logger.error('Update product error', error);
    return c.json({ error: '更新产品失败' }, 500);
  }
});

// 删除产品 (仅管理员)
products.delete('/:id', authMiddleware, adminMiddleware, async c => {
  try {
    const productId = c.req.param('id');
    const db = new DatabaseWrapper(c.env.DB);

    // 检查产品是否存在
    const existingProduct = await db.get(
      'SELECT id, name FROM products WHERE id = ?',
      [productId]
    );

    if (!existingProduct) {
      return c.json({ error: '产品不存在' }, 404);
    }

    // 检查是否有关联的数据报告
    const relatedReports = await db.get(
      'SELECT COUNT(*) as count FROM data_reports WHERE product_id = ?',
      [productId]
    );

    if (relatedReports && relatedReports.count > 0) {
      return c.json(
        {
          error: `无法删除产品"${existingProduct.name}"，该产品已有 ${relatedReports.count} 条数据报告`
        },
        409
      );
    }

    // 删除产品（级联删除 product_urls）
    await db.run('DELETE FROM products WHERE id = ?', [productId]);

    return c.json({
      success: true,
      message: '产品删除成功'
    });
  } catch (error) {
    logger.error('Delete product error', error);
    return c.json({ error: '删除产品失败' }, 500);
  }
});

// 获取产品的URL列表 (仅管理员)
products.get('/:id/urls', authMiddleware, adminMiddleware, async c => {
  try {
    const productId = c.req.param('id');
    const db = new DatabaseWrapper(c.env.DB);

    // 检查产品是否存在
    const existingProduct = await db.get(
      'SELECT id, name FROM products WHERE id = ?',
      [productId]
    );

    if (!existingProduct) {
      return c.json({ error: '产品不存在' }, 404);
    }

    // 获取产品的所有URL
    const urls = await db.all(
      'SELECT id, url, created_at FROM product_urls WHERE product_id = ? ORDER BY created_at ASC',
      [productId]
    );

    return c.json({
      success: true,
      data: {
        product: existingProduct,
        urls: urls.map((u: any) => ({ ...u, url: maskUrl(u.url) }))
      }
    });
  } catch (error) {
    logger.error('Get product URLs error', error);
    return c.json({ error: '获取产品URL列表失败' }, 500);
  }
});

// 为产品添加URL (仅管理员)
products.post('/:id/urls', authMiddleware, adminMiddleware, async c => {
  try {
    const productId = c.req.param('id');
    const { url, urls } = await c.req.json();

    const db = new DatabaseWrapper(c.env.DB);

    // 检查产品是否存在
    const existingProduct = await db.get(
      'SELECT id FROM products WHERE id = ?',
      [productId]
    );

    if (!existingProduct) {
      return c.json({ error: '产品不存在' }, 404);
    }

    // 处理单个URL或批量URL
    const urlsToAdd = urls ? urls : url ? [url] : [];

    if (urlsToAdd.length === 0) {
      return c.json({ error: 'URL不能为空' }, 400);
    }

    // 验证URL格式
    const urlPattern = /^https?:\/\/.+/;
    const invalidUrls = urlsToAdd.filter((u: string) => !urlPattern.test(u));

    if (invalidUrls.length > 0) {
      return c.json(
        {
          error: `以下URL格式不正确：${invalidUrls.join(', ')}`
        },
        400
      );
    }

    const currentUser = c.get('user');
    const userId = currentUser.id;

    // 检查URL是否已存在（限当前用户范围，允许不同用户配置相同URL）
    const existingUrls = await db.all(
      `SELECT url FROM product_urls WHERE user_id = ? AND url IN (${urlsToAdd.map(() => '?').join(',')})`,
      [userId, ...urlsToAdd]
    );

    if (existingUrls.length > 0) {
      const duplicateUrls = existingUrls.map((u: any) => u.url);
      return c.json(
        {
          error: `以下URL已存在：${duplicateUrls.join(', ')}`
        },
        400
      );
    }

    // 批量插入URL（标准化后保存）
    const addedUrls = [];
    for (const urlToAdd of urlsToAdd) {
      const normalizedUrl = normalizeUrl(urlToAdd.trim());
      const result = await db.run(
        'INSERT INTO product_urls (product_id, user_id, url) VALUES (?, ?, ?)',
        [productId, userId, normalizedUrl]
      );

      addedUrls.push({
        id: result.meta?.last_row_id || result.lastInsertRowid,
        url: normalizedUrl
      });
    }

    return c.json({
      success: true,
      data: {
        added: addedUrls.length,
        urls: addedUrls
      }
    });
  } catch (error) {
    logger.error('Add product URL error', error);
    return c.json({ error: '添加产品URL失败' }, 500);
  }
});

// 删除产品URL (仅管理员)
products.delete(
  '/:id/urls/:urlId',
  authMiddleware,
  adminMiddleware,
  async c => {
    try {
      const productId = c.req.param('id');
      const urlId = c.req.param('urlId');
      const db = new DatabaseWrapper(c.env.DB);

      // 检查URL是否存在且属于该产品
      const existingUrl = await db.get(
        'SELECT id, url FROM product_urls WHERE id = ? AND product_id = ?',
        [urlId, productId]
      );

      if (!existingUrl) {
        return c.json({ error: 'URL不存在或不属于该产品' }, 404);
      }

      // 检查是否有关联的原始数据
      const relatedRawData = await db.get(
        'SELECT COUNT(*) as count FROM raw_data WHERE url = ?',
        [existingUrl.url]
      );

      if (relatedRawData && relatedRawData.count > 0) {
        return c.json(
          {
            error: `无法删除URL"${existingUrl.url}"，该URL已有 ${relatedRawData.count} 条原始数据记录`
          },
          409
        );
      }

      // 删除URL
      await db.run('DELETE FROM product_urls WHERE id = ?', [urlId]);

      return c.json({
        success: true,
        message: 'URL删除成功'
      });
    } catch (error) {
      logger.error('Delete product URL error', error);
      return c.json({ error: '删除产品URL失败' }, 500);
    }
  }
);

export default products;
