import { AUTH_ERROR_CODES } from '@admin-backend-3/admin-api-contract/auth';
import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { DatabaseWrapper } from '../models/database';
import type { Env } from '../index';
import { getJWTSecret } from '../middlewares/auth';
import { logger } from '../utils/logger';
import { createAccessToken } from '../services/tokens';
import {
  createRefreshSession,
  RefreshSessionError,
  revokeRefreshFamily,
  revokeRefreshSession,
  rotateRefreshSession
} from '../services/refresh-sessions';
import {
  clearRefreshCookie,
  getRefreshCookie,
  setRefreshCookie
} from '../services/auth-cookies';
import { isTrustedBrowserOrigin } from '../config/origins';
import { authError, setAuthResponseNoStore } from '../services/auth-responses';
import { resolveUserAccess, type UserAccess } from '../services/permissions';

const auth = new Hono<{ Bindings: Env }>();

auth.use('*', async (c, next) => {
  setAuthResponseNoStore(c);
  await next();
});

function serializeUser(user: any, access: UserAccess) {
  return {
    id: user.id,
    username: user.username,
    email: user.email || '',
    department_id: user.department_id,
    is_active: Boolean(user.is_active),
    is_system: Boolean(user.is_system),
    created_by: user.created_by,
    // RBAC 实时解析结果（每次下发都从 D1 查，不进 JWT，改角色/权限后刷新令牌即生效）：
    // roles 是角色码（前端展示用），permissions 是权限码（按钮显隐 / 路由 meta.permission 消费）
    roles: [...access.roleCodes].sort(),
    permissions: [...access.permissionCodes].sort()
  };
}

function sessionExpiresAt(expiresAt: number) {
  return new Date(expiresAt * 1000).toISOString();
}

