import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import departmentRoutes from './routes/departments';
import roleRoutes from './routes/roles';
import menuRoutes from './routes/menus';
import { authMiddleware } from './middlewares/auth';
import {
  pathBlacklistMiddleware,
  rateLimitMiddleware
} from './middlewares/security';
import { logger } from './utils/logger';
import { resolveAllowedOrigin } from './config/origins';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
}

const app = new Hono<{ Bindings: Env }>().basePath('/admin');

// ====== 安全防护中间件（优先级最高） ======
// 1. 路径黑名单 - 拦截探测敏感文件的请求
app.use('*', pathBlacklistMiddleware());

// 2. 简单限流 - 防止单个IP短时间大量请求（100次/分钟）
app.use('*', rateLimitMiddleware({ windowMs: 60000, maxRequests: 100 }));

// CORS配置
app.use(
  '*',
  cors({
    origin: resolveAllowedOrigin,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['Retry-After', 'WWW-Authenticate'],
    credentials: true
  })
);

// 初始化数据库
app.use('*', async (c, next) => {
  // 现在只使用D1数据库
  await next();
});

// ====== API 全局认证中间件 ======
// 对所有 /api/* 路径要求 token 验证（排除公开接口）
app.use('/api/*', async (c, next) => {
  const path = c.req.path;

  // 公开路径白名单（不需要 token 验证）
  const publicPaths = [
    '/admin/api/auth/login',
    '/admin/api/auth/logout',
    '/admin/api/auth/refresh'
  ];

  // 跳过公开路径
  if (publicPaths.includes(path)) {
    return await next();
  }

  // 其他所有 API 路径都需要验证 token
  return authMiddleware(c, next);
});

// 根路径 - 最小化信息暴露
app.get('/', c => {
  return c.json({ status: 'ok' });
});

// 路由
app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/departments', departmentRoutes);
app.route('/api/roles', roleRoutes);
app.route('/api/menus', menuRoutes);

// 健康检查
app.get('/health', c => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.notFound(c => {
  // 不返回请求路径，避免路径探测
  return c.json({ error: 'Not Found' }, 404);
});

app.onError((err, c) => {
  logger.error('Internal Server Error', err);

  // 只在开发环境返回详细错误信息
  const isDev = c.env.ENVIRONMENT === 'development';

  return c.json(
    {
      error: 'Internal Server Error',
      ...(isDev && { message: err.message, stack: err.stack })
    },
    500
  );
});

// Cloudflare Workers导出
export default {
  fetch: app.fetch
};
