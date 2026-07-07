import { isSuperAdmin } from './permissions';
import { verifyAuthToken } from '../services/tokens';

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
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = await verifyAuthToken(token, getJWTSecret(c.env), 'access');
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ error: 'Token无效' }, 401);
  }
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
