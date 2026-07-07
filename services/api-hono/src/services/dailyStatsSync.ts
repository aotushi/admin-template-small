/**
 * 每日数据同步服务 - daily_stats → data_reports
 *
 * Input: 日期参数、Env（包含 D1 数据库）
 * Output: 写入 data_reports（产品级，status='draft'）和 raw_data（URL级明细）
 * Pos: backend/src/services/dailyStatsSync.ts
 *
 * 触发时机：UTC 01:00 Cron，在 fetchAndSaveDailyStats 完成后执行
 *
 * 业务逻辑：
 *   1. 从 daily_stats JOIN product_urls，获取每条 URL 对应的 product_id + user_id
 *   2. 按 (product_id, user_id) 聚合各指标（SUM），比率字段用聚合后分子/分母重算
 *   3. INSERT OR IGNORE 写入 data_reports（status='draft'）——不覆盖已有记录
 *   4. 写入 raw_data（URL 级明细，供报告编辑页展示 URL 详情）
 *   5. 未在 product_urls 注册的 URL 静默跳过（INNER JOIN 自然过滤）
 *   6. 零值产品无需处理——报告编辑页打开时会自动补全虚拟草稿
 *
 * 🔄 自维护：修改同步逻辑时，必须更新本文件头注释
 */

import { logger } from '../utils/logger';
import { truncateDecimal, normalizeUrl } from '../utils/data-processor';
import { getCurrentShanghaiTime } from '../utils/datetime';
import type { Env } from './dataSources/types';

export interface SyncResult {
  date: string;
  synced: number;       // 写入 data_reports 的产品数
  rawInserted: number;  // 写入 raw_data 的 URL 行数
  skipped: number;      // 未匹配 product_urls 的 URL 行数（日志用）
  error?: string;
}

interface MatchedRow {
  url: string;
  request: number;
  response: number;
  impression: number;
  click: number;
  revenue: number;
  product_id: number;
  user_id: number;
}

interface UrlEntry {
  url: string;
  requests: number;
  matches: number;
  impressions: number;
  clicks: number;
  revenue: number;
}

interface Group {
  product_id: number;
  user_id: number;
  requests: number;
  matches: number;
  impressions: number;
  clicks: number;
  revenue: number;
  urls: UrlEntry[];
}

/**
 * 将 daily_stats 指定日期的数据同步到 data_reports（草稿）及 raw_data（URL明细）
 */
