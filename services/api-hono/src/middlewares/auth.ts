import { AUTH_ERROR_CODES } from '@admin-backend-3/admin-api-contract/auth';
import { JwtTokenExpired } from 'hono/utils/jwt/types';
import { DatabaseWrapper } from '../models/database';
import { resolveUserAccess, setUserAccessContext } from '../services/permissions';
import { createUserPayload, verifyAuthToken } from '../services/tokens';
import { authError } from '../services/auth-responses';
import { revokeRefreshSessionsForUser } from '../services/refresh-sessions';
import { logger } from '../utils/logger';

/**
 * 获取 JWT 密钥
 * @param env 环境变量对象
 * @returns JWT 密钥字符串
 * @throws 如果 JWT_SECRET 未配置则抛出错误
 */
export const getJWTSecret = (env: any): string => {
  const secret = env?.JWT_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
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
    return authError(c, 401, AUTH_ERROR_CODES.authRequired, '请先登录');
  }

  const token = authHeader.replace('Bearer ', '');
  let payload;

  try {
    payload = await verifyAuthToken(token, getJWTSecret(c.env), 'access');
  } catch (error) {
    if (error instanceof JwtTokenExpired) {
      return authError(
        c,
        401,
        AUTH_ERROR_CODES.accessTokenExpired,
        '登录凭证已过期'
      );
    }

    return authError(
      c,
      401,
      AUTH_ERROR_CODES.accessTokenInvalid,
      '登录凭证无效'
    );
  }

  const db = new DatabaseWrapper(c.env.DB);
  const currentUser = await db.get(
    'SELECT id, username, created_by, is_active FROM users WHERE id = ?',
    [payload.id]
  );

  if (!currentUser || Number(currentUser.is_active) !== 1) {
    try {
      await revokeRefreshSessionsForUser(c.env.DB, payload.id, 'account-unavailable');
    } catch (error) {
      logger.error('Failed to revoke unavailable account sessions', error);
    }

    return authError(
      c,
      401,
      AUTH_ERROR_CODES.accountUnavailable,
      '用户不存在、已停用或已删除'
    );
  }

  // 角色码与权限一次解析：payload 装 role_codes，access 预填 context 缓存供 requirePermission 复用
  const access = await resolveUserAccess(c.env.DB, currentUser.id);
  setUserAccessContext(c, access);
  c.set('user', createUserPayload(currentUser, [...access.roleCodes]));
  await next();
};
