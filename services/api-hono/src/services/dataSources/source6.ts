/**
 * 数据来源6插件 - Gmail CSV 附件
 *
 * Input: 日期参数
 * Output: 域名级广告数据（UrlData[]，无国家维度）
 * Pos: backend/src/services/dataSources/source6.ts
 *
 * 🔄 自维护：修改数据来源6逻辑时，必须更新本文件
 *
 * 版本2实现（2026-03-05）：
 * - 处理时间窗口内所有邮件的所有 CSV 附件
 * - 只处理单日数据文件（日期列只有一个唯一值）
 * - 跳过多日汇总文件（避免数据重复）
 * - 合并所有单日文件的数据
 *
 * 邮件筛选规则：
 * - 发件人: admanager-noreply@google.com
 * - 时间: 数据日期的次日北京时间 00:00-09:00 内收到的邮件（Google 次日发送前一天的报告）
 * - 附件: CSV / XLSX / XLS 文件
 */

import type { DataSource, FetchParams, Env, UrlData, CountryData } from './types';

// Gmail API 响应类型
interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailListResponse {
  messages?: GmailMessage[];
  nextPageToken?: string;
}

interface GmailMessageDetail {
  id: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    parts?: GmailPart[];
    body?: { data?: string; attachmentId?: string; size: number };
    mimeType: string;
  };
}

interface GmailPart {
  partId: string;
  mimeType: string;
  filename: string;
  body: {
    attachmentId?: string;
    data?: string;
    size: number;
  };
  parts?: GmailPart[];
}

interface GmailAttachment {
  data: string; // base64url 编码
  size: number;
}

// CSV 解析后的行数据
interface CsvRow {
  date: string;
  domain: string;
  adxRevenue: number;
  adxRequests: number;
  adxImpressions: number;
  adxEcpm: number;
  adxCtr: number;
  adxClicks: number;
  adxFillRate: number;
}

/**
 * 获取 OAuth2 access_token（使用 refresh_token）
 */
async function getAccessToken(env: Env): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.SOURCE6_CLIENT_ID,
      client_secret: env.SOURCE6_CLIENT_SECRET,
      refresh_token: env.SOURCE6_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gmail OAuth2 刷新 token 失败: ${err}`);
  }

  const data: { access_token: string } = await response.json();
  return data.access_token;
}

/**
 * 搜索时间窗口内的所有候选邮件 ID（按时间倒序）
 * 筛选条件：发件人 + has:attachment + 日期范围
 * 时间过滤：目标日期北京时间 00:00-09:00（UTC 前一天 16:00 - 当天 01:00）
 */
async function searchCandidateEmails(accessToken: string, date: string): Promise<string[]> {
  const nextDay = getNextDay(date);
  const query = `from:admanager-noreply@google.com has:attachment after:${date} before:${nextDay}`;
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Gmail 搜索邮件失败: ${response.status}`);
  }

  const data: GmailListResponse = await response.json();
  const messages = data.messages || [];
  if (messages.length === 0) return [];

  // 邮件在数据日期的次日北京时间 00:00-09:00 内收到
  // 例如数据日期 2026-02-26，邮件在 2026-02-27 06:00 北京时间收到
  const windowStart = new Date(`${nextDay}T00:00:00+08:00`);
  const windowEnd = new Date(`${nextDay}T09:00:00+08:00`);

  const candidates: Array<{ id: string; internalDate: number }> = [];

  for (const msg of messages) {
    const detail = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!detail.ok) continue;
    const meta: { id: string; internalDate: string } = await detail.json();
    const ts = parseInt(meta.internalDate);
    if (ts >= windowStart.getTime() && ts <= windowEnd.getTime()) {
      candidates.push({ id: msg.id, internalDate: ts });
    }
  }

  candidates.sort((a, b) => b.internalDate - a.internalDate);
  return candidates.map(c => c.id);
}

/**
 * 获取邮件详情
 */
async function getMessageDetail(accessToken: string, messageId: string): Promise<GmailMessageDetail> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Gmail 获取邮件详情失败: ${response.status}`);
  }

  return response.json();
}

/**
 * 将 base64url 解码为 UTF-8 字符串
 */
function decodeBase64Utf8(base64url: string): string {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * 下载附件内容
 */
async function getAttachment(accessToken: string, messageId: string, attachmentId: string): Promise<string> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Gmail 下载附件失败: ${response.status}`);
  }

  const data: GmailAttachment = await response.json();
  return decodeBase64Utf8(data.data);
}

/**
 * 从邮件中提取所有 CSV/XLSX/XLS 附件内容
 * 返回附件内容数组
 */
