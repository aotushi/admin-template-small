import { isSuperAdmin } from './permissions';
import { DatabaseWrapper } from '../models/database';
import { createUserPayload, verifyAuthToken } from '../services/tokens';

/**
 * 获取 JWT 密钥
 * @param env 环境变量对象
 * @returns JWT 密钥字符串
 * @throws 如果 JWT_SECRET 未配置则抛出错误
 */
export const getJWTSecret = (env: any): string => {
  const secret = env?.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment');
  }
  return secret;
};

/**
 * JWT 验证中间件
 * 验证请求中的 Authorization header，解析并验证 JWT token
 */
export const authMiddleware = async (c: any, next: any) => {
  if (c.get('user')) {
    await next();
    return;
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  let payload;

  try {
    payload = await verifyAuthToken(token, getJWTSecret(c.env), 'access');
  } catch (error) {
    return c.json({ error: 'Token无效' }, 401);
  }

  const db = new DatabaseWrapper(c.env.DB);
  const currentUser = await db.get(
    'SELECT id, username, role, admin_level, created_by FROM users WHERE id = ?',
    [payload.id]
  );

  if (!currentUser) {
    return c.json({ error: '用户不存在或已被删除' }, 401);
  }

  c.set('user', createUserPayload(currentUser));
  await next();
};

/**
 * 管理员权限中间件
 * 验证当前用户是否具有管理员角色
 * 必须在 authMiddleware 之后使用
 */
export const adminMiddleware = async (c: any, next: any) => {
  const user = c.get('user');
  if (user.role !== 'admin') {
    return c.json({ error: '权限不足，仅管理员可操作' }, 403);
  }
  await next();
};

/**
 * 总管理员权限中间件
 * 验证当前用户是否为总管理员（admin_level === 'super'）
 * 必须在 authMiddleware 之后使用
 */
export const superAdminMiddleware = async (c: any, next: any) => {
  const user = c.get('user');
  if (!isSuperAdmin(user)) {
    return c.json({ error: '权限不足，仅总管理员可操作' }, 403);
  }
  await next();
};
