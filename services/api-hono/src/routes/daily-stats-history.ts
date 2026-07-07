/**
 * 每日数据统计历史查询接口
 *
 * Input: startDate, endDate 查询参数
 * Output: URL级数据按 app_id 分组重建两层结构
 * Pos: backend/src/routes/daily-stats-history.ts
 *
 * 🔄 自维护：修改历史查询逻辑时，必须更新本文件
 */

import type { Env } from '../services/dataSources/types';
import { maskUsername, maskUrl } from '../utils/mask';

interface DailyStatRow {
  date: string;
  url: string;
  username: string | null;
  app_id: string | null;
  app_name: string | null;
  request: number;
  response: number;
  impression: number;
  click: number;
  fill_rate: number;
  impression_rate: number;
  click_rate: number;
  ecpm: number;
  revenue: number;
}

/**
 * 历史数据查询接口
 * GET /api/daily-stats/history?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export async function handleDailyStatsHistory(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  if (!startDate || !endDate) {
    return Response.json(
      { code: 400, message: '缺少 startDate 或 endDate 参数', data: null },
      { status: 400 }
    );
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    return Response.json(
      {
        code: 400,
        message: '日期格式错误，请使用 YYYY-MM-DD 格式',
        data: null
      },
      { status: 400 }
    );
  }

  try {
    const result = await env.DB.prepare(
      `SELECT date, url, username, app_id, app_name,
              request, response, impression, click,
              fill_rate, impression_rate, click_rate, ecpm, revenue
       FROM daily_stats
       WHERE date >= ? AND date <= ?
       ORDER BY date DESC, app_id, url`
    )
      .bind(startDate, endDate)
      .all();

    const rows = result.results as DailyStatRow[];

    // 按 (app_id, username) 分组重建两层结构
    const appMap = new Map<
      string,
      {
        appId: string;
        appName: string;
        username: string;
        urlDetails: Array<{
          date: string;
          url: string;
          request: number;
          response: number;
          impression: number;
          click: number;
          fillRate: number;
          impressionRate: number;
          clickRate: number;
          ecpm: number;
          revenue: number;
        }>;
      }
    >();

    for (const row of rows) {
      const appId = row.app_id || row.url;
      const appKey = `${appId}|${row.username}`;
      if (!appMap.has(appKey)) {
        appMap.set(appKey, {
          appId,
          appName: maskUrl(row.app_name || row.url),
          username: maskUsername(row.username || ''),
          urlDetails: []
        });
      }
      appMap.get(appKey)!.urlDetails.push({
        date: row.date,
        url: maskUrl(row.url),
        request: row.request,
        response: row.response,
        impression: row.impression,
        click: row.click,
        fillRate: row.fill_rate,
        impressionRate: row.impression_rate,
        clickRate: row.click_rate,
        ecpm: row.ecpm,
        revenue: row.revenue
      });
    }

    return Response.json({
      code: 0,
      data: { list: Array.from(appMap.values()) }
    });
  } catch (error) {
    return Response.json(
      {
        code: 5000,
        message: error instanceof Error ? error.message : '查询失败',
        data: null
      },
      { status: 500 }
    );
  }
}
