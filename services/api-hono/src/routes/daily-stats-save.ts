/**
 * 每日数据统计手动触发保存接口（Mock 版本）
 *
 * Input: { date: string, force?: boolean }
 * Output: mock 保存结果（inserted/skipped 条数）
 * Pos: backend/src/routes/daily-stats-save.ts
 *
 * 🔄 自维护：修改手动保存逻辑时，必须更新本文件
 */

import type { Env } from '../services/dataSources/types';

/**
 * 手动触发保存接口（仅超管，Mock版本）
 * POST /api/daily-stats/save-manual
 * Body: { date: "YYYY-MM-DD", force?: boolean }
 */
export async function handleDailyStatsSaveManual(
  request: Request,
  env: Env
): Promise<Response> {
  let body: { date?: string; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { code: 400, message: '请求体格式错误', data: null },
      { status: 400 }
    );
  }

  const { date, force = false } = body;

  if (!date) {
    return Response.json(
      { code: 400, message: '缺少 date 参数', data: null },
      { status: 400 }
    );
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return Response.json(
      {
        code: 400,
        message: '日期格式错误，请使用 YYYY-MM-DD 格式',
        data: null
      },
      { status: 400 }
    );
  }

  return Response.json({
    code: 0,
    data: { date, inserted: 5, skipped: force ? 0 : 0 }
  });
}
