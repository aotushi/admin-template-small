/**
 * 🔄 自维护声明：本文件更新后，请更新本注释 + ./README.md
 *
 * @input  - url: 原始URL字符串，db: DatabaseWrapper 数据库实例
 * @output - normalizeUrl(): URL标准化函数，processData(): 数据处理函数
 * @pos    - 数据处理工具层，用于URL标准化和数据转换，被 router 层调用
 */

import { DatabaseWrapper } from '../models/database';

/**
 * URL标准化函数
 * 统一URL格式以便准确比对
 *
 * @param url 原始URL
 * @returns 标准化后的URL（提取域名+路径，去除协议、参数、锚点，小写，去除尾部斜杠）
 *
 * @example
 * normalizeUrl('https://example.com/') // 'example.com'
 * normalizeUrl('HTTP://Example.com/path') // 'example.com/path'
 * normalizeUrl('https:/example.com/') // 'example.com'
 * normalizeUrl('://example.com') // 'example.com'
 * normalizeUrl('/example.com') // 'example.com'
 * normalizeUrl(':b.example.com') // 'b.example.com'
 * normalizeUrl('htt:/example.com') // 'example.com'
 * normalizeUrl('example.com/page?id=123#section') // 'example.com/page'
 */
export function normalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return url;
  }

  let normalized = url.trim();

  // 1. 转换为小写
  normalized = normalized.toLowerCase();

  // 2. 去除查询参数和锚点
  normalized = normalized.split('?')[0].split('#')[0];

  // 3. 查找并提取合法域名及之后的内容（域名特征：至少包含一个点，由字母数字连字符组成）
  // 匹配格式：xxx.xxx 或 xxx.xxx.xxx/path 等
  const domainMatch = normalized.match(/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+([\/\:].*)?/);

  if (domainMatch) {
    normalized = domainMatch[0];
  }

  // 4. 去除尾部斜杠
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * 小数截断函数（不四舍五入）
 * @param value 原始数值
 * @param decimals 保留的小数位数
 * @returns 截断后的字符串
 *
 * @example
 * truncateDecimal(1.236, 2) // "1.23"
 * truncateDecimal(1.2, 2)   // "1.20"
 * truncateDecimal(0.9999, 4) // "0.9999"
 */
export function truncateDecimal(value: number, decimals: number): string {
  if (isNaN(value) || !isFinite(value)) {
    return '0.' + '0'.repeat(decimals);
  }

  const factor = Math.pow(10, decimals);
  const truncated = Math.floor(value * factor) / factor;
  return truncated.toFixed(decimals);
}

/**
 * 验证URL是否已配置
 * @param urls URL列表
 * @param db 数据库实例
 * @returns 未配置的URL列表
 */
export async function validateUrls(urls: string[], db: DatabaseWrapper): Promise<string[]> {
  if (urls.length === 0) {
    return [];
  }

  // 标准化并去重
  const normalizedUrls = urls.map(url => normalizeUrl(url));
  const uniqueUrls = Array.from(new Set(normalizedUrls));

  // 查询已配置的URL（数据库中的URL也需要标准化后比对）
  const allConfiguredUrls = await db.all(`SELECT url FROM product_urls`);
  const configuredUrlSet = new Set(
    allConfiguredUrls.map((r: any) => normalizeUrl(r.url))
  );

  // 返回未配置的URL（返回原始格式以便前端显示）
  const unmatchedNormalized = uniqueUrls.filter(url => !configuredUrlSet.has(url));

  // 找回原始URL格式
  const urlMap = new Map<string, string>();
  for (let i = 0; i < urls.length; i++) {
    const normalized = normalizedUrls[i];
    if (!urlMap.has(normalized)) {
      urlMap.set(normalized, urls[i]);
    }
  }

  return unmatchedNormalized.map(normalized => urlMap.get(normalized) || normalized);
}

/**
 * 获取URL到产品的映射关系（包含用户信息）
 * @param urls URL列表
 * @param db 数据库实例
 * @returns URL到产品ID、产品名称和用户ID的映射 Map<url, {productId, productName, userId}>
 */
export async function getUrlProductMapping(
  urls: string[],
  db: DatabaseWrapper
): Promise<Map<string, { productId: number; productName: string; userId: number }>> {
  if (urls.length === 0) {
    return new Map();
  }

  // 标准化URL
  const normalizedUrls = urls.map(url => normalizeUrl(url));
  const uniqueNormalizedUrls = Array.from(new Set(normalizedUrls));

  // 获取所有产品URL（包含 user_id）
  const allMappings = await db.all(
    `SELECT pu.url, pu.product_id, pu.user_id, p.name as product_name
     FROM product_urls pu
     JOIN products p ON pu.product_id = p.id`
  );

  const map = new Map<string, { productId: number; productName: string; userId: number }>();

  // 标准化后比对
  for (const mapping of allMappings) {
    const normalizedDbUrl = normalizeUrl(mapping.url);

    // 检查这个标准化的数据库URL是否在我们的查询列表中
    if (uniqueNormalizedUrls.includes(normalizedDbUrl)) {
      // 使用标准化后的URL作为key（保证一致性）
      map.set(normalizedDbUrl, {
        productId: mapping.product_id,
        productName: mapping.product_name,
        userId: mapping.user_id
      });
    }
  }

  // 为原始URL创建映射（指向标准化URL的映射）
  const finalMap = new Map<string, { productId: number; productName: string; userId: number }>();

  for (let i = 0; i < urls.length; i++) {
    const originalUrl = urls[i];
    const normalizedUrl = normalizedUrls[i];

    if (map.has(normalizedUrl)) {
      finalMap.set(originalUrl, map.get(normalizedUrl)!);
    }
  }

  return finalMap;
}

/**
 * 原始数据行接口
 */
