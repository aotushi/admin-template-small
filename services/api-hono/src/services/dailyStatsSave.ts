/**
 * 每日数据统计保存服务
 *
 * Input: 日期参数、聚合后的应用数据
 * Output: 写入 D1 daily_stats 表（URL级）
 * Pos: backend/src/services/dailyStatsSave.ts
 *
 * 🔄 自维护：修改保存逻辑时，必须更新本文件
 */

import type { Env } from "./dataSources/types";
import { dataSourceManager } from "./dataSources/manager";
import { mergeUrlData, aggregateByApp, aggregateUrlData, calculateRates } from "./aggregation";

/**
 * 从数据库获取所有用户列表（排除测试用户和管理员）
 */
async function getUserList(env: Env): Promise<string[]> {
  const result = await env.DB.prepare(
    `SELECT username FROM users
     WHERE role != 'admin'
     AND username NOT LIKE '%test%'
     AND username != 'huagezi'
     ORDER BY id`
  ).all();
  return result.results.map((row: any) => row.username);
}

export interface SaveResult {
  date: string;
  inserted: number;
  skipped: number;
  error?: string;
}

/**
 * 拉取指定日期的数据并保存到 D1
 * @param date 日期 YYYY-MM-DD
 * @param env Cloudflare Workers 环境
 * @param force true 时使用 INSERT OR REPLACE 覆盖已有数据
 */
export async function fetchAndSaveDailyStats(date: string, env: Env, force = false): Promise<SaveResult> {
  // 步骤1: 获取用户列表
  const users = await getUserList(env);

  // 步骤2: 获取应用URL映射
  const appMappings = await dataSourceManager.fetchSource2Data({ date, users }, env);

  // 步骤3: 并行拉取所有数据源
  const [source1Data, source3Data, source4Data, source5Data, source6Data] = await Promise.allSettled([
    dataSourceManager.fetchSource1Data({ date }, env),
    dataSourceManager.fetchSource3Data({ date, users }, env),
    dataSourceManager.fetchSource4Data({ date }, env),
    dataSourceManager.fetchSource5Data({ date }, env),
    dataSourceManager.fetchSource6Data({ date }, env),
  ]);

  const source1Result = source1Data.status === "fulfilled" ? source1Data.value : [];
  const source3Result = source3Data.status === "fulfilled" ? source3Data.value.urlData : [];
  const source4Result = source4Data.status === "fulfilled" ? source4Data.value : [];
  const source5Result = source5Data.status === "fulfilled" ? source5Data.value : [];
  const source6Result = source6Data.status === "fulfilled" ? source6Data.value : [];

  // 步骤4: 聚合数据
  const mergedUrlData = mergeUrlData(source1Result, source3Result, source4Result, source5Result, source6Result);
  const aggregationResult = aggregateByApp(mergedUrlData, appMappings);

  // 步骤5: 构建 URL 级扁平数据并写入 D1
  const rows: Array<{
    date: string;
    url: string;
    username: string;
    app_id: string;
    app_name: string;
    request: number;
    response: number;
    impression: number;
    click: number;
    fill_rate: number;
    impression_rate: number;
    click_rate: number;
    ecpm: number;
    revenue: number;
  }> = [];

  for (const app of aggregationResult.apps) {
    for (const urlDetail of app.urlDetails) {
      // 跳过没有国家数据的URL（说明数据源API没有返回该URL的数据）
      if (!urlDetail.countryDetails || urlDetail.countryDetails.length === 0) {
        continue;
      }

      rows.push({
        date,
        url: urlDetail.url,
        username: app.username,
        app_id: app.appId,
        app_name: app.appName,
        request: urlDetail.request,
        response: urlDetail.response,
        impression: urlDetail.impression,
        click: urlDetail.click,
        fill_rate: urlDetail.fillRate,
        impression_rate: urlDetail.impressionRate,
        click_rate: urlDetail.clickRate,
        ecpm: urlDetail.ecpm,
        revenue: urlDetail.revenue,
      });
    }
  }

  if (rows.length === 0) {
    return { date, inserted: 0, skipped: 0 };
  }

  // 批量写入（每批50条，避免超出 D1 单次限制）
  const BATCH_SIZE = 50;
  let inserted = 0;
  const insertSql = force
    ? `INSERT OR REPLACE INTO daily_stats (date, url, username, app_id, app_name, request, response, impression, click, fill_rate, impression_rate, click_rate, ecpm, revenue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    : `INSERT OR IGNORE INTO daily_stats (date, url, username, app_id, app_name, request, response, impression, click, fill_rate, impression_rate, click_rate, ecpm, revenue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const statements = batch.map(row =>
      env.DB.prepare(insertSql).bind(
        row.date, row.url, row.username, row.app_id, row.app_name,
        row.request, row.response, row.impression, row.click,
        row.fill_rate, row.impression_rate, row.click_rate, row.ecpm, row.revenue
      )
    );
    const results = await env.DB.batch(statements);
    inserted += results.reduce((sum, r) => sum + (r.meta.changes || 0), 0);
  }

  return { date, inserted, skipped: rows.length - inserted };
}
