/**
 * 🔄 自维护声明：本文件更新后，请更新本注释 + ./README.md
 *
 * @input  - 无（使用系统时间）或 ISO 时间字符串
 * @output - getCurrentShanghaiTime(): 返回东八区 ISO 时间字符串 (YYYY-MM-DDTHH:mm:ss)
 *          - getBeijingTime(): 返回北京时间字符串 (YYYY-MM-DD HH:mm:ss)
 *          - toBeijingTime(isoString): 将 ISO 时间转换为北京时间字符串
 * @pos    - 时区工具层，解决 Cloudflare Workers 跨时区部署问题，被所有需要时间戳的模块依赖
 */

/**
 * 获取当前上海时区的 ISO 格式时间
 * @returns ISO 8601 格式的日期时间字符串 (YYYY-MM-DDTHH:mm:ss)
 *
 * @example
 * getCurrentShanghaiTime() // "2025-11-18T15:30:45"
 */
export const getCurrentShanghaiTime = (): string => {
  return new Date()
    .toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' })
    .replace(' ', 'T');
};

/**
 * 获取当前北京时间（格式：YYYY-MM-DD HH:mm:ss）
 * @returns 北京时间字符串
 *
 * @example
 * getBeijingTime() // "2026-01-29 14:30:45"
 */
export const getBeijingTime = (): string => {
  return new Date()
    .toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
};

/**
 * 将 ISO 时间字符串转换为北京时间（格式：YYYY-MM-DD HH:mm:ss）
 * @param isoString ISO 格式时间字符串（如 "2026-01-29T06:55:20.946Z"）
 * @returns 北京时间字符串
 *
 * @example
 * toBeijingTime("2026-01-29T06:55:20.946Z") // "2026-01-29 14:55:20"
 */
export const toBeijingTime = (isoString: string): string => {
  return new Date(isoString)
    .toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
};