// 用户登录
auth.post('/login', async c => {
  const timings: Record<string, number> = {};
  const startTime = Date.now();

  try {
    if (!isTrustedBrowserOrigin(c)) {
      return authError(
        c,
        403,
        AUTH_ERROR_CODES.originNotAllowed,
        '不受信任的请求来源'
      );
    }

    const { username, password } = await c.req.json();
    timings.parseRequest = Date.now() - startTime;

    if (!username || !password) {
      return c.json({ error: '用户名和密码不能为空' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 查找用户
    const dbStart = Date.now();
    const user = await db.get(
      'SELECT id, username, password, email, department_id, is_system, is_active, created_by FROM users WHERE username = ?',
      [username]
    );
    timings.dbQuery = Date.now() - dbStart;

    if (!user) {
      return authError(
        c,
        401,
        AUTH_ERROR_CODES.invalidCredentials,
        '用户名或密码错误'
      );
    }

    // 验证密码 - 使用异步方法避免阻塞
    const bcryptStart = Date.now();
    const isValidPassword = await bcrypt.compare(password, user.password);
    timings.bcryptCompare = Date.now() - bcryptStart;

    if (!isValidPassword) {
      return authError(
        c,
        401,
        AUTH_ERROR_CODES.invalidCredentials,
        '用户名或密码错误'
      );
    }

    if (Number(user.is_active) !== 1) {
      return authError(
        c,
        401,
        AUTH_ERROR_CODES.accountUnavailable,
        '账号已停用'
      );
    }

    const rbacStart = Date.now();
    const userAccess = await resolveUserAccess(c.env.DB, user.id);
    timings.rbacResolve = Date.now() - rbacStart;

    const jwtStart = Date.now();
    const jwtSecret = getJWTSecret(c.env);
    // JWT 只装身份字段；角色/权限走 serializeUser 实时下发，不进 token
    const access = await createAccessToken(
      { id: user.id, username: user.username },
      jwtSecret
    );
    const refreshSession = await createRefreshSession(c.env.DB, user.id);
    setRefreshCookie(c, refreshSession.credential, refreshSession.expiresAt);
    timings.jwtSign = Date.now() - jwtStart;

    timings.total = Date.now() - startTime;

    return c.json({
      success: true,
      data: {
        ...access,
        sessionExpires: sessionExpiresAt(refreshSession.absoluteExpiresAt),
        user: serializeUser(user, userAccess),
        ...(c.env.ENVIRONMENT === 'development' && { _timings: timings })
      }
    });
  } catch (error) {
    logger.error('Login error', error);
    return c.json({ error: '登录失败' }, 500);
  }
});

// Rotate the browser refresh session and issue a new access token.
auth.post('/refresh', async c => {
  let rotatedFamilyId: null | string = null;

  try {
    if (!isTrustedBrowserOrigin(c)) {
      clearRefreshCookie(c);
      return authError(
        c,
        403,
        AUTH_ERROR_CODES.originNotAllowed,
        '不受信任的请求来源'
      );
    }

    const refreshCredential = getRefreshCookie(c);
    if (!refreshCredential) {
      return authError(
        c,
        401,
        AUTH_ERROR_CODES.refreshMissing,
        '刷新会话不存在'
      );
    }

    const jwtSecret = getJWTSecret(c.env);
    const refreshSession = await rotateRefreshSession(c.env.DB, refreshCredential);
    rotatedFamilyId = refreshSession.familyId;
    const db = new DatabaseWrapper(c.env.DB);
    const user = await db.get(
      'SELECT id, username, email, department_id, is_system, is_active, created_by FROM users WHERE id = ?',
      [refreshSession.userId]
    );

    if (!user || Number(user.is_active) !== 1) {
      await revokeRefreshFamily(c.env.DB, refreshSession.familyId, 'account-unavailable');
      clearRefreshCookie(c);
      return authError(
        c,
        401,
        AUTH_ERROR_CODES.accountUnavailable,
        '用户不存在、已停用或已删除'
      );
    }

    const userAccess = await resolveUserAccess(c.env.DB, user.id);
    const access = await createAccessToken(
      { id: user.id, username: user.username },
      jwtSecret
    );
    setRefreshCookie(c, refreshSession.credential, refreshSession.expiresAt);

    return c.json({
      success: true,
      data: {
        ...access,
        sessionExpires: sessionExpiresAt(refreshSession.absoluteExpiresAt),
        user: serializeUser(user, userAccess)
      }
    });
  } catch (error) {
    logger.error('Refresh token error', error);

    if (rotatedFamilyId) {
      try {
        await revokeRefreshFamily(
          c.env.DB,
          rotatedFamilyId,
          'refresh-completion-failed'
        );
      } catch (revokeError) {
        logger.error('Refresh session cleanup error', revokeError);
      }
      clearRefreshCookie(c);
      return authError(
        c,
        401,
        AUTH_ERROR_CODES.refreshRevoked,
        '刷新会话无法继续使用'
      );
    }

    if (error instanceof RefreshSessionError) {
      clearRefreshCookie(c);
      const code =
        error.code === 'expired'
          ? AUTH_ERROR_CODES.refreshExpired
          : error.code === 'replayed'
            ? AUTH_ERROR_CODES.refreshReplayed
            : AUTH_ERROR_CODES.refreshRevoked;
      const message =
        error.code === 'expired'
          ? '刷新会话已过期'
          : error.code === 'replayed'
            ? '检测到刷新凭证重放'
            : '刷新会话已失效';

      return authError(c, 401, code, message);
    }

    return authError(
      c,
      503,
      AUTH_ERROR_CODES.authServiceUnavailable,
      '刷新服务暂不可用'
    );
  }
});

auth.post('/logout', async c => {
  if (!isTrustedBrowserOrigin(c)) {
    clearRefreshCookie(c);
    return authError(
      c,
      403,
      AUTH_ERROR_CODES.originNotAllowed,
      '不受信任的请求来源'
    );
  }

  const refreshCredential = getRefreshCookie(c);

  try {
    if (refreshCredential) {
      await revokeRefreshSession(c.env.DB, refreshCredential);
    }

    return c.json({ success: true, data: null });
  } catch (error) {
    logger.error('Logout error', error);
    return c.json({ error: '退出登录失败' }, 500);
  } finally {
    clearRefreshCookie(c);
  }
});

// 获取当前用户信息
auth.get('/profile', async c => {
  try {
    const payload = c.get('user');

    const db = new DatabaseWrapper(c.env.DB);
    const user = await db.get(
      'SELECT id, username, email, department_id, is_system, is_active, created_by, created_at FROM users WHERE id = ?',
      [payload.id]
    );

    if (!user) {
      return c.json({ error: '用户不存在' }, 404);
    }

    const userAccess = await resolveUserAccess(c.env.DB, payload.id);

    return c.json({
      success: true,
      data: {
        ...user,
        roles: [...userAccess.roleCodes].sort(),
        permissions: [...userAccess.permissionCodes].sort()
      }
    });
  } catch (error) {
    logger.error('Profile error', error);
    return c.json({ error: '获取用户信息失败' }, 500);
  }
});

export default auth;
