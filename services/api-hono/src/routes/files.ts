import { Hono } from 'hono';
import * as XLSX from 'xlsx';
import { DatabaseWrapper } from '../models/database';
import type { Env } from '../index';
import { isSuperAdmin, isSubAdmin } from '../middlewares/permissions';
import { authMiddleware } from '../middlewares/auth';
import { getCurrentShanghaiTime } from '../utils/datetime';
import { logger } from '../utils/logger';
import { validateExcelData, formatValidationErrors } from '../utils/excel-validator';

const files = new Hono<{ Bindings: Env }>();

// Excel文件上传 (仅管理员)
files.post('/upload', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    if (user.role !== 'admin') {
      return c.json({ error: '权限不足，仅管理员可上传文件' }, 403);
    }

    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const assignedUserIds = formData.get('assignedUserIds') as string; // 逗号分隔的用户ID
    const displayTime = formData.get('displayTime') as string;
    const scheduledPublish = formData.get('scheduledPublish') === 'true';
    const dataYear = formData.get('dataYear') as string; // 数据所属年份

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

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const db = new DatabaseWrapper(c.env.DB);

    // 获取当前本地时间
    const now = getCurrentShanghaiTime();

    // 解析并验证数据年份，默认为当前年份
    const currentYear = new Date().getFullYear();
    const year = dataYear ? parseInt(dataYear) : currentYear;

    if (isNaN(year) || year < 1900 || year > currentYear + 10) {
      return c.json({ error: '数据年份格式错误，请输入有效的年份' }, 400);
    }

    // 保存文件记录
    const fileResult = await db.run(
      'INSERT INTO excel_files (filename, original_name, file_path, uploaded_by, created_at, display_time, scheduled_publish, data_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        `${Date.now()}_${file.name}`,
        file.name,
        `/uploads/${Date.now()}_${file.name}`,
        user.id,
        now,
        displayTime || null,
        scheduledPublish ? 1 : 0,
        year
      ]
    );

    const fileId = fileResult.meta?.last_row_id || fileResult.lastInsertRowid;

    // 解析每个工作表的数据
    let totalRows = 0;
    const allValidationErrors: any[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];

      // 使用 XLSX 默认的解析方式，它会自动处理日期和数值
      const jsonData = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false, // 让 XLSX 自动处理格式化（日期会变成字符串，数值保持为数值）
        dateNF: 'yyyy-mm-dd' // 指定日期格式
      });

      // 验证数据格式（日期必须是 YYYY-MM-DD，必填字段不能为空）
      const validationResult = validateExcelData(jsonData as any[][], sheetName);

      if (!validationResult.valid) {
        allValidationErrors.push({
          sheet: sheetName,
          errors: validationResult.errors
        });
      }
    }

    // 如果有验证错误，删除已创建的文件记录并返回错误
    if (allValidationErrors.length > 0) {
      // 删除已创建的文件记录（还没有保存数据，只需删除文件记录）
      await db.run('DELETE FROM excel_files WHERE id = ?', [fileId]);

      // 格式化所有错误信息
      const allErrors = allValidationErrors.flatMap(({ sheet, errors }) =>
        errors.map((err: any) => ({ ...err, sheet }))
      );
      const errorMessage = formatValidationErrors(allErrors, 20);

      logger.warn('Excel validation failed', {
        filename: file.name,
        errorCount: allErrors.length
      });

      return c.json({
        error: errorMessage,
        validationErrors: allErrors
      }, 400);
    }

    // 验证通过，保存数据
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        dateNF: 'yyyy-mm-dd'
      });

      // 保存每行数据
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        const rowData = JSON.stringify(row);

        await db.run(
          'INSERT INTO excel_data (file_id, sheet_name, row_index, data) VALUES (?, ?, ?, ?)',
          [fileId, sheetName, i, rowData]
        );
        totalRows++;
      }
    }

    // 自动给上传者分配权限
    await db.run(
      'INSERT INTO excel_file_permissions (file_id, user_id, granted_by) VALUES (?, ?, ?)',
      [fileId, user.id, user.id]
    );

    // 分配文件权限给其他用户
    const assignedUsers: any[] = [];
    if (assignedUserIds && assignedUserIds.trim()) {
      const userIds = assignedUserIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

      for (const userId of userIds) {
        // 跳过上传者（已经自动分配）
        if (userId === user.id) continue;

        try {
          // 检查用户是否存在，且必须是普通用户（不能给管理员分配文件）
          const userExists = await db.get('SELECT id, username, role FROM users WHERE id = ? AND role = ?', [userId, 'user']);
          if (userExists) {
            // 分配权限
            await db.run(
              'INSERT INTO excel_file_permissions (file_id, user_id, granted_by) VALUES (?, ?, ?)',
              [fileId, userId, user.id]
            );
            assignedUsers.push({ id: userId, username: userExists.username });
          } else {
            logger.warn(`跳过用户ID ${userId}：不存在或非普通用户`);
          }
        } catch (permError) {
          logger.error('权限分配失败', permError, { userId });
        }
      }
    }

    return c.json({
      success: true,
      data: {
        fileId,
        filename: file.name,
        sheets: workbook.SheetNames,
        totalRows,
        assignedUsers,
        uploadedAt: now,
      },
    });

  } catch (error) {
    logger.error('File upload error', error);
    return c.json({ error: '文件上传失败' }, 500);
  }
});