export interface RawDataRow {
  date: string;
  url: string;
  requests: number;
  matches: number;
  impressions: number;
  clicks: number;
  revenue: number;
}

/**
 * 聚合后的产品数据接口
 */
export interface AggregatedProductData {
  date: string;
  productId: number;
  productName: string;
  userId: number;              // 新增：用户ID
  requests: number;
  matches: number;
  match_rate: string;
  impressions: number;
  impression_rate: string;
  clicks: number;
  ctr: string;
  ecpm: string;
  revenue: string;
}

/**
 * 按产品和日期分组聚合数据
 * @param rows 原始数据行
 * @param urlMapping URL到产品的映射
 * @returns 聚合后的产品数据数组
 */
export function groupByProduct(
  rows: RawDataRow[],
  urlMapping: Map<string, { productId: number; productName: string; userId: number }>
): AggregatedProductData[] {
  // 按 date + productId + userId 分组
  const groupMap = new Map<string, {
    date: string;
    productId: number;
    productName: string;
    userId: number;
    requests: number;
    matches: number;
    impressions: number;
    clicks: number;
    revenue: number;
  }>();

  for (const row of rows) {
    const mapping = urlMapping.get(row.url);
    if (!mapping) {
      continue; // 跳过未配置的URL
    }

    const key = `${row.date}_${mapping.productId}_${mapping.userId}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        date: row.date,
        productId: mapping.productId,
        productName: mapping.productName,
        userId: mapping.userId,
        requests: 0,
        matches: 0,
        impressions: 0,
        clicks: 0,
        revenue: 0
      });
    }

    const group = groupMap.get(key)!;

    // 累加原始值
    group.requests += row.requests;
    group.matches += row.matches;
    group.impressions += row.impressions;
    group.clicks += row.clicks;
    group.revenue += row.revenue;
  }

  // 计算衍生指标并截断小数
  const result: AggregatedProductData[] = [];

  for (const group of groupMap.values()) {
    // 计算 Match Rate = Matches / Requests (保留4位小数)
    const matchRate = group.requests > 0
      ? truncateDecimal(group.matches / group.requests, 4)
      : '0.0000';

    // 计算 Impression Rate = Impressions / Matches (保留4位小数)
    const impressionRate = group.matches > 0
      ? truncateDecimal(group.impressions / group.matches, 4)
      : '0.0000';

    // 计算 CTR = Clicks / Impressions (保留4位小数)
    const ctr = group.impressions > 0
      ? truncateDecimal(group.clicks / group.impressions, 4)
      : '0.0000';

    // 计算 eCPM = (Revenue / Impressions) * 1000 (保留2位小数)
    const calculatedEcpm = group.impressions > 0
      ? (group.revenue / group.impressions) * 1000
      : 0;
    const ecpm = truncateDecimal(calculatedEcpm, 2);

    // 用 truncate 后的 eCPM 重新计算 Revenue，确保前后端一致
    // 这样前端编辑后恢复时，计算结果才能完全相同
    const ecpmNumber = parseFloat(ecpm);
    const recalculatedRevenue = group.impressions > 0 && ecpmNumber > 0
      ? (group.impressions / 1000) * ecpmNumber
      : 0;
    const revenue = truncateDecimal(recalculatedRevenue, 2);

    result.push({
      date: group.date,
      productId: group.productId,
      productName: group.productName,
      userId: group.userId,
      requests: group.requests,
      matches: group.matches,
      match_rate: matchRate,
      impressions: group.impressions,
      impression_rate: impressionRate,
      clicks: group.clicks,
      ctr: ctr,
      ecpm: ecpm,
      revenue: revenue
    });
  }

  return result;
}

/**
 * 解析日期字符串为标准格式 YYYY-MM-DD
 * 支持多种日期格式：
 * - "9月15" -> "2025-09-15" (需要传入年份)
 * - "08/22/2025" -> "2025-08-22" (四位年份)
 * - "1/12/26" -> "2026-01-12" (两位年份，00-49为20xx，50-99为19xx)
 * - "2025-08-22" -> "2025-08-22"
 *
 * @param dateStr 日期字符串
 * @param defaultYear 默认年份（用于"9月15"这种格式）
 * @returns 标准格式日期字符串 YYYY-MM-DD
 */
export function parseDate(dateStr: string, defaultYear: number = new Date().getFullYear()): string {
  if (!dateStr || typeof dateStr !== 'string') {
    return '';
  }

  const trimmed = dateStr.trim();

  // 格式1: "9月15" -> "2025-09-15"
  const chineseMatch = trimmed.match(/^(\d{1,2})月(\d{1,2})$/);
  if (chineseMatch) {
    const month = chineseMatch[1].padStart(2, '0');
    const day = chineseMatch[2].padStart(2, '0');
    return `${defaultYear}-${month}-${day}`;
  }

  // 格式2: "08/22/2025" -> "2025-08-22" (四位年份)
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 格式3: "1/12/26" -> "2026-01-12" (两位年份)
  // Excel解析时可能会将 "01/12/2026" 格式化为 "1/12/26"
  const slashMatch2 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slashMatch2) {
    const month = slashMatch2[1].padStart(2, '0');
    const day = slashMatch2[2].padStart(2, '0');
    const yearTwoDigit = parseInt(slashMatch2[3]);
    // 将两位年份转换为四位年份
    // 00-49 -> 2000-2049
    // 50-99 -> 1950-1999
    const year = yearTwoDigit < 50 ? 2000 + yearTwoDigit : 1900 + yearTwoDigit;
    return `${year}-${month}-${day}`;
  }

  // 格式4: "2025-08-22" (已经是标准格式)
  const standardMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
  if (standardMatch) {
    return trimmed;
  }

  // 无法解析，返回空字符串
  return '';
}
