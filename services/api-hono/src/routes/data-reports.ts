/**
 * 数据报告路由 (Data Reports Routes)
 *
 * **Input**: HTTP请求（上传Excel、编辑、发布、查看报告）
 * **Output**: JSON响应（报告数据、操作结果）
 * **Pos**: site66/backend/src/routes/data-reports.ts
 *
 * ## 核心功能
 * 1. 报告上传：解析Excel文件，创建/更新draft记录
 * 2. 报告编辑：获取draft记录，自动生成虚拟报告（缺失产品）
 * 3. 报告发布：将draft记录转换为published状态
 * 4. 报告查看：按用户/日期查询已发布的报告
 *
 * ## 关键修复记录
 *
 * ### 2026-01-09: 问题4 - 发布用户后其他用户虚拟数据消失 ✅
 * **问题**：发布某个用户的数据后，其他用户的虚拟数据会消失
 * **原因**：虚拟数据只是前端显示，没有在数据库中创建draft记录
 * **修复**：在编辑接口中，为每个日期的每个用户产品创建draft记录（Line 455-478）
 * **影响**：确保编辑页面的数据完整性，支持多用户并发编辑
 *
 * ### 2026-01-08: 问题1 - URL重复显示 ✅
 * **修复**：更新draft记录前删除旧的raw_data（Line 241）
 *
 * ### 2026-01-08: 问题2 - 虚拟报告第二次发布后消失 ✅
 * **修复**：发布接口处理已存在的published记录（Line 1221-1240）
 *
 * ## 自更新声明
 * 📌 当修改本文件时，必须同步更新：
 * - 本文件头部注释（Input/Output/核心功能）
 * - .project/tasks/相关任务文档
 * - site66/CLAUDE.md（如果涉及架构变更）
 */

import { Hono } from 'hono';
import * as XLSX from 'xlsx';
import { DatabaseWrapper } from '../models/database';
import type { Env } from '../index';
import { authMiddleware, adminMiddleware, superAdminMiddleware } from '../middlewares/auth';
import { isAnyAdmin, isSuperAdmin, isSubAdmin } from '../middlewares/permissions';
import { getCurrentShanghaiTime } from '../utils/datetime';
import { logger } from '../utils/logger';
import {
  truncateDecimal,
  validateUrls,
  getUrlProductMapping,
  groupByProduct,
  parseDate,
  normalizeUrl,
  type RawDataRow,
  type AggregatedProductData
} from '../utils/data-processor';

const dataReports = new Hono<{ Bindings: Env }>();