// 获取文件列表
files.get('/list', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const db = new DatabaseWrapper(c.env.DB);
    
    let filesList;
    
    // 总管理员可以看到所有文件
    if (isSuperAdmin(user)) {
      filesList = await db.all(`
        SELECT
          f.id, f.filename, f.original_name, f.created_at, f.display_time, f.scheduled_publish, f.data_year,
          u.username as uploaded_by,
          MAX(0, COUNT(d.id) - 1) as row_count,
          (SELECT pu.username FROM excel_file_permissions p2
           LEFT JOIN users pu ON p2.user_id = pu.id
           WHERE p2.file_id = f.id AND p2.user_id != f.uploaded_by
           ORDER BY p2.id LIMIT 1) as assigned_users
        FROM excel_files f
        LEFT JOIN users u ON f.uploaded_by = u.id
        LEFT JOIN excel_data d ON f.id = d.file_id
        GROUP BY f.id
        ORDER BY f.created_at DESC
      `);
    } else if (isSubAdmin(user)) {
      // 子管理员可以看到：
      // 1) 分配给自己的文件
      // 2) 分配给自己创建的用户的文件
      filesList = await db.all(`
        SELECT
          f.id, f.filename, f.original_name, f.created_at, f.display_time, f.scheduled_publish, f.data_year,
          u.username as uploaded_by,
          MAX(0, COUNT(DISTINCT d.id) - 1) as row_count,
          (SELECT pu.username FROM excel_file_permissions p2
           LEFT JOIN users pu ON p2.user_id = pu.id
           WHERE p2.file_id = f.id AND p2.user_id != f.uploaded_by
           ORDER BY p2.id LIMIT 1) as assigned_users
        FROM excel_files f
        INNER JOIN users u ON f.uploaded_by = u.id
        LEFT JOIN excel_data d ON f.id = d.file_id
        WHERE f.id IN (
          SELECT DISTINCT efp.file_id
          FROM excel_file_permissions efp
          WHERE efp.user_id = ? OR efp.user_id IN (SELECT id FROM users WHERE created_by = ?)
        )
        GROUP BY f.id
        ORDER BY f.created_at DESC
      `, [user.id, user.id]);
    } else {
      // 普通用户只能看到同一管理员体系下、且分配给他们的文件
      filesList = await db.all(`
        SELECT
          f.id, f.filename, f.original_name, f.created_at, f.display_time, f.scheduled_publish, f.data_year,
          uploader.username as uploaded_by,
          MAX(0, COUNT(d.id) - 1) as row_count
        FROM excel_files f
        INNER JOIN excel_file_permissions p ON f.id = p.file_id
        INNER JOIN users uploader ON f.uploaded_by = uploader.id
        INNER JOIN users current_user ON current_user.id = ?
        LEFT JOIN excel_data d ON f.id = d.file_id
        WHERE p.user_id = ?
          AND (
            uploader.created_by = current_user.created_by
            OR (uploader.created_by IS NULL AND current_user.created_by IS NULL)
          )
        GROUP BY f.id
        ORDER BY f.created_at DESC
      `, [user.id, user.id]);
    }

    return c.json({
      success: true,
      data: filesList || [],
    });

  } catch (error) {
    logger.error('Files list error', error);
    return c.json({ error: '获取文件列表失败' }, 500);
  }
});

