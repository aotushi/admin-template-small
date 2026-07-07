/**
 * API Key 生成工具
 * 用于生成安全的 UUID 格式 API Key
 */

/**
 * 生成 UUID v4 格式的 API Key
 * @returns {string} UUID 格式的 API Key
 */
export function generateApiKey(): string {
  return crypto.randomUUID();
}

/**
 * 验证 API Key 格式是否正确
 * @param {string} apiKey - 要验证的 API Key
 * @returns {boolean} 是否为有效的 UUID 格式
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(apiKey);
}