// 验证URL是否已配置 (仅总管理员)
dataReports.post('/validate-urls', authMiddleware, superAdminMiddleware, async (c) => {
  try {
    const { urls } = await c.req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return c.json({ error: 'URL列表不能为空' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);
    const unmatchedUrls = await validateUrls(urls, db);

    // 计算匹配成功的URL列表（原始格式）
    const unmatchedSet = new Set(unmatchedUrls);
    const matchedUrls = urls.filter(url => !unmatchedSet.has(url));

    // 标准化URL以显示实际保存的格式
    const normalizedMatchedUrls = matchedUrls.map(url => normalizeUrl(url));
    const normalizedUnmatchedUrls = unmatchedUrls.map(url => normalizeUrl(url));

    // 去重（因为不同的原始URL可能标准化为相同的URL）
    const uniqueNormalizedMatched = Array.from(new Set(normalizedMatchedUrls));
    const uniqueNormalizedUnmatched = Array.from(new Set(normalizedUnmatchedUrls));

    return c.json({
      success: true,
      data: {
        total: urls.length,
        matched: uniqueNormalizedMatched.length,
        unmatched: uniqueNormalizedUnmatched.length,
        matched_urls: uniqueNormalizedMatched,
        unmatched_urls: uniqueNormalizedUnmatched
      }
    });

  } catch (error) {
    logger.error('Validate URLs error', error);
    return c.json({ error: 'URL验证失败' }, 500);
  }
});

// Excel上传和处理 (仅总管理员)
dataReports.post('/upload', authMiddleware, superAdminMiddleware, async (c) => {
  try {
    const currentUser = c.get('user');
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ error: '请选择要上传的文件' }, 400);
    }

    // 检查文件类型
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: '仅支持Excel文件(.xlsx, .xls)' }, 400);
    }

    // 读取Excel文件
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', raw: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][];

    if (rows.length < 2) {
      return c.json({ error: 'Excel文件至少需要包含表头和一行数据' }, 400);
    }

    // 验证表头
    const headers = rows[0];
    const requiredHeaders = ['Date', 'Product', 'Requests', 'Matches', 'Impressions', 'Clicks', 'Revenue'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      return c.json({ error: `缺少必需的列: ${missingHeaders.join(', ')}` }, 400);
    }

    // 获取列索引
    const dateIdx = headers.indexOf('Date');
    const productIdx = headers.indexOf('Product');
    const requestsIdx = headers.indexOf('Requests');
    const matchesIdx = headers.indexOf('Matches');
    const impressionsIdx = headers.indexOf('Impressions');
    const clicksIdx = headers.indexOf('Clicks');
    const revenueIdx = headers.indexOf('Revenue');

    // 提取URL列表（跳过表头）
    const urls: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      const url = rows[i][productIdx];
      if (url && typeof url === 'string') {
        urls.push(url);
      }
    }

    if (urls.length === 0) {
      return c.json({ error: 'Excel文件中没有有效的URL数据' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 验证URL是否已配置
    const unmatchedUrls = await validateUrls(urls, db);

    if (unmatchedUrls.length === urls.length) {
      // 全部URL都未配置
      return c.json({
        error: '所有URL都未配置，请先在产品管理中配置URL',
        unmatched_urls: unmatchedUrls
      }, 400);
    }

    if (unmatchedUrls.length > 0) {
      // 部分URL未配置，丢弃这些行
      logger.warn(`Discarding ${unmatchedUrls.length} rows with unmatched URLs`, { unmatchedUrls });
    }

    // 获取URL到产品的映射
    const urlMapping = await getUrlProductMapping(urls, db);

    logger.info(`URL mapping created with ${urlMapping.size} entries`);

    // 解析原始数据行
    const rawDataRows: RawDataRow[] = [];
    const currentYear = new Date().getFullYear();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const url = row[productIdx];

      // 跳过未配置的URL
      if (!urlMapping.has(url)) {
        logger.warn(`Row ${i + 1}: URL not in mapping: "${url}"`);
        continue;
      }

      const dateStr = parseDate(row[dateIdx], currentYear);
      if (!dateStr) {
        logger.warn(`Invalid date format at row ${i + 1}: ${row[dateIdx]}`);
        continue;
      }

      // 辅助函数：清洗数值字符串（移除%符号并转换为小数）
      const cleanNumber = (value: any): number => {
        if (value === null || value === undefined || value === '') {
          return 0;
        }
        // 如果已是数字，直接返回
        if (typeof value === 'number') {
          return value;
        }
        // 转为字符串
        const str = String(value);
        const hasPercent = str.includes('%');

        // 移除%符号和空格
        const cleaned = str.replace(/%/g, '').trim();
        const parsed = parseFloat(cleaned);

        if (isNaN(parsed)) {
          return 0;
        }

        // 如果原始值包含%符号，将数值除以100转换为小数
        // 例如："5%" → 5 → 0.05
        return hasPercent ? parsed / 100 : parsed;
      };

      // 不需要再次标准化，直接使用原始URL
      // getUrlProductMapping已经处理了标准化，并返回原始URL作为key
      rawDataRows.push({
        date: dateStr,
        url: url,  // 使用原始URL，与urlMapping的key一致
        requests: cleanNumber(row[requestsIdx]),
        matches: cleanNumber(row[matchesIdx]),
        impressions: cleanNumber(row[impressionsIdx]),
        clicks: cleanNumber(row[clicksIdx]),
        revenue: cleanNumber(row[revenueIdx])
      });
    }

    logger.info(`Parsed ${rawDataRows.length} raw data rows`);

    if (rawDataRows.length === 0) {
      return c.json({ error: '没有有效的数据行可以处理' }, 400);
    }

    // 按产品和日期分组聚合
    const aggregatedData = groupByProduct(rawDataRows, urlMapping);

    logger.info(`Aggregated data: ${aggregatedData.length} products`);

    if (aggregatedData.length === 0) {
      logger.error('Data aggregation failed', {
        rawDataRowsCount: rawDataRows.length,
        urlMappingSize: urlMapping.size,
        sampleRawRow: rawDataRows[0],
        sampleMappingKey: Array.from(urlMapping.keys())[0]
      });
      return c.json({ error: '数据聚合失败，没有生成有效的报告' }, 400);
    }

    // 保存数据到数据库（使用事务）
    const now = getCurrentShanghaiTime();
    let savedReports = 0;
    let updatedReports = 0;

    // 建立 (date, productId, userId) -> reportId 的映射
    const reportIdMapping = new Map<string, number>();

    for (const data of aggregatedData) {
      // 检查是否已存在记录（不管draft还是published）
      // 因为数据库有UNIQUE(date, product_id, user_id)约束
      const existingReport = await db.get(
        'SELECT id, status FROM data_reports WHERE date = ? AND product_id = ? AND user_id = ?',
        [data.date, data.productId, data.userId]
      );

      if (existingReport) {
        // 记录已存在：UPDATE并重置为draft
        // 这样无论之前是draft还是published，都会被新数据覆盖
        await db.run(
          `UPDATE data_reports SET
            requests = ?, matches = ?, match_rate = ?,
            impressions = ?, impression_rate = ?,
            clicks = ?, ctr = ?,
            ecpm = ?, revenue = ?,
            status = 'draft',
            updated_at = ?
          WHERE id = ?`,
          [
            String(data.requests), String(data.matches), data.match_rate,
            String(data.impressions), data.impression_rate,
            String(data.clicks), data.ctr,
            data.ecpm, data.revenue,
            now,
            existingReport.id
          ]
        );

        // 删除旧的 raw_data 记录（避免多次上传时URL重复）
        await db.run('DELETE FROM raw_data WHERE report_id = ?', [existingReport.id]);

        reportIdMapping.set(`${data.date}_${data.productId}_${data.userId}`, existingReport.id);
        updatedReports++;
      } else {
        // 记录不存在：INSERT新记录
        const result = await db.run(
          `INSERT INTO data_reports (
            date, product_id, user_id, requests, matches, match_rate,
            impressions, impression_rate, clicks, ctr,
            ecpm, revenue, status, created_at, uploaded_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.date, data.productId, data.userId, String(data.requests), String(data.matches), data.match_rate,
            String(data.impressions), data.impression_rate, String(data.clicks), data.ctr,
            data.ecpm, data.revenue, 'draft', now, currentUser.id
          ]
        );

        // 保存映射关系（使用新插入的 ID）
        if (result.meta.last_row_id) {
          reportIdMapping.set(`${data.date}_${data.productId}_${data.userId}`, result.meta.last_row_id);
        }
        savedReports++;
      }
    }

    // 保存原始数据到 raw_data 表
    for (const rawRow of rawDataRows) {
      const mapping = urlMapping.get(rawRow.url);
      if (!mapping) continue;

      // 根据 date + productId + userId 找到对应的 reportId
      const reportId = reportIdMapping.get(`${rawRow.date}_${mapping.productId}_${mapping.userId}`);
      if (!reportId) {
        logger.warn(`No reportId found for date=${rawRow.date}, productId=${mapping.productId}, userId=${mapping.userId}`);
        continue;
      }

      // 计算 ecpm（与 data_reports 保持一致）
      const ecpm = rawRow.impressions > 0
        ? truncateDecimal((rawRow.revenue / rawRow.impressions) * 1000, 2)
        : '0.00';

      // 标准化URL后保存到数据库
      const normalizedUrlForDb = normalizeUrl(rawRow.url);

      await db.run(
        `INSERT INTO raw_data (
          date, report_id, url, user_id, requests, matches,
          impressions, clicks, ecpm, revenue, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rawRow.date, reportId, normalizedUrlForDb, mapping.userId,
          String(rawRow.requests), String(rawRow.matches), String(rawRow.impressions),
          String(rawRow.clicks), ecpm, truncateDecimal(rawRow.revenue, 2), now
        ]
      );
    }

    // 4. 重置该日期其他用户的已发布记录为draft虚拟数据
    // 这确保二次上传时，未包含在Excel中的用户会显示虚拟数据（全0）
    // 与发布接口的步骤1.5逻辑保持一致

    // 获取本次上传涉及的所有日期
    const uploadedDates = [...new Set(rawDataRows.map(row => row.date))];

    // 获取本次上传包含的(date, user_id)组合
    const uploadedUserDates = new Set(
      aggregatedData.map(data => `${data.date}_${data.userId}`)
    );

    for (const date of uploadedDates) {
      // 查询该日期所有用户的所有产品
      const allUserProducts = await db.all(`
        SELECT DISTINCT p.id as product_id, p.user_id
        FROM products p
        WHERE EXISTS (
          SELECT 1 FROM data_reports dr
          WHERE dr.date = ? AND dr.user_id = p.user_id
        )
      `, [date]);

      // 为每个用户产品检查并转换published记录
      for (const userProduct of allUserProducts) {
        const userDateKey = `${date}_${userProduct.user_id}`;

        // 如果该用户在本次上传的Excel中，跳过（已经在步骤1处理过了）
        if (uploadedUserDates.has(userDateKey)) {
          continue;
        }

        // 检查该产品是否有published记录
        const existingReport = await db.get(
          'SELECT id, status FROM data_reports WHERE date = ? AND product_id = ? AND user_id = ?',
          [date, userProduct.product_id, userProduct.user_id]
        );

        if (existingReport && existingReport.status === 'published') {
          // 将published记录转换为draft虚拟报告
          // 删除关联的raw_data
          await db.run('DELETE FROM raw_data WHERE report_id = ?', [existingReport.id]);

          // 更新为draft虚拟数据
          await db.run(
            `UPDATE data_reports SET
              requests = '0', matches = '0', match_rate = '0.0000',
              impressions = '0', impression_rate = '0.0000',
              clicks = '0', ctr = '0.0000',
              ecpm = '0.00', revenue = '0.00',
              status = 'draft',
              updated_at = ?
            WHERE id = ?`,
            [now, existingReport.id]
          );
          logger.info(`Reset published to draft virtual for user ${userProduct.user_id}, product ${userProduct.product_id}, date ${date}`);
        }
      }
    }

    return c.json({
      success: true,
      data: {
        saved_reports: savedReports,
        updated_reports: updatedReports,
        total_products: aggregatedData.length,
        total_raw_records: rawDataRows.length,
        discarded_urls: unmatchedUrls.length
      },
      message: `成功处理 ${aggregatedData.length} 个产品的数据报告`
    });

  } catch (error) {
    logger.error('Data report upload error', error);
    return c.json({ error: '文件上传失败' }, 500);
  }
});

