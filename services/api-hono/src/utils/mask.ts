/**
 * 数据脱敏工具函数
 *
 * Input: 原始字符串
 * Output: 部分字符替换为 ** 的脱敏字符串
 * Pos: backend/src/utils/mask.ts
 */

/**
 * 脱敏用户名
 * 保留首2位和末1位，中间替换为星号
 */
export function maskUsername(username: string): string {
  if (!username) return username;
  if (username.length <= 3) return username[0] + '**';
  const keep = Math.min(2, Math.floor(username.length / 3));
  return username.slice(0, keep) + '**' + username.slice(-1);
}

/**
 * 脱敏邮箱
 * 本地部分保留首2位，域名部分保留首2位和后缀
 */
export function maskEmail(email: string): string {
  if (!email) return email;
  const atIdx = email.indexOf('@');
  if (atIdx < 0) return maskUsername(email);

  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);

  const maskedLocal =
    local.length <= 2 ? local[0] + '**' : local.slice(0, 2) + '**';

  const dotIdx = domain.lastIndexOf('.');
  if (dotIdx < 0) return maskedLocal + '@' + domain.slice(0, 2) + '*****';
  const domainName = domain.slice(0, dotIdx);
  const tld = domain.slice(dotIdx);
  const maskedDomain = domainName.slice(0, 2) + '*****';

  return maskedLocal + '@' + maskedDomain + tld;
}

/**
 * 脱敏 URL
 * 保留协议和域名首2位，路径各段保留首2位
 */
export function maskUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const hostParts = parsed.hostname.split('.');
    const maskedHost =
      hostParts[0].slice(0, 2) +
      '*****' +
      (hostParts.length > 1 ? '.' + hostParts.slice(-1)[0] : '');

    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    const maskedPath = pathSegments
      .map(seg => (seg.length <= 2 ? seg : seg.slice(0, 2) + '**'))
      .join('/');

    return (
      parsed.protocol + '//' + maskedHost + (maskedPath ? '/' + maskedPath : '')
    );
  } catch {
    // 非标准 URL，按普通字符串处理
    return url.slice(0, 4) + '*****';
  }
}