async function extractAllCsvsFromMessage(accessToken: string, message: GmailMessageDetail): Promise<string[]> {
  const parts = flattenParts(message.payload.parts || []);

  const SUPPORTED_MIME = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ];
  const SUPPORTED_EXT = ['.csv', '.xlsx', '.xls'];

  const csvContents: string[] = [];

  for (const part of parts) {
    const isSupportedMime = SUPPORTED_MIME.includes(part.mimeType);
    const isSupportedExt = SUPPORTED_EXT.some(ext => part.filename?.toLowerCase().endsWith(ext));

    if (isSupportedMime || isSupportedExt) {
      try {
        let content: string | null = null;
        if (part.body.attachmentId) {
          content = await getAttachment(accessToken, message.id, part.body.attachmentId);
        } else if (part.body.data) {
          content = decodeBase64Utf8(part.body.data);
        }
        if (content) {
          csvContents.push(content);
        }
      } catch (error) {
        console.error(`source6: 提取附件失败 (${part.filename}):`, error);
      }
    }
  }

  return csvContents;
}

/**
 * 递归展开 MIME parts
 */
function flattenParts(parts: GmailPart[]): GmailPart[] {
  const result: GmailPart[] = [];
  for (const part of parts) {
    result.push(part);
    if (part.parts) {
      result.push(...flattenParts(part.parts));
    }
  }
  return result;
}

/**
 * 解析 CSV 内容
 * - 按表头名称匹配列，不依赖列顺序
 * - 日期格式：MM/DD/YYYY
 * - 编码：处理 UTF-8 BOM
 * - 支持"网站"或"域名"列名
 */
function parseCsv(csvContent: string, targetDate: string): CsvRow[] {
  // 去除 UTF-8 BOM（\uFEFF）
  const content = csvContent.replace(/^\uFEFF/, '');

  // 支持 \r\n 和 \n
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return [];

  // 解析表头，建立列名 → 索引映射
  const headers = parseCsvLine(lines[0]);
  const col = (name: string) => headers.findIndex(h => h.trim() === name);

  const idxDate       = col('日期');
  const idxDomain     = col('网站') !== -1 ? col('网站') : col('域名'); // 兼容两种列名
  const idxRevenue    = col('Ad Exchange 收入');
  const idxRequests   = col('Ad Exchange 请求总数');
  const idxImpressions = col('Ad Exchange 展示次数');
  const idxEcpm       = col('Ad Exchange 平均 eCPM');
  const idxCtr        = col('Ad Exchange 点击率');
  const idxClicks     = col('Ad Exchange 点击次数');
  const idxFillRate   = col('Ad Exchange 匹配率');

  // 必要列缺失时报错
  if (idxDate === -1 || idxDomain === -1) {
    console.error('source6 CSV 表头不匹配，找不到日期或网站/域名列。表头:', headers);
    return [];
  }

  const rows: CsvRow[] = [];

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);

    // 日期格式 MM/DD/YYYY → YYYY-MM-DD
    const rawDate = cols[idxDate]?.trim() || '';
    const normalizedDate = normalizeDateMDY(rawDate);
    if (normalizedDate !== targetDate) continue;

    // 跳过"合计"行
    const domain = cols[idxDomain]?.trim() || '';
    if (domain === '合计' || domain === '') continue;

    rows.push({
      date: targetDate,
      domain,
      adxRevenue:     idxRevenue     !== -1 ? parseNumber(cols[idxRevenue])     : 0,
      adxRequests:    idxRequests    !== -1 ? parseNumber(cols[idxRequests])    : 0,
      adxImpressions: idxImpressions !== -1 ? parseNumber(cols[idxImpressions]) : 0,
      adxEcpm:        idxEcpm        !== -1 ? parseNumber(cols[idxEcpm])        : 0,
      adxCtr:         idxCtr         !== -1 ? parseNumber(cols[idxCtr]) * 100   : 0,  // 小数转百分比
      adxClicks:      idxClicks      !== -1 ? parseNumber(cols[idxClicks])      : 0,
      adxFillRate:    idxFillRate    !== -1 ? parseNumber(cols[idxFillRate]) * 100 : 0, // 小数转百分比
    });
  }

  return rows;
}

/**
 * 解析单行 CSV（处理引号包裹的字段）
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * 标准化日期格式为 YYYY-MM-DD
 * 支持：YYYY-MM-DD、MM/DD/YYYY、YYYY/MM/DD、M/D/YYYY 等常见格式
 */
function normalizeDateMDY(dateStr: string): string {
  if (!dateStr) return '';
  const s = dateStr.trim();
  // 已经是 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // MM/DD/YYYY 或 M/D/YYYY
  const mdyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // YYYY/MM/DD
  const ymdMatch = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (ymdMatch) {
    return s.replace(/\//g, '-');
  }
  // 兜底：尝试 Date.parse，转为 YYYY-MM-DD（UTC）
  const ts = Date.parse(s);
  if (!isNaN(ts)) {
    return new Date(ts).toISOString().split('T')[0];
  }
  return s;
}

/**
 * 解析数字（去除逗号分隔符）
 */
function parseNumber(val: string): number {
  if (!val) return 0;
  return parseFloat(val.replace(/,/g, '')) || 0;
}

/**
 * 获取下一天的日期字符串（基于 UTC 日期计算，避免时区影响）
 */
function getNextDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + 1));
  return d.toISOString().split('T')[0];
}