// 获取报告列表 (管理员可查看所有，普通用户只能查看已发布的关联产品报告)
dataReports.get('/list', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user');
    const db = new DatabaseWrapper(c.env.DB);

    // 获取查询参数
    const status = c.req.query('status');
    const date = c.req.query('date');
    const productId = c.req.query('product_id');

    let query = `
      SELECT
        dr.id, dr.date, dr.product_id, dr.user_id, dr.requests, dr.matches, dr.match_rate,
        dr.impressions, dr.impression_rate, dr.clicks, dr.ctr,
        dr.ecpm, dr.revenue, dr.status, dr.created_at, dr.updated_at, dr.published_at,
        p.name as product_name,
        u.username as username
      FROM data_reports dr
      JOIN products p ON dr.product_id = p.id
      LEFT JOIN users u ON dr.user_id = u.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    // 普通用户只能查看已发布的自己的产品报告
    if (!isAnyAdmin(currentUser)) {
      conditions.push('dr.status = ?');
      params.push('published');

      conditions.push('dr.user_id = ?');
      params.push(currentUser.id);
    }

    // 筛选条件
    if (status) {
      conditions.push('dr.status = ?');
      params.push(status);
    }

    if (date) {
      conditions.push('dr.date = ?');
      params.push(date);
    }

    if (productId) {
      conditions.push('dr.product_id = ?');
      params.push(parseInt(productId));
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY dr.date DESC, p.name ASC';

    const reports = await db.all(query, params);

    return c.json({
      success: true,
      data: reports
    });

  } catch (error) {
    logger.error('Get data reports error', error);
    return c.json({ error: '获取报告列表失败' }, 500);
  }
});

// 获取编辑页面数据（草稿状态的报告，按用户分组）- 总管理员和子管理员
dataReports.get('/edit', authMiddleware, adminMiddleware, async (c) => {
  try {
    const currentUser = c.get('user');
    const db = new DatabaseWrapper(c.env.DB);

    // 根据用户类型确定可见的用户ID列表
    let visibleUserIds: number[] = [];

    if (isSuperAdmin(currentUser)) {
      // 总管理员：可以看到所有用户（包括子管理员和普通用户）
      const allUsers = await db.all('SELECT id FROM users');
      visibleUserIds = allUsers.map((u: any) => u.id);
    } else if (isSubAdmin(currentUser)) {
      // 子管理员：可以看到自己创建的用户 + 自己本身
      const myUsers = await db.all(
        `SELECT u.id FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE u.created_by = ? AND r.code = 'user'`,
        [currentUser.id]
      );
      visibleUserIds = myUsers.map((u: any) => u.id);
      // 添加子管理员自己的ID
      visibleUserIds.push(currentUser.id);
    }

    if (visibleUserIds.length === 0) {
      return c.json({
        success: true,
        data: isSuperAdmin(currentUser)
          ? { subAdmins: [], directUsers: [] }
          : { users: [] }
      });
    }

    const placeholders = visibleUserIds.map(() => '?').join(',');

    // 1. 获取所有草稿日期
    const draftDates = await db.all(`
      SELECT DISTINCT date
      FROM data_reports
      WHERE status = 'draft' AND user_id IN (${placeholders})
      ORDER BY date DESC
    `, visibleUserIds);

    if (draftDates.length === 0) {
      return c.json({
        success: true,
        data: isSuperAdmin(currentUser)
          ? { subAdmins: [], directUsers: [] }
          : { users: [] }
      });
    }

    // 2. 获取所有可见用户及其产品
    const userProducts = await db.all(`
      SELECT DISTINCT
        u.id as user_id,
        u.username,
        u.created_by,
        p.id as product_id,
        p.name as product_name
      FROM users u
      JOIN products p ON p.user_id = u.id
      WHERE u.id IN (${placeholders})
      ORDER BY u.username, p.name
    `, visibleUserIds);

    // 2.5. 为每个日期的每个用户产品创建draft记录（如果不存在）
    // 确保所有用户在有draft数据的日期都能显示（包括虚拟数据0）
    for (const { date } of draftDates) {
      for (const userProduct of userProducts) {
        // 检查是否已有任何记录（draft 或 published）
        // 因为 data_reports 表有 UNIQUE 约束：(date, product_id, user_id)
        const existingReport = await db.get(
          'SELECT id, status FROM data_reports WHERE date = ? AND product_id = ? AND user_id = ?',
          [date, userProduct.product_id, userProduct.user_id]
        );

        if (!existingReport) {
          // 完全没有记录：创建0值draft记录（虚拟报告）
          await db.run(
            `INSERT INTO data_reports (
              date, product_id, user_id, status, uploaded_by,
              requests, matches, match_rate,
              impressions, impression_rate,
              clicks, ctr, ecpm, revenue
            ) VALUES (?, ?, ?, ?, ?, '0', '0', '0.0000', '0', '0.0000', '0', '0.0000', '0.00', '0.00')`,
            [date, userProduct.product_id, userProduct.user_id, 'draft', currentUser.id]
          );
          logger.info(`Created virtual draft for user ${userProduct.user_id}, product ${userProduct.product_id}, date ${date}`);
        }
        // 如果已有记录（draft 或 published），不处理
        // - draft：保持不变，会在步骤 4 中查询并返回
        // - published：保持不变，不会在步骤 4 中查询（因为只查 draft）
      }
    }

    // 3. 批量获取所有产品的配置URL（优化性能，避免N+1查询）
    const productIds = [...new Set(userProducts.map((up: any) => up.product_id))];
    const productPlaceholders = productIds.map(() => '?').join(',');
    const allProductUrls = await db.all(`
      SELECT product_id, user_id, url
      FROM product_urls
      WHERE product_id IN (${productPlaceholders})
      ORDER BY product_id, url
    `, productIds);

    // 建立 product_id -> urls 的映射
    const productUrlsMap = new Map<number, string[]>();
    for (const row of allProductUrls) {
      if (!productUrlsMap.has(row.product_id)) {
        productUrlsMap.set(row.product_id, []);
      }
      productUrlsMap.get(row.product_id)!.push(row.url);
    }

    // 4. 获取所有草稿报告（用于查找已存在的报告）
    const allReports = await db.all(`
      SELECT
        id as report_id,
        date,
        product_id,
        user_id,
        requests,
        matches,
        match_rate,
        impressions,
        impression_rate,
        clicks,
        ctr,
        ecpm,
        revenue,
        status
      FROM data_reports
      WHERE status = 'draft' AND user_id IN (${placeholders})
    `, visibleUserIds);

    // 建立 (date, product_id, user_id) -> report 的映射
    const reportMap = new Map<string, any>();
    for (const report of allReports) {
      const key = `${report.date}_${report.product_id}_${report.user_id}`;
      reportMap.set(key, report);
    }

    // 5. 获取所有原始数据（URL行）
    if (allReports.length > 0) {
      const reportIds = allReports.map(r => r.report_id);
      const reportPlaceholders = reportIds.map(() => '?').join(',');
      var rawDataList = await db.all(`
        SELECT
          report_id,
          url,
          requests,
          matches,
          impressions,
          clicks,
          revenue,
          ecpm
        FROM raw_data
        WHERE report_id IN (${reportPlaceholders})
        ORDER BY report_id, url
      `, reportIds);
    } else {
      var rawDataList: any[] = [];
    }

    // 建立 report_id -> raw_data[] 的映射
    const rawDataMap = new Map<number, any[]>();
    for (const rd of rawDataList) {
      if (!rawDataMap.has(rd.report_id)) {
        rawDataMap.set(rd.report_id, []);
      }
      rawDataMap.get(rd.report_id)!.push(rd);
    }

    // 6. 按用户和日期分组数据
    const userMap = new Map<string, {
      userId: number;
      username: string;
      createdBy: number | null;
      dates: Map<string, any[]>;
    }>();

    // 6.1 构建所有有draft记录的(user_id, date)组合集合
    // 用于判断是否有新上传：如果有draft，说明有新上传，published检查失效
    const userDatesWithDraft = new Set<string>();
    for (const report of allReports) {
      if (report.status === 'draft') {
        userDatesWithDraft.add(`${report.user_id}_${report.date}`);
      }
    }

    // 为每个(用户, 日期, 产品)组合生成数据
    for (const userProduct of userProducts) {
      const userKey = String(userProduct.user_id);

      // 获取或创建用户分组
      if (!userMap.has(userKey)) {
        userMap.set(userKey, {
          userId: userProduct.user_id,
          username: userProduct.username,
          createdBy: userProduct.created_by,
          dates: new Map()
        });
      }

      const userGroup = userMap.get(userKey)!;

      // 为每个日期生成该产品的数据
      for (const dateRow of draftDates) {
        const date = dateRow.date;

        // 获取或创建日期分组
        if (!userGroup.dates.has(date)) {
          userGroup.dates.set(date, []);
        }

        const dateProducts = userGroup.dates.get(date)!;

        // 查找该日期是否已有报告
        const reportKey = `${date}_${userProduct.product_id}_${userProduct.user_id}`;
        const existingReport = reportMap.get(reportKey);

        // 获取该产品配置的所有URL
        const configuredUrls = productUrlsMap.get(userProduct.product_id) || [];

        if (existingReport) {
          // 有报告：获取真实数据 + 计算缺失URL
          const urlRows = (rawDataMap.get(existingReport.report_id) || []).map(rd => ({
            url: rd.url,
            requests: parseInt(rd.requests),
            matches: parseInt(rd.matches),
            impressions: parseInt(rd.impressions),
            clicks: parseInt(rd.clicks),
            revenue: parseFloat(rd.revenue),
            ecpm: rd.ecpm
          }));

          // 找出缺失的URL
          const uploadedUrls = new Set(urlRows.map(row => row.url));
          const missingUrls = configuredUrls
            .filter(url => !uploadedUrls.has(url))
            .map(url => ({
              url,
              requests: 0,
              matches: 0,
              impressions: 0,
              clicks: 0,
              revenue: 0,
              ecpm: '0.00',
              isMissing: true
            }));

          dateProducts.push({
            productId: userProduct.product_id,
            productName: userProduct.product_name,
            reportId: existingReport.report_id,
            date: date,
            status: existingReport.status,
            aggregatedRow: {
              date: date,
              requests: parseInt(existingReport.requests),
              matches: parseInt(existingReport.matches),
              match_rate: existingReport.match_rate,
              impressions: parseInt(existingReport.impressions),
              impression_rate: existingReport.impression_rate,
              clicks: parseInt(existingReport.clicks),
              ctr: existingReport.ctr,
              ecpm: existingReport.ecpm,
              revenue: existingReport.revenue
            },
            urlRows: urlRows,
            missingUrls: missingUrls
          });
        } else {
          // 没有 draft 报告：检查是否有 published 报告
          const userDateKey = `${userProduct.user_id}_${date}`;
          const hasNewUpload = userDatesWithDraft.has(userDateKey);

          // 如果该用户该日期没有新上传（没有任何draft记录）
          // 且该产品已经有published报告，则跳过不显示
          if (!hasNewUpload) {
            const publishedReport = await db.get(
              'SELECT id FROM data_reports WHERE date = ? AND product_id = ? AND user_id = ? AND status = ?',
              [date, userProduct.product_id, userProduct.user_id, 'published']
            );

            if (publishedReport) {
              continue; // 已发布且没有新上传，不显示
            }
          }

          // 没有任何报告，或者有新上传但Excel中没有该产品：生成虚拟报告（全0） + 所有URL为缺失
          const missingUrls = configuredUrls.map(url => ({
            url,
            requests: 0,
            matches: 0,
            impressions: 0,
            clicks: 0,
            revenue: 0,
            ecpm: '0.00',
            isMissing: true
          }));

          dateProducts.push({
            productId: userProduct.product_id,
            productName: userProduct.product_name,
            reportId: null, // 虚拟报告，没有report_id
            date: date,
            status: 'draft',
            aggregatedRow: {
              date: date,
              requests: 0,
              matches: 0,
              match_rate: '0.0000',
              impressions: 0,
              impression_rate: '0.0000',
              clicks: 0,
              ctr: '0.0000',
              ecpm: '0.00',
              revenue: '0.00'
            },
            urlRows: [], // 没有URL数据
            missingUrls: missingUrls // 所有URL都缺失
          });
        }
      }
    }

    // 7. 根据用户角色组织返回数据
    if (isSubAdmin(currentUser)) {
      // 子管理员：直接返回用户列表
      const users = Array.from(userMap.values())
        .map(user => {
          // 过滤掉空的日期组（所有产品都已发布）
          const dateGroups = Array.from(user.dates.entries())
            .filter(([date, products]) => products.length > 0)
            .map(([date, products]) => ({
              date,
              products
            }));

          return {
            userId: user.userId,
            username: user.username,
            dateGroups
          };
        })
        // 过滤掉没有任何日期的用户（所有日期都已发布）
        .filter(user => user.dateGroups.length > 0);

      return c.json({
        success: true,
        data: { users }
      });
    } else {
      // 总管理员：按子管理员分组
      // 获取所有子管理员列表
      const subAdmins = await db.all(
        `SELECT u.id, u.username FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'admin'`
      );

      const subAdminGroups = [];
      const directUsers = [];

      // 按子管理员分组
      for (const subAdmin of subAdmins) {
        const subAdminUsers = Array.from(userMap.values())
          .filter(user => user.createdBy === subAdmin.id)
          .map(user => {
            // 过滤掉空的日期组
            const dateGroups = Array.from(user.dates.entries())
              .filter(([date, products]) => products.length > 0)
              .map(([date, products]) => ({
                date,
                products
              }));

            return {
              userId: user.userId,
              username: user.username,
              dateGroups
            };
          })
          // 过滤掉没有任何日期的用户
          .filter(user => user.dateGroups.length > 0);

        if (subAdminUsers.length > 0) {
          subAdminGroups.push({
            adminId: subAdmin.id,
            adminName: subAdmin.username,
            users: subAdminUsers
          });
        }
      }

      // 总管理员直接管理的用户（created_by = 总管理员ID 或 null）
      const directUsersList = Array.from(userMap.values())
        .filter(user => user.createdBy === currentUser.id || user.createdBy === null)
        .map(user => {
          // 过滤掉空的日期组
          const dateGroups = Array.from(user.dates.entries())
            .filter(([date, products]) => products.length > 0)
            .map(([date, products]) => ({
              date,
              products
            }));

          return {
            userId: user.userId,
            username: user.username,
            dateGroups
          };
        })
        // 过滤掉没有任何日期的用户
        .filter(user => user.dateGroups.length > 0);

      directUsers.push(...directUsersList);

      return c.json({
        success: true,
        data: {
          subAdmins: subAdminGroups,
          directUsers
        }
      });
    }

  } catch (error) {
    logger.error('Get edit page data error', error);
    return c.json({ error: '获取编辑数据失败' }, 500);
  }
});

// 获取报告详情
dataReports.get('/:id', authMiddleware, async (c) => {
  try {
    const reportId = parseInt(c.req.param('id'));
    const currentUser = c.get('user');

    if (isNaN(reportId)) {
      return c.json({ error: '无效的报告ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    const report = await db.get(`
      SELECT
        dr.*, p.name as product_name, u.username as username
      FROM data_reports dr
      JOIN products p ON dr.product_id = p.id
      LEFT JOIN users u ON dr.user_id = u.id
      WHERE dr.id = ?
    `, [reportId]);

    if (!report) {
      return c.json({ error: '报告不存在' }, 404);
    }

    // 权限检查：普通用户只能查看已发布且属于自己的报告
    if (!isAnyAdmin(currentUser)) {
      if (report.status !== 'published') {
        return c.json({ error: '权限不足' }, 403);
      }

      if (report.user_id !== currentUser.id) {
        return c.json({ error: '权限不足' }, 403);
      }
    }

    return c.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Get data report detail error', error);
    return c.json({ error: '获取报告详情失败' }, 500);
  }
});

// 更新报告数据 (仅管理员，仅草稿状态)
dataReports.put('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const reportId = parseInt(c.req.param('id'));
    const currentUser = c.get('user');

    if (isNaN(reportId)) {
      return c.json({ error: '无效的报告ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 检查报告是否存在
    const report = await db.get('SELECT id, status, user_id FROM data_reports WHERE id = ?', [reportId]);

    if (!report) {
      return c.json({ error: '报告不存在' }, 404);
    }

    // 只能编辑草稿状态的报告
    if (report.status !== 'draft') {
      return c.json({ error: '只能编辑草稿状态的报告' }, 403);
    }

    const updateData = await c.req.json();
    const now = getCurrentShanghaiTime();

    // 构建更新字段
    const updateFields: string[] = [];
    const params: any[] = [];

    const allowedFields = [
      'date', 'requests', 'matches', 'match_rate',
      'impressions', 'impression_rate', 'clicks', 'ctr',
      'ecpm', 'revenue'
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        params.push(updateData[field]);
      }
    }

    if (updateFields.length === 0) {
      return c.json({ error: '没有提供可更新的字段' }, 400);
    }

    updateFields.push('updated_at = ?');
    params.push(now, reportId);

    await db.run(
      `UPDATE data_reports SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    // 获取更新后的报告
    const updatedReport = await db.get('SELECT * FROM data_reports WHERE id = ?', [reportId]);

    return c.json({
      success: true,
      data: updatedReport,
      message: '报告更新成功'
    });

  } catch (error) {
    logger.error('Update data report error', error);
    return c.json({ error: '更新报告失败' }, 500);
  }
});

