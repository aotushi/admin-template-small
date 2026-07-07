/**
 * API Key 管理路由（仅超级管理员使用）
 * 用于创建、查看、禁用 API Key
 */
import { Hono } from 'hono';
import { authMiddleware, superAdminMiddleware } from '../middlewares/auth';
import { generateApiKey } from '../utils/api-key-generator';
import { getCurrentShanghaiTime, toBeijingTime } from '../utils/datetime';
import { Env } from '../index';

const apiKeys = new Hono<{ Bindings: Env }>();

// 创建 API Key
apiKeys.post('/', superAdminMiddleware, async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch (error) {
    console.error('解析请求体失败:', error);
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { user_id, expires_at, notes } = body;
  const currentUser = c.get('user');

  if (!user_id) {
    return c.json({ error: 'user_id is required' }, 400);
  }

  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database not available' }, 500);
  }

  try {
    // 检查用户是否已有 API Key
    const existing = await db
      .prepare('SELECT id FROM api_keys WHERE user_id = ?')
      .bind(user_id)
      .first();

    if (existing) {
      return c.json({ error: '该用户已有 API Key' }, 400);
    }

    // 生成 API Key
    const apiKey = generateApiKey();

    // 保存到数据库
    await db
      .prepare(`
        INSERT INTO api_keys (user_id, api_key, created_at, created_by, expires_at, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(user_id, apiKey, getCurrentShanghaiTime(), currentUser.id, expires_at || null, notes || null)
      .run();

    return c.json({ success: true, data: { api_key: apiKey } });
  } catch (error) {
    console.error('Create API Key error:', error);
    return c.json({ error: 'Failed to create API Key' }, 500);
  }
});

// 查看所有 API Keys
apiKeys.get('/', superAdminMiddleware, async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database not available' }, 500);
  }

  try {
    const keys = await db
      .prepare(`
        SELECT ak.*, u.username
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        ORDER BY ak.created_at DESC
      `)
      .all();

    // 格式化时间字段为北京时间
    const formattedKeys = keys.results?.map((key: any) => ({
      ...key,
      created_at: key.created_at ? toBeijingTime(key.created_at) : null,
      expires_at: key.expires_at ? toBeijingTime(key.expires_at) : null,
      last_used_at: key.last_used_at ? toBeijingTime(key.last_used_at) : null
    }));

    return c.json({ success: true, data: { keys: formattedKeys } });
  } catch (error) {
    console.error('Get API Keys error:', error);
    return c.json({ error: 'Failed to get API Keys' }, 500);
  }
});

// 禁用/启用 API Key
apiKeys.patch('/:id/status', superAdminMiddleware, async (c) => {
  const { id } = c.req.param();
  const { is_active } = await c.req.json();

  if (typeof is_active !== 'boolean') {
    return c.json({ error: 'is_active must be a boolean' }, 400);
  }

  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database not available' }, 500);
  }

  try {
    await db
      .prepare('UPDATE api_keys SET is_active = ? WHERE id = ?')
      .bind(is_active ? 1 : 0, id)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Update API Key status error:', error);
    return c.json({ error: 'Failed to update API Key status' }, 500);
  }
});

export default apiKeys;
