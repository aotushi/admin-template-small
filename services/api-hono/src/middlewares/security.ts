/**
 * 安全中间件 - 防护恶意请求
 *
 * **Input**: HTTP请求
 * **Output**: 拦截恶意请求或放行正常请求
 * **Pos**: site66/backend/src/middlewares/security.ts
 *
 * ## 防护措施
 * 1. 敏感路径黑名单 - 拦截探测 .env, credentials 等文件的请求
 * 2. 简单内存限流 - 防止单个 IP 短时间大量请求
 * 3. 可疑请求日志 - 记录攻击来源便于分析
 */

import { AUTH_ERROR_CODES } from '@admin-backend-3/admin-api-contract/auth';
import { Context, Next } from 'hono';
import { logger } from '../utils/logger';

// 敏感路径黑名单
const BLOCKED_PATTERNS = [
  // 敏感文件
  /\.(env|git|credentials|secrets|config|key|pem|crt)$/i,
  /\.(bak|backup|old|tmp|swp|save)$/i,

  // 配置文件
  /\/(\.git|\.svn|\.hg|\.DS_Store)/i,
  /\/(\.htaccess|\.htpasswd|web\.config)/i,

  // 敏感目录
  /\/(phpmyadmin|wp-admin|wp-content|wp-includes)/i,

  // PHP/JSP等非项目技术栈
  /\.(php|asp|aspx|jsp|cgi)$/i
];

// 简单的内存限流（重启会重置）
const requestCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * 路径黑名单中间件
 */
export function pathBlacklistMiddleware() {
  return async (c: Context, next: Next) => {
    const path = c.req.path;

    // 检查是否匹配黑名单
    const isBlocked = BLOCKED_PATTERNS.some(pattern => pattern.test(path));

    if (isBlocked) {
      const ip = c.req.header('CF-Connecting-IP') || 'unknown';
      const userAgent = c.req.header('User-Agent') || 'unknown';

      // 记录可疑请求
      logger.warn('Blocked suspicious request', {
        ip,
        path,
        userAgent: userAgent.substring(0, 100), // 限制长度
        timestamp: new Date().toISOString()
      });

      // 返回通用 404，不暴露具体原因
      return c.json({ error: 'Not Found' }, 404);
    }

    await next();
  };
}

/**
 * 简单限流中间件（基于内存）
 * 注意：Worker 实例重启会重置计数，适合轻量级防护
 * 如需持久化限流，应使用 Cloudflare KV
 */
export function rateLimitMiddleware(
  options: {
    windowMs?: number; // 时间窗口（毫秒）
    maxRequests?: number; // 最大请求数
  } = {}
) {
  const windowMs = options.windowMs || 60000; // 默认1分钟
  const maxRequests = options.maxRequests || 100; // 默认100次/分钟

  return async (c: Context, next: Next) => {
    const ip =
      c.req.header('CF-Connecting-IP') ||
      c.req.header('X-Forwarded-For') ||
      'unknown';

    // 跳过健康检查等路径
    if (c.req.path === '/health' || c.req.path === '/') {
      return await next();
    }

    // 定期清理过期记录
    maybeCleanupRecords();

    const now = Date.now();
    const record = requestCounts.get(ip);

    // 清理过期记录
    if (record && now > record.resetTime) {
      requestCounts.delete(ip);
    }

    // 获取或初始化计数
    const current = requestCounts.get(ip) || {
      count: 0,
      resetTime: now + windowMs
    };

    // 检查是否超限
    if (current.count >= maxRequests) {
      const retryAfter = Math.ceil((current.resetTime - now) / 1000);
      logger.warn('Rate limit exceeded', {
        ip,
        count: current.count,
        limit: maxRequests,
        path: c.req.path
      });

      c.header('Retry-After', String(retryAfter));

      return c.json(
        {
          code: AUTH_ERROR_CODES.tooManyRequests,
          error: 'Too Many Requests',
          retryAfter,
          success: false
        },
        429
      );
    }

    // 增加计数
    current.count++;
    requestCounts.set(ip, current);

    await next();
  };
}

/**
 * 清理过期的限流记录（避免内存泄漏）
 * 注意：改为在每次请求时触发，而非使用 setInterval（Workers 不支持全局定时器）
 */
function cleanupExpiredRecords() {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(ip);
    }
  }
}

// 每 100 次请求触发一次清理（避免每次请求都清理）
let requestCounter = 0;
export function maybeCleanupRecords() {
  requestCounter++;
  if (requestCounter % 100 === 0) {
    cleanupExpiredRecords();
  }
}
