import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { DatabaseWrapper } from '../models/database';
import type { Env } from '../index';
import { getJWTSecret } from '../middlewares/auth';
import { logger } from '../utils/logger';
import {
  createAuthTokenPair,
  createUserPayload,
  verifyAuthToken
} from '../services/tokens';

const auth = new Hono<{ Bindings: Env }>();

// 用户登录
auth.post('/login', async c => {
  const timings: Record<string, number> = {};
  const startTime = Date.now();

  try {
    const { username, password } = await c.req.json();
    timings.parseRequest = Date.now() - startTime;

    if (!username || !password) {
      return c.json({ error: '用户名和密码不能为空' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 查找用户
    const dbStart = Date.now();
    const user = await db.get(
      'SELECT id, username, password, role, email, admin_level, created_by FROM users WHERE username = ?',
      [username]
    );
    timings.dbQuery = Date.now() - dbStart;

    if (!user) {
      return c.json({ error: '用户名或密码错误' }, 401);
    }

    // 验证密码 - 使用异步方法避免阻塞
    const bcryptStart = Date.now();
    const isValidPassword = await bcrypt.compare(password, user.password);
    timings.bcryptCompare = Date.now() - bcryptStart;

    if (!isValidPassword) {
      return c.json({ error: '用户名或密码错误' }, 401);
    }

    const jwtStart = Date.now();
    const jwtSecret = getJWTSecret(c.env);
    const tokens = await createAuthTokenPair(createUserPayload(user), jwtSecret);
    timings.jwtSign = Date.now() - jwtStart;

    timings.total = Date.now() - startTime;

    return c.json({
      success: true,
      data: {
        ...tokens,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email || '',
          admin_level: user.admin_level,
          created_by: user.created_by
        },
        _timings: timings // 临时返回性能数据
      }
    });
  } catch (error) {
    logger.error('Login error', error);
    return c.json({ error: '登录失败' }, 500);
  }
});

// 刷新 accessToken
auth.post('/refresh', async c => {
  try {
    const { refreshToken } = await c.req.json();

    if (!refreshToken) {
      return c.json({ error: 'refreshToken不能为空' }, 400);
    }

    const jwtSecret = getJWTSecret(c.env);
    const payload = await verifyAuthToken(refreshToken, jwtSecret, 'refresh');
    const db = new DatabaseWrapper(c.env.DB);
    const user = await db.get(
      'SELECT id, username, role, email, admin_level, created_by FROM users WHERE id = ?',
      [payload.id]
    );

    if (!user) {
      return c.json({ error: '用户不存在' }, 401);
    }

    const tokens = await createAuthTokenPair(createUserPayload(user), jwtSecret);

    return c.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    logger.error('Refresh token error', error);
    return c.json({ error: '刷新登录状态失败' }, 401);
  }
});

// 用户注册 (仅管理员可创建新用户)
auth.post('/register', async c => {
  try {
    // 验证JWT token
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = await verifyAuthToken(token, getJWTSecret(c.env), 'access');

    // 检查是否为管理员
    if (payload.role !== 'admin') {
      return c.json({ error: '权限不足' }, 403);
    }

    const { username, password, role = 'user', email } = await c.req.json();

    if (!username || !password) {
      return c.json({ error: '用户名和密码不能为空' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 检查用户是否已存在
    const existingUser = await db.get(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existingUser) {
      return c.json({ error: '用户名已存在' }, 400);
    }

    // 加密密码 - 使用异步方法避免阻塞
    const hashedPassword = await bcrypt.hash(password, 10);

    // 插入新用户
    const result = await db.run(
      'INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, role, email]
    );

    return c.json({
      success: true,
      data: {
        id: result.meta?.last_row_id || result.lastInsertRowid,
        username,
        role,
        email
      }
    });
  } catch (error) {
    logger.error('Register error', error);
    return c.json({ error: '注册失败' }, 500);
  }
});

// 获取当前用户信息
auth.get('/profile', async c => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = await verifyAuthToken(token, getJWTSecret(c.env), 'access');

    const db = new DatabaseWrapper(c.env.DB);
    const user = await db.get(
      'SELECT id, username, role, email, admin_level, created_by, created_at FROM users WHERE id = ?',
      [payload.id]
    );

    if (!user) {
      return c.json({ error: '用户不存在' }, 404);
    }

    return c.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Profile error', error);
    return c.json({ error: '获取用户信息失败' }, 500);
  }
});

// 获取用户列表 (仅管理员)
auth.get('/users', async c => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: '未授权访问' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = await verifyAuthToken(token, getJWTSecret(c.env), 'access');

    if (payload.role !== 'admin') {
      return c.json({ error: '权限不足' }, 403);
    }

    const db = new DatabaseWrapper(c.env.DB);
    const users = await db.all(
      'SELECT id, username, role, email, created_at FROM users ORDER BY created_at DESC'
    );

    return c.json({
      success: true,
      data: users
    });
  } catch (error) {
    logger.error('Users list error', error);
    return c.json({ error: '获取用户列表失败' }, 500);
  }
});

export default auth;