// 获取文件数据
files.get('/data/:fileId', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const fileId = c.req.param('fileId');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = (page - 1) * limit;

    const db = new DatabaseWrapper(c.env.DB);

    // 权限检查：管理员或有权限的用户才能查看
    let hasPermission = false;
    
    if (user.role === 'admin') {
      hasPermission = true;
    } else {
      // 检查用户是否有此文件的查看权限
      const permission = await db.get(
        'SELECT id FROM excel_file_permissions WHERE file_id = ? AND user_id = ?',
        [fileId, user.id]
      );
      hasPermission = !!permission;
    }

    if (!hasPermission) {
      return c.json({ error: '您没有权限查看此文件' }, 403);
    }

    // 获取文件信息包含展示时间和数据年份
    const fileInfo = await db.get(
      'SELECT id, original_name, filename, display_time, scheduled_publish, data_year FROM excel_files WHERE id = ?',
      [fileId]
    );

    if (!fileInfo) {
      return c.json({ error: '文件不存在' }, 404);
    }

    // 检查是否启用了定时发布且未到展示时间
    if (fileInfo.scheduled_publish && fileInfo.display_time && user.role !== 'admin') {
      const displayTime = new Date(fileInfo.display_time);
      const now = new Date();

      if (now < displayTime) {
        return c.json({
          error: `文件将在 ${fileInfo.display_time} 开始展示，请稍后查看`
        }, 403);
      }
    }

    // 单独获取标题行（row_index = 0）
    const headerResult = await db.get(
      'SELECT data FROM excel_data WHERE file_id = ? AND row_index = 0 LIMIT 1',
      [fileId]
    );
    const header = headerResult ? JSON.parse(headerResult.data) : null;

    // 获取数据总数（排除标题行 row_index = 0）
    const totalResult = await db.get(
      'SELECT COUNT(*) as total FROM excel_data WHERE file_id = ? AND row_index > 0',
      [fileId]
    );
    const total = totalResult?.total || 0;

    // 获取分页数据（排除标题行 row_index = 0）
    const dataList = await db.all(
      `SELECT sheet_name, row_index, data
       FROM excel_data
       WHERE file_id = ? AND row_index > 0
       ORDER BY sheet_name, row_index
       LIMIT ? OFFSET ?`,
      [fileId, limit, offset]
    );

    // 解析JSON数据
    const parsedData = dataList.map(item => ({
      sheet: item.sheet_name,
      row: item.row_index,
      data: JSON.parse(item.data),
    }));

    return c.json({
      success: true,
      data: {
        file: fileInfo,
        header: header,  // 标题行（每次都返回）
        rows: parsedData,  // 数据行（分页）
        pagination: {
          page,
          limit,
          total,  // 只统计数据行
          pages: Math.ceil(total / limit),
        },
      },
    });

  } catch (error) {
    logger.error('File data error', error);
    return c.json({ error: '获取文件数据失败' }, 500);
  }
});

// 删除文件 (仅管理员)
files.delete('/:fileId', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    if (user.role !== 'admin') {
      return c.json({ error: '权限不足，仅管理员可删除文件' }, 403);
    }

    const fileId = c.req.param('fileId');
    const db = new DatabaseWrapper(c.env.DB);

    // 首先检查文件是否存在
    const fileExists = await db.get('SELECT id FROM excel_files WHERE id = ?', [fileId]);
    if (!fileExists) {
      return c.json({ error: '文件不存在' }, 404);
    }

    // 删除相关权限记录
    await db.run('DELETE FROM excel_file_permissions WHERE file_id = ?', [fileId]);
    
    // 删除文件数据
    await db.run('DELETE FROM excel_data WHERE file_id = ?', [fileId]);
    
    // 删除文件记录
    const result = await db.run('DELETE FROM excel_files WHERE id = ?', [fileId]);

    return c.json({
      success: true,
      message: '文件删除成功',
    });

  } catch (error) {
    logger.error('File delete error', error);
    return c.json({ error: '删除文件失败' }, 500);
  }
});

export default files;