/**
 * 用户 API 路由
 * 提供只读的数据查询接口，自动过滤 user_id
 */
import { Hono } from 'hono';
import { apiKeyAuthMiddleware } from '../middlewares/api-key-auth';
import { Env } from '../index';

const userApi = new Hono<{ Bindings: Env }>();

// 所有用户API都需要API Key认证
userApi.use('*', apiKeyAuthMiddleware);

// 查询数据报告（按日期范围）
userApi.get('/data-reports', async (c) => {
  const user = c.get('apiKeyUser');
  const { start_date, end_date, page = '1', page_size = '50' } = c.req.query();

  // 参数验证
  if (!start_date || !end_date) {
    return c.json({ error: 'start_date and end_date are required' }, 400);
  }

  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database not available' }, 500);
  }

  try {
    // 只选择用户可见的字段，过滤敏感信息
    // 用户可见字段：date, product, requests, matches, match_rate, impressions, impression_rate, clicks, ctr, ecpm, revenue
    // 注意：不返回 id 字段，序号由前端生成
    let query = `
      SELECT
        dr.date,
        p.name as product,
        dr.requests,
        dr.matches,
        dr.match_rate,
        dr.impressions,
        dr.impression_rate,
        dr.clicks,
        dr.ctr,
        dr.ecpm,
        dr.revenue
      FROM data_reports dr
      LEFT JOIN products p ON dr.product_id = p.id
      WHERE dr.user_id = ? AND dr.status = 'published'
    `;
    const params: any[] = [user.userId];

    if (start_date) {
      query += ' AND dr.date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND dr.date <= ?';
      params.push(end_date);
    }

    // 添加排序和分页
    query += ' ORDER BY dr.date DESC LIMIT ? OFFSET ?';
    const pageNum = parseInt(page);
    const pageSizeNum = Math.min(parseInt(page_size), 200); // 最大200条
    params.push(pageSizeNum, (pageNum - 1) * pageSizeNum);


    const reports = await db.prepare(query).bind(...params).all();

    return c.json({
      success: true,
      data: {
        reports: reports.results,
        page: pageNum,
        page_size: pageSizeNum,
        total: reports.results?.length || 0
      }
    });
  } catch (error) {
    console.error('Query data reports error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return c.json({ error: 'Failed to query data reports' }, 500);
  }
});

export default userApi;