export async function syncDailyStatsToReports(date: string, env: Env): Promise<SyncResult> {
  const db = env.DB;
  const now = getCurrentShanghaiTime();

  // 1. 获取超管用户 id（uploaded_by 字段需要有效的 user id）
  const superAdmin = await db
    .prepare(`SELECT id FROM users WHERE role = 'admin' AND admin_level = 'super' LIMIT 1`)
    .first<{ id: number }>();

  if (!superAdmin) {
    const msg = '未找到超管用户，跳过同步';
    logger.error(msg);
    return { date, synced: 0, rawInserted: 0, skipped: 0, error: msg };
  }
  const uploadedBy = superAdmin.id;

  // 2. 读取 daily_stats，INNER JOIN product_urls 拿到 product_id + user_id
  //    两侧 URL 均去掉协议前缀和末尾斜杠再比对，兼容两种存储格式：
  //      daily_stats.url   : "https://cookingame.com"（aggregation 写入，带协议）
  //      product_urls.url  : "cookingame.com"（管理员录入，可能无协议）
  //    同时通过 users 表匹配 username，确保多用户共享同一URL时数据不交叉
  const { results: matchedRows = [] } = await db
    .prepare(`
      SELECT
        ds.url,
        ds.request     AS request,
        ds.response    AS response,
        ds.impression  AS impression,
        ds.click       AS click,
        ds.revenue     AS revenue,
        pu.product_id,
        pu.user_id
      FROM daily_stats ds
      JOIN product_urls pu
        ON REPLACE(REPLACE(LOWER(TRIM(ds.url, '/')), 'https://', ''), 'http://', '')
         = REPLACE(REPLACE(LOWER(TRIM(pu.url, '/')), 'https://', ''), 'http://', '')
      JOIN users u ON pu.user_id = u.id AND u.username = ds.username
      WHERE ds.date = ?
    `)
    .bind(date)
    .all<MatchedRow>();

  // 统计未匹配行数（仅用于日志）
  const totalResult = await db
    .prepare(`SELECT COUNT(*) AS cnt FROM daily_stats WHERE date = ?`)
    .bind(date)
    .first<{ cnt: number }>();
  const totalCount = totalResult?.cnt ?? 0;
  const skipped = totalCount - matchedRows.length;

  if (matchedRows.length === 0) {
    logger.info(`syncDailyStatsToReports: no matched rows for date=${date}, total=${totalCount}, skipped=${skipped}`);
    return { date, synced: 0, rawInserted: 0, skipped };
  }

  // 3. 按 (product_id, user_id) 聚合
  const groups = new Map<string, Group>();

  for (const row of matchedRows) {
    const key = `${row.product_id}_${row.user_id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        product_id: row.product_id,
        user_id: row.user_id,
        requests: 0,
        matches: 0,
        impressions: 0,
        clicks: 0,
        revenue: 0,
        urls: [],
      });
    }
    const g = groups.get(key)!;
    g.requests   += row.request;
    g.matches    += row.response;
    g.impressions += row.impression;
    g.clicks     += row.click;
    g.revenue    += row.revenue;
    g.urls.push({
      url: row.url,
      requests:   row.request,
      matches:    row.response,
      impressions: row.impression,
      clicks:     row.click,
      revenue:    row.revenue,
    });
  }

  // 4. 逐组写入 data_reports，收集 raw_data 语句
  let synced = 0;
  let rawInserted = 0;
  const rawDataStatements: ReturnType<typeof db.prepare>[] = [];

  for (const [, g] of groups) {
    // 比率字段必须用聚合后的分子/分母重算，不能直接 SUM
    const match_rate = g.requests > 0
      ? truncateDecimal(g.matches / g.requests, 4)
      : '0.0000';
    const impression_rate = g.matches > 0
      ? truncateDecimal(g.impressions / g.matches, 4)
      : '0.0000';
    const ctr = g.impressions > 0
      ? truncateDecimal(g.clicks / g.impressions, 4)
      : '0.0000';
    const ecpm = g.impressions > 0
      ? truncateDecimal((g.revenue / g.impressions) * 1000, 2)
      : '0.00';
    const revenue = truncateDecimal(g.revenue, 2);

    // INSERT OR IGNORE：已有记录不覆盖
    // 正常情况下凌晨 Cron 已清空草稿，此处不会冲突
    const result = await db
      .prepare(`
        INSERT OR IGNORE INTO data_reports (
          date, product_id, user_id, status, uploaded_by,
          requests, matches, match_rate,
          impressions, impression_rate,
          clicks, ctr, ecpm, revenue,
          created_at, updated_at
        ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        date, g.product_id, g.user_id, uploadedBy,
        String(g.requests), String(g.matches), match_rate,
        String(g.impressions), impression_rate,
        String(g.clicks), ctr, ecpm, revenue,
        now, now
      )
      .run();

    if (result.meta.changes === 0) {
      // 记录已存在，跳过此组（raw_data 也不写，避免孤立数据）
      continue;
    }

    synced++;
    const reportId = result.meta.last_row_id as number;

    // 准备 raw_data 插入语句（URL 级明细）
    // 使用 normalizeUrl 去掉协议头，与 Excel 上传写入的格式保持一致（纯域名）
    for (const urlRow of g.urls) {
      const urlEcpm = urlRow.impressions > 0
        ? truncateDecimal((urlRow.revenue / urlRow.impressions) * 1000, 2)
        : '0.00';

      rawDataStatements.push(
        db.prepare(`
          INSERT INTO raw_data (
            date, report_id, url, user_id,
            requests, matches, impressions, clicks,
            ecpm, revenue, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          date, reportId, normalizeUrl(urlRow.url), g.user_id,
          String(urlRow.requests), String(urlRow.matches),
          String(urlRow.impressions), String(urlRow.clicks),
          urlEcpm, truncateDecimal(urlRow.revenue, 2), now
        )
      );
    }
  }

  // 5. 批量写入 raw_data（每批 50 条，避免超出 D1 单次限制）
  const BATCH_SIZE = 50;
  for (let i = 0; i < rawDataStatements.length; i += BATCH_SIZE) {
    const batch = rawDataStatements.slice(i, i + BATCH_SIZE);
    const results = await db.batch(batch);
    rawInserted += results.reduce((sum, r) => sum + (r.meta.changes || 0), 0);
  }

  logger.info(
    `syncDailyStatsToReports: date=${date}, synced=${synced}, rawInserted=${rawInserted}, skipped=${skipped}`
  );
  return { date, synced, rawInserted, skipped };
}