/**
 * 将 CSV 行数据转换为 UrlData 格式（URL级聚合，无国家维度）
 */
function transformCsvRows(rows: CsvRow[], date: string): UrlData[] {
  // 按域名分组并聚合
  const domainMap = new Map<string, CsvRow[]>();
  for (const row of rows) {
    if (!row.domain) continue;
    const url = row.domain.startsWith('http') ? row.domain : `https://${row.domain}`;
    if (!domainMap.has(url)) domainMap.set(url, []);
    domainMap.get(url)!.push(row);
  }

  const result: UrlData[] = [];
  for (const [url, domainRows] of domainMap.entries()) {
    // 聚合所有行的数据
    let totalRequests = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalRevenue = 0;

    for (const row of domainRows) {
      totalRequests += row.adxRequests;
      totalImpressions += row.adxImpressions;
      totalClicks += row.adxClicks;
      totalRevenue += row.adxRevenue;
    }

    // 计算聚合后的比率
    const fillRate = totalRequests > 0 ? (totalImpressions / totalRequests) * 100 : 0;
    const impressionRate = totalRequests > 0 ? (totalImpressions / totalRequests) * 100 : 0;
    const clickRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const ecpm = totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : 0;

    // 构建 URL 级数据（无国家维度）
    const countryDetails: CountryData[] = [{
      country: '',  // 无国家维度
      dataSource: 'source6' as const,
      request: totalRequests,
      response: totalImpressions,  // source6 无 response 字段，用 impression 代替
      impression: totalImpressions,
      click: totalClicks,
      fillRate,
      impressionRate,
      clickRate,
      ecpm,
      revenue: totalRevenue
    }];

    result.push({ date, url, countryDetails });
  }

  return result;
}

/**
 * 检查 CSV 是否为单日数据文件
 * 解析所有行，检查日期列是否只有一个唯一值
 */
function isSingleDayFile(csvContent: string, targetDate: string): boolean {
  const content = csvContent.replace(/^\uFEFF/, '');
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return false;

  const headers = parseCsvLine(lines[0]);
  const idxDate = headers.findIndex(h => h.trim() === '日期');
  if (idxDate === -1) return false;

  const uniqueDates = new Set<string>();
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const rawDate = cols[idxDate]?.trim() || '';
    if (!rawDate || rawDate === '合计') continue;
    const normalizedDate = normalizeDateMDY(rawDate);
    uniqueDates.add(normalizedDate);
  }

  // 只有一个日期且等于目标日期
  return uniqueDates.size === 1 && uniqueDates.has(targetDate);
}

/**
 * 主数据获取函数（版本2）
 * 处理时间窗口内所有邮件的所有 CSV 附件
 * 只处理单日数据文件，跳过多日汇总文件
 */
async function fetchData(params: FetchParams, env: Env): Promise<UrlData[]> {
  const accessToken = await getAccessToken(env);
  const messageIds = await searchCandidateEmails(accessToken, params.date);

  if (messageIds.length === 0) {
    console.log(`source6: 未找到 ${params.date} 的邮件`);
    return [];
  }

  console.log(`source6: 找到 ${messageIds.length} 封候选邮件`);

  const allResults: UrlData[] = [];
  let processedCount = 0;
  let skippedCount = 0;

  // 遍历所有邮件
  for (const messageId of messageIds) {
    try {
      const message = await getMessageDetail(accessToken, messageId);
      const csvContents = await extractAllCsvsFromMessage(accessToken, message);

      if (csvContents.length === 0) {
        console.log(`source6: 邮件 ${messageId} 无 CSV 附件`);
        continue;
      }

      console.log(`source6: 邮件 ${messageId} 包含 ${csvContents.length} 个 CSV 附件`);

      // 处理每个 CSV 附件
      for (const csvContent of csvContents) {
        // 检查是否为单日数据文件
        if (!isSingleDayFile(csvContent, params.date)) {
          skippedCount++;
          console.log(`source6: 跳过多日汇总文件`);
          continue;
        }

        // 解析并转换数据
        const rows = parseCsv(csvContent, params.date);
        if (rows.length === 0) {
          console.log(`source6: CSV 无有效数据行`);
          continue;
        }

        const urlData = transformCsvRows(rows, params.date);
        allResults.push(...urlData);
        processedCount++;
        console.log(`source6: 处理单日文件，获得 ${urlData.length} 个 URL 数据`);
      }
    } catch (error) {
      console.error(`source6: 处理邮件 ${messageId} 失败:`, error);
    }
  }

  console.log(`source6: 完成，处理 ${processedCount} 个单日文件，跳过 ${skippedCount} 个多日文件，共 ${allResults.length} 个 URL 数据`);
  return allResults;
}

export const source6Plugin: DataSource = {
  id: 'source6',
  name: 'Gmail CSV',
  enabled: true,

  async fetchData(params: FetchParams, env: Env) {
    return await fetchData(params, env);
  },

  transformData(rawData: any): UrlData[] {
    // fetchData 已直接返回 UrlData[]，此处直接透传
    return rawData as UrlData[];
  }
};
