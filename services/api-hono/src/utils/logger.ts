/**
 * 🔄 自维护声明：本文件更新后，请更新本注释 + ../README.md
 *
 * @input  - env: 环境变量（production/development）用于控制日志级别
 * @output - logger: 单例日志对象，提供 debug/info/warn/error 方法
 * @pos    - 系统基础设施层，被所有业务模块依赖，用于统一日志记录和敏感信息过滤
 */

/**
 * 日志级别
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 日志上下文对象
 */
interface LogContext {
  [key: string]: any;
}

/**
 * 结构化日志类
 * 自动过滤敏感信息，根据环境控制日志输出
 */
class Logger {
  /**
   * 判断是否应该输出该级别的日志
   */
  private shouldLog(level: LogLevel, env?: string): boolean {
    const environment = env || 'development';

    // 生产环境只输出 error 和 warn
    if (environment === 'production') {
      return level === 'error' || level === 'warn';
    }

    // 开发环境输出所有日志
    return true;
  }

  /**
   * 过滤敏感字段
   * 自动将密码、token、secret 等字段替换为 ***REDACTED***
   */
  private sanitize(context: LogContext): LogContext {
    if (!context || typeof context !== 'object') {
      return context;
    }

    const sanitized = { ...context };
    const sensitiveKeys = ['password', 'token', 'secret', 'hash', 'authorization', 'api_key', 'apikey'];

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();

      // 检查键名是否包含敏感关键词
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '***REDACTED***';
      }
      // 递归处理嵌套对象
      else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * 格式化错误对象
   */
  private formatError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    return error;
  }

  /**
   * Debug 级别日志（仅开发环境）
   */
  debug(message: string, context?: LogContext, env?: string) {
    if (this.shouldLog('debug', env)) {
      const sanitizedContext = context ? this.sanitize(context) : '';
      console.log(`[DEBUG] ${message}`, sanitizedContext);
    }
  }

  /**
   * Info 级别日志
   */
  info(message: string, context?: LogContext, env?: string) {
    if (this.shouldLog('info', env)) {
      const sanitizedContext = context ? this.sanitize(context) : '';
      console.log(`[INFO] ${message}`, sanitizedContext);
    }
  }

  /**
   * Warning 级别日志
   */
  warn(message: string, context?: LogContext, env?: string) {
    if (this.shouldLog('warn', env)) {
      const sanitizedContext = context ? this.sanitize(context) : '';
      console.warn(`[WARN] ${message}`, sanitizedContext);
    }
  }

  /**
   * Error 级别日志
   * @param message 错误消息
   * @param error 错误对象（可选）
   * @param context 额外上下文（可选）
   * @param env 环境（可选，默认从 process.env 获取）
   */
  error(message: string, error?: any, context?: LogContext, env?: string) {
    if (this.shouldLog('error', env)) {
      const errorInfo = error ? this.formatError(error) : undefined;
      const sanitizedContext = context ? this.sanitize(context) : {};

      console.error(`[ERROR] ${message}`, {
        error: errorInfo,
        ...sanitizedContext
      });
    }
  }
}

/**
 * 导出单例 logger 实例
 */
export const logger = new Logger();
