import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth';
import fileRoutes from './routes/files';
import userRoutes from './routes/users';
import productRoutes from './routes/products';
import dataReportRoutes from './routes/data-reports';
import userApiRoutes from './routes/user-api';
import apiKeyRoutes from './routes/api-keys';
import { handleDailyStatsStream } from './routes/daily-stats';
import { handleDailyStatsHistory } from './routes/daily-stats-history';
import { handleDailyStatsSaveManual } from './routes/daily-stats-save';
import { handleDailyStatsSyncManual } from './routes/daily-stats-sync';
import { authMiddleware } from './middlewares/auth';
import {
  pathBlacklistMiddleware,
  rateLimitMiddleware
} from './middlewares/security';
import { logger } from './utils/logger';
import type { Env as DataSourceEnv } from './services/dataSources/types';

export interface Env extends DataSourceEnv {
  STORAGE?: R2Bucket;
  ENVIRONMENT?: string;
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
    origin: origin => {
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:8848',
        'http://127.0.0.1:8848',
        'https://admin.9shi.cc'
      ];

      // 允许固定域名
      if (allowedOrigins.includes(origin)) return origin;

      // 允许个人 CF Pages 预览域名
      if (origin?.endsWith('.pages.dev')) return origin;

      return allowedOrigins[0];
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
  const publicPaths = ['/admin/api/auth/login', '/admin/api/auth/refresh'];

  // 跳过公开路径
  if (publicPaths.includes(path)) {
    return await next();
  }

  // 跳过用户 API 路径（使用 API Key 认证）
  if (path.startsWith('/admin/api/v1/user')) {
    return await next();
  }

  // 其他所有 API 路径都需要验证 token
  return authMiddleware(c, next);
});

// 根路径 - 最小化信息暴露
app.get('/', c => {
  return c.json({ status: 'ok' });
});

// 动态路由配置
app.get('/api/get-async-routes', authMiddleware, c => {
  const permissionRouter = {
    path: '/permission',
    meta: {
      title: '权限管理',
      icon: 'ri/shield-keyhole-line',
      rank: 4,
      showLink: false // 完全隐藏权限管理菜单
    },
    children: [
      {
        path: '/permission/page/index',
        name: 'PermissionPage',
        meta: {
          title: '页面权限',
          roles: ['admin', 'common']
        }
      },
      {
        path: '/permission/button',
        meta: {
          title: '按钮权限',
          roles: ['admin', 'common']
        },
        children: [
          {
            path: '/permission/button/router',
            component: 'permission/button/index',
            name: 'PermissionButtonRouter',
            meta: {
              title: '路由返回按钮权限',
              auths: [
                'permission:btn:add',
                'permission:btn:edit',
                'permission:btn:delete'
              ]
            }
          },
          {
            path: '/permission/button/login',
            component: 'permission/button/perms',
            name: 'PermissionButtonLogin',
            meta: {
              title: '登录接口返回按钮权限'
            }
          }
        ]
      }
    ]
  };

  return c.json({
    success: true,
    data: [permissionRouter]
  });
});

// 路由
app.route('/api/auth', authRoutes);
app.route('/api/files', fileRoutes);
app.route('/api/products', productRoutes);
app.route('/api/data-reports', dataReportRoutes);
app.route('/api/users', userRoutes);

// 用户API路由（使用API Key认证）
app.route('/api/v1/user', userApiRoutes);

// API Key管理路由（使用JWT认证，仅超级管理员）
app.route('/api/api-keys', apiKeyRoutes);

// 每日数据统计路由（SSE流式接口，仅超级管理员）
app.get('/api/daily-stats/stream', authMiddleware, async c => {
  return handleDailyStatsStream(c.req.raw, c.env);
});

// 历史数据查询接口（仅超级管理员）
app.get('/api/daily-stats/history', authMiddleware, async c => {
  return handleDailyStatsHistory(c.req.raw, c.env);
});

// 手动触发保存接口（仅超级管理员）
app.post('/api/daily-stats/save-manual', authMiddleware, async c => {
  return handleDailyStatsSaveManual(c.req.raw, c.env);
});

// 手动触发同步接口（仅超级管理员，用于测试/补跑）
app.post('/api/daily-stats/sync-manual', authMiddleware, async c => {
  return handleDailyStatsSyncManual(c.req.raw, c.env);
});

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

// Cloudflare Workers导出（支持fetch和scheduled事件）
export default {
  fetch: app.fetch,

  // 定时任务：
  // - UTC 00:00（北京时间08:00）：保存前一天每日数据统计到 D1，并同步到报告编辑页
  // - UTC 16:00（北京时间00:00）：清理 draft 数据
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const cron = event.cron;

    // UTC 00:00 - 保存前一天每日数据统计（mock：跳过第三方数据源调用）
    if (cron === '0 0 * * *') {
      logger.info('Daily stats save task skipped (mock mode)');
      return;
    }

    // UTC 16:00 - 清理昨天及之前的 draft 数据
    if (cron === '0 16 * * *') {
      try {
        logger.info('Auto-cleanup task started');

        const db = env.DB;
        if (!db) {
          logger.error('DB not available');
          return;
        }

        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        logger.info(`Cleaning draft records with date <= ${yesterdayStr}`);

        const result = await db
          .prepare(
            `
          DELETE FROM data_reports
          WHERE status = 'draft' AND date <= ?
        `
          )
          .bind(yesterdayStr)
          .run();

        logger.info(
          `Auto-cleanup completed: deleted ${result.meta.changes} draft records`
        );
      } catch (error) {
        logger.error('Auto-cleanup task failed', error);
      }
    }
  }
};