// 发布报告 (仅管理员)
dataReports.post('/:id/publish', authMiddleware, adminMiddleware, async (c) => {
  try {
    const reportId = parseInt(c.req.param('id'));

    if (isNaN(reportId)) {
      return c.json({ error: '无效的报告ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 检查报告是否存在
    const report = await db.get('SELECT id, status, user_id FROM data_reports WHERE id = ?', [reportId]);

    if (!report) {
      return c.json({ error: '报告不存在' }, 404);
    }

    // 只能发布草稿状态的报告
    if (report.status !== 'draft') {
      return c.json({ error: '只能发布草稿状态的报告' }, 400);
    }

    const now = getCurrentShanghaiTime();

    // 更新状态为已发布
    await db.run(
      `UPDATE data_reports SET
        status = 'published',
        published_at = ?,
        updated_at = ?
      WHERE id = ?`,
      [now, now, reportId]
    );

    return c.json({
      success: true,
      message: '报告发布成功'
    });

  } catch (error) {
    logger.error('Publish data report error', error);
    return c.json({ error: '发布报告失败' }, 500);
  }
});

// 获取原始数据 (仅管理员)
dataReports.get('/:id/raw', authMiddleware, adminMiddleware, async (c) => {
  try {
    const reportId = parseInt(c.req.param('id'));

    if (isNaN(reportId)) {
      return c.json({ error: '无效的报告ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 检查报告是否存在
    const report = await db.get('SELECT id, date, product_id FROM data_reports WHERE id = ?', [reportId]);

    if (!report) {
      return c.json({ error: '报告不存在' }, 404);
    }

    // 获取原始数据
    const rawData = await db.all(
      `SELECT * FROM raw_data
       WHERE date = ? AND product_id = ?
       ORDER BY url ASC`,
      [report.date, report.product_id]
    );

    return c.json({
      success: true,
      data: rawData
    });

  } catch (error) {
    logger.error('Get raw data error', error);
    return c.json({ error: '获取原始数据失败' }, 500);
  }
});

// 发布前状态检查
dataReports.post('/check-status', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { reportIds } = await c.req.json();

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return c.json({ error: '缺少报告ID列表' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 构建查询条件
    const placeholders = reportIds.map(() => '?').join(',');

    // 查询已发布的报告
    const publishedReports = await db.all(`
      SELECT
        dr.id as reportId,
        p.name as productName,
        u.username,
        dr.published_at as publishedAt
      FROM data_reports dr
      JOIN products p ON dr.product_id = p.id
      LEFT JOIN users u ON dr.user_id = u.id
      WHERE dr.id IN (${placeholders}) AND dr.status = 'published'
    `, reportIds);

    return c.json({
      success: true,
      data: {
        hasConflict: publishedReports.length > 0,
        publishedReports
      }
    });

  } catch (error) {
    logger.error('Check status error', error);
    return c.json({ error: '状态检查失败' }, 500);
  }
});

// 批量发布用户报告
dataReports.post('/publish', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { userId, adminId, modifiedProducts, displayTime, scheduledPublish } = await c.req.json();

    // 验证参数：必须提供 userId 或 adminId 之一
    if (!userId && !adminId) {
      return c.json({ error: '缺少用户ID或管理员ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);
    const now = getCurrentShanghaiTime();
    const currentUser = c.get('user');

    // 确定要发布的用户ID列表
    let targetUserIds: number[] = [];

    if (adminId) {
      // 子管理员层级统一发布：获取该子管理员下所有用户
      const users = await db.all(
        `SELECT u.id FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE u.created_by = ? AND r.code = 'user'`,
        [adminId]
      );
      targetUserIds = users.map((u: any) => u.id);

      if (targetUserIds.length === 0) {
        return c.json({ error: '该管理员下没有用户' }, 400);
      }
    } else {
      // 单个用户发布
      targetUserIds = [userId];
    }

    // 1. 保存修改的聚合数据（支持单个用户和批量发布）
    // 同时支持虚拟报告的插入（reportId为null的情况）
    let modifiedCount = 0;
    if (modifiedProducts && modifiedProducts.length > 0) {
      for (const product of modifiedProducts) {
        if (product.reportId === null) {
          // 虚拟报告：需要先检查是否已存在记录
          // 确定用户ID：优先使用 product.userId，否则使用请求中的 userId，最后通过 productId 查找
          let reportUserId = product.userId || userId;

          if (!reportUserId) {
            // 通过 productId 查找 userId
            const productInfo = await db.get('SELECT user_id FROM products WHERE id = ?', [product.productId]);
            if (productInfo) {
              reportUserId = productInfo.user_id;
            } else {
              logger.error(`Cannot insert virtual report: product ${product.productId} not found`);
              continue;
            }
          }

          // 检查是否已存在记录（因为UNIQUE约束）
          const existingReport = await db.get(
            'SELECT id FROM data_reports WHERE date = ? AND product_id = ? AND user_id = ?',
            [product.aggregatedData.date, product.productId, reportUserId]
          );

          if (existingReport) {
            // 已存在：UPDATE
            await db.run(
              `UPDATE data_reports SET
                requests = ?, matches = ?, match_rate = ?,
                impressions = ?, impression_rate = ?,
                clicks = ?, ctr = ?,
                ecpm = ?, revenue = ?,
                status = 'draft',
                updated_at = ?
              WHERE id = ?`,
              [
                String(product.aggregatedData.requests),
                String(product.aggregatedData.matches),
                product.aggregatedData.match_rate,
                String(product.aggregatedData.impressions),
                product.aggregatedData.impression_rate,
                String(product.aggregatedData.clicks),
                product.aggregatedData.ctr,
                product.aggregatedData.ecpm,
                product.aggregatedData.revenue,
                now,
                existingReport.id
              ]
            );
            logger.info(`Updated virtual report for product ${product.productId}, user ${reportUserId}, date ${product.aggregatedData.date}`);
          } else {
            // 不存在：INSERT
            await db.run(
              `INSERT INTO data_reports (
                date, product_id, user_id, requests, matches, match_rate,
                impressions, impression_rate, clicks, ctr,
                ecpm, revenue, status, created_at, uploaded_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
              [
                product.aggregatedData.date,
                product.productId,
                reportUserId,
                String(product.aggregatedData.requests),
                String(product.aggregatedData.matches),
                product.aggregatedData.match_rate,
                String(product.aggregatedData.impressions),
                product.aggregatedData.impression_rate,
                String(product.aggregatedData.clicks),
                product.aggregatedData.ctr,
                product.aggregatedData.ecpm,
                product.aggregatedData.revenue,
                now,
                currentUser.id
              ]
            );
            logger.info(`Inserted virtual report for product ${product.productId}, user ${reportUserId}, date ${product.aggregatedData.date}`);
          }
        } else {
          // 真实报告：更新现有记录
          await db.run(
            `UPDATE data_reports SET
              requests = ?,
              matches = ?,
              match_rate = ?,
              impressions = ?,
              impression_rate = ?,
              clicks = ?,
              ctr = ?,
              ecpm = ?,
              revenue = ?,
              updated_at = ?
            WHERE id = ?`,
            [
              String(product.aggregatedData.requests),
              String(product.aggregatedData.matches),
              product.aggregatedData.match_rate,
              String(product.aggregatedData.impressions),
              product.aggregatedData.impression_rate,
              String(product.aggregatedData.clicks),
              product.aggregatedData.ctr,
              product.aggregatedData.ecpm,
              product.aggregatedData.revenue,
              now,
              product.reportId
            ]
          );
        }
        modifiedCount++;
      }
    }

    // 1.5. 自动为缺失的产品创建虚拟报告（全0数据）
    // 这样即使前端没有发送虚拟报告，也能确保所有产品都被发布
    const placeholders = targetUserIds.map(() => '?').join(',');

    // 查询所有目标用户的产品
    const userProducts = await db.all(`
      SELECT DISTINCT p.id as product_id, p.user_id
      FROM products p
      WHERE p.user_id IN (${placeholders})
    `, targetUserIds);

    // 查询所有目标用户的草稿日期
    const draftDates = await db.all(`
      SELECT DISTINCT date, user_id
      FROM data_reports
      WHERE user_id IN (${placeholders}) AND status = 'draft'
    `, targetUserIds);

    logger.info(`Found ${draftDates.length} draft dates for virtual report creation`, { draftDates });

    // 为每个（用户，产品，日期）组合检查是否存在记录，如果不存在则创建虚拟报告
    for (const dateRow of draftDates) {
      const userProds = userProducts.filter(up => up.user_id === dateRow.user_id);

      for (const userProd of userProds) {
        // 检查是否已存在该产品的报告（draft或published）
        const existingReport = await db.get(
          'SELECT id, status FROM data_reports WHERE date = ? AND product_id = ? AND user_id = ?',
          [dateRow.date, userProd.product_id, dateRow.user_id]
        );

        logger.info(`Checking product ${userProd.product_id} for date ${dateRow.date}, user ${dateRow.user_id}`, {
          existingReport: existingReport ? { id: existingReport.id, status: existingReport.status } : null
        });

        if (!existingReport) {
          // 不存在：创建虚拟报告（全0）
          await db.run(
            `INSERT INTO data_reports (
              date, product_id, user_id, requests, matches, match_rate,
              impressions, impression_rate, clicks, ctr,
              ecpm, revenue, status, created_at, uploaded_by
            ) VALUES (?, ?, ?, '0', '0', '0.0000', '0', '0.0000', '0', '0.0000', '0.00', '0.00', 'draft', ?, ?)`,
            [dateRow.date, userProd.product_id, dateRow.user_id, now, currentUser.id]
          );
          logger.info(`Auto-created virtual report for user ${dateRow.user_id}, product ${userProd.product_id}, date ${dateRow.date}`);
        } else if (existingReport.status === 'published') {
          // 已存在published记录：转换为draft并清空数据（虚拟报告）
          await db.run(
            `UPDATE data_reports SET
              requests = '0', matches = '0', match_rate = '0.0000',
              impressions = '0', impression_rate = '0.0000',
              clicks = '0', ctr = '0.0000',
              ecpm = '0.00', revenue = '0.00',
              status = 'draft',
              updated_at = ?
            WHERE id = ?`,
            [now, existingReport.id]
          );
          logger.info(`Converted published to draft virtual report for user ${dateRow.user_id}, product ${userProd.product_id}, date ${dateRow.date}`);
        }
        // 如果existingReport.status === 'draft'，说明已经是草稿了，不需要处理
      }
    }

    // 2. 发布目标用户的所有草稿状态的报告
    // 直接将draft改为published（因为UNIQUE约束，不会有重复记录）
    const result = await db.run(
      `UPDATE data_reports
       SET status = 'published', published_at = ?, updated_at = ?, display_time = ?, scheduled_publish = ?
       WHERE user_id IN (${placeholders}) AND status = 'draft'`,
      [now, now, displayTime || null, scheduledPublish ? 1 : 0, ...targetUserIds]
    );

    const publishedCount = result.meta?.changes || 0;

    // 3. 同步已发布的报告到 excel_data 表
    // 获取刚刚发布的报告（包含产品名称）
    const userPlaceholders = targetUserIds.map(() => '?').join(',');
    const publishedReports = await db.all(
      `SELECT
        dr.id, dr.date, dr.product_id, dr.user_id,
        dr.requests, dr.matches, dr.match_rate,
        dr.impressions, dr.impression_rate,
        dr.clicks, dr.ctr, dr.ecpm, dr.revenue,
        p.name as product_name
      FROM data_reports dr
      JOIN products p ON dr.product_id = p.id
      WHERE dr.user_id IN (${userPlaceholders}) AND dr.published_at = ?
      ORDER BY dr.date, p.name`,
      [...targetUserIds, now]
    );

    if (publishedReports.length > 0) {
      // 按用户+日期分组报告
      const reportsByUserDate = new Map<string, any[]>();
      for (const report of publishedReports) {
        const key = `${report.user_id}-${report.date}`;
        if (!reportsByUserDate.has(key)) {
          reportsByUserDate.set(key, []);
        }
        reportsByUserDate.get(key)!.push(report);
      }

      // 为每个用户+日期创建虚拟 Excel 文件并同步数据
      for (const [key, reports] of reportsByUserDate.entries()) {
        const userId = reports[0].user_id;
        const date = reports[0].date;
        const dataYear = date.split('-')[0]; // 提取年份

        // 获取用户名
        const user = await db.get('SELECT username FROM users WHERE id = ?', [userId]);
        const username = user?.username || `user${userId}`;

        const filename = `数据报告-${username}-${date}.xlsx`;
        const filePath = `/virtual/data-report-${username}-${date}.xlsx`;

        // 检查是否存在同名虚拟文件（重复发布处理）
        // 注意：虚拟文件是全局共享的，不按 uploaded_by 区分
        const existingFile = await db.get(
          `SELECT id FROM excel_files
           WHERE filename = ? AND file_path LIKE '/virtual/%'`,
          [filename]
        );

        let fileId: number;

        if (existingFile) {
          // 保留现有虚拟文件，只更新数据和权限
          fileId = existingFile.id;
          await db.run('DELETE FROM excel_data WHERE file_id = ?', [fileId]);
          await db.run('DELETE FROM excel_file_permissions WHERE file_id = ?', [fileId]);

          // 更新文件的 display_time 和 scheduled_publish（如果提供）
          await db.run(
            `UPDATE excel_files SET display_time = ?, scheduled_publish = ? WHERE id = ?`,
            [displayTime || now, scheduledPublish ? 1 : 0, fileId]
          );

          logger.info(`Updating existing virtual file for user ${username}, date ${date}, fileId=${fileId}`);
        } else {
          // 创建新的虚拟 Excel 文件记录
          // 虚拟文件统一由系统创建，uploaded_by 设置为当前用户
          const fileResult = await db.run(
            `INSERT INTO excel_files
             (filename, original_name, file_path, uploaded_by, created_at, display_time, scheduled_publish, data_year)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [filename, filename, filePath, currentUser.id, now, displayTime || now, scheduledPublish ? 1 : 0, dataYear]
          );

          fileId = fileResult.meta?.last_row_id || fileResult.lastInsertRowid;
          logger.info(`Created virtual file for user ${username}, date ${date}, fileId=${fileId}`);
        }

        // 将报告数据转换为 JSON 格式并插入 excel_data
        // 首先插入表头行（row_index = 0），用于前端查看页面显示
        const headerRow = [
          'Date',
          'Product',
          'Requests',
          'Matches',
          'Match Rate',
          'Impressions',
          'Impression Rate',
          'Clicks',
          'CTR',
          'eCPM',
          'Revenue'
        ];

        await db.run(
          `INSERT INTO excel_data (file_id, sheet_name, row_index, data)
           VALUES (?, ?, ?, ?)`,
          [fileId, 'Sheet1', 0, JSON.stringify(headerRow)]
        );

        // 然后插入数据行（从 row_index = 1 开始）
        let rowIndex = 1;
        for (const report of reports) {
          // 构建 JSON 数组：[date, product_name, requests, matches, match_rate, impressions, impression_rate, clicks, ctr, ecpm, revenue]
          const dataArray = [
            report.date,
            report.product_name,
            report.requests,
            report.matches,
            report.match_rate,
            report.impressions,
            report.impression_rate,
            report.clicks,
            report.ctr,
            report.ecpm,
            report.revenue
          ];

          await db.run(
            `INSERT INTO excel_data (file_id, sheet_name, row_index, data)
             VALUES (?, ?, ?, ?)`,
            [fileId, 'Sheet1', rowIndex, JSON.stringify(dataArray)]
          );

          rowIndex++;
        }

        logger.info(`Inserted ${rowIndex} rows into excel_data for fileId=${fileId}`);

        // 为该用户添加文件访问权限
        await db.run(
          `INSERT INTO excel_file_permissions (user_id, file_id, granted_by, created_at)
           VALUES (?, ?, ?, ?)`,
          [userId, fileId, currentUser.id, now]
        );
        logger.info(`Added file permission for userId=${userId}, fileId=${fileId}`);
      }
    }

    // 4. 返回成功消息
    let message;
    if (adminId) {
      message = `成功发布子管理员下 ${targetUserIds.length} 个用户的 ${publishedCount} 个产品报告`;
      if (modifiedCount > 0) {
        message += `（含 ${modifiedCount} 个修改数据）`;
      }
    } else {
      message = `成功发布 ${publishedCount} 个产品的报告`;
      if (modifiedCount > 0) {
        message += `（含 ${modifiedCount} 个修改数据）`;
      }
    }

    return c.json({
      success: true,
      data: {
        published: publishedCount,
        modified: modifiedCount,
        unmodified: publishedCount - modifiedCount,
        synced_to_excel: publishedReports.length,
        affected_users: targetUserIds.length
      },
      message
    });

  } catch (error) {
    logger.error('Publish reports error', error);
    return c.json({ error: '发布报告失败' }, 500);
  }
});

// 清空所有草稿数据 (仅总管理员)
dataReports.post('/clear-all-drafts', authMiddleware, superAdminMiddleware, async (c) => {
  try {
    const currentUser = c.get('user');
    logger.info('Clear all drafts requested', { userId: currentUser.id, username: currentUser.username });

    const db = new DatabaseWrapper(c.env.DB);

    // 删除所有draft状态的报告
    const result = await db.run(`
      DELETE FROM data_reports
      WHERE status = 'draft'
    `);

    const deletedCount = result.meta?.changes || 0;

    logger.info(`Clear all drafts completed: deleted ${deletedCount} draft records`, {
      userId: currentUser.id,
      username: currentUser.username
    });

    return c.json({
      success: true,
      message: `已清空 ${deletedCount} 条草稿记录`,
      deletedCount
    });

  } catch (error) {
    logger.error('Clear all drafts error', error);
    return c.json({ error: '清空草稿失败' }, 500);
  }
});

export default dataReports;
