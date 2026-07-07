import { Context, Next } from 'hono';
import { Env } from '../index';
import { getCurrentShanghaiTime } from '../utils/datetime';

/**
 * API Key 认证中间件
 * 验证用户请求中的 API Key 是否有效，并加载用户信息
 */
export async function apiKeyAuthMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');

  // 检查 Authorization header 格式
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid API Key' }, 401);
  }

  const apiKey = authHeader.substring(7);

  // 验证 API Key
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database not available' }, 500);
  }

  try {
    const keyRecord = await db
      .prepare(
        `
        SELECT ak.*, u.username
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.api_key = ? AND ak.is_active = 1
      `
      )
      .bind(apiKey)
      .first();

    if (!keyRecord) {
      return c.json({ error: 'Invalid or inactive API Key' }, 401);
    }

    // 检查是否过期
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return c.json({ error: 'API Key has expired' }, 401);
    }

    // 更新最后使用时间
    await db
      .prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
      .bind(getCurrentShanghaiTime(), keyRecord.id)
      .run();

    // 将用户信息存入上下文
    c.set('apiKeyUser', {
      userId: keyRecord.user_id,
      username: keyRecord.username,
      apiKeyId: keyRecord.id
    });

    await next();
  } catch (error) {
    console.error('API Key authentication error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
}
