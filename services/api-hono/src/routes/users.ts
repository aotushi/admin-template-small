import { Hono } from 'hono';
import * as bcrypt from 'bcryptjs';
import { DATA_SCOPES, PERMISSION_CODES } from '@admin-backend-3/admin-api-contract/permissions';
import { DatabaseWrapper } from '../models/database';
import type { Env } from '../index';
import {
  isSuperAdmin,
  isSubAdmin,
  canDeleteUser,
  canManageUser
} from '../middlewares/permissions';
import { authMiddleware, adminMiddleware } from '../middlewares/auth';
import {
  buildUsersScopeCondition,
  getUserAccess,
  requirePermission,
  syncUserRoleBinding
} from '../services/permissions';
import { getCurrentShanghaiTime, toBeijingTime } from '../utils/datetime';
import { logger } from '../utils/logger';
import { normalizeUrl } from '../utils/data-processor';
import { maskUrl } from '../utils/mask';

const users = new Hono<{ Bindings: Env }>();

// 获取所有用户列表（需 system:user:view 权限，行级可见性由角色数据范围决定）
users.get('/list', authMiddleware, requirePermission(PERMISSION_CODES.systemUserView), async c => {
  try {
    const db = new DatabaseWrapper(c.env.DB);
    const currentUser = c.get('user');

    // 构建查询语句
    let query = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.role,
        u.admin_level,
        u.department_id,
        u.is_system,
        u.is_active,
        u.created_by,
        u.created_at,
        creator.username as created_by_username,
        department.name as department_name,
        parent_department.name as department_parent_name
      FROM users u
      LEFT JOIN users creator ON u.created_by = creator.id
      LEFT JOIN departments department ON u.department_id = department.id
      LEFT JOIN departments parent_department ON department.parent_id = parent_department.id
    `;

    // 显式数据范围：all 不限制 / dept 部门子树 / self 仅自己创建
    const access = await getUserAccess(c);
    const scope = buildUsersScopeCondition(access, currentUser.id);
    const params: any[] = [...scope.params];
    if (scope.condition) {
      query += ` WHERE ${scope.condition}`;
    }

    query += ` ORDER BY u.created_at DESC`;

    const usersList = await db.all(query, params);

    return c.json({
      success: true,
      data: usersList
    });
  } catch (error) {
    logger.error('Users list error', error);
    return c.json({ error: '获取用户列表失败' }, 500);
  }
});

// 搜索用户 (按用户名或邮箱)
users.get('/search', authMiddleware, adminMiddleware, async c => {
  try {
    const query = c.req.query('q') || '';

    if (!query.trim()) {
      return c.json({ success: true, data: [] });
    }

    const db = new DatabaseWrapper(c.env.DB);

    const searchResults = await db.all(
      `
      SELECT id, username, email, role, created_at
      FROM users 
      WHERE username LIKE ? OR email LIKE ?
      ORDER BY username
      LIMIT 10
    `,
      [`%${query}%`, `%${query}%`]
    );

    return c.json({
      success: true,
      data: searchResults
    });
  } catch (error) {
    logger.error('User search error', error);
    return c.json({ error: '搜索用户失败' }, 500);
  }
});

// 创建新用户（需 system:user:create 权限）
users.post('/create', authMiddleware, requirePermission(PERMISSION_CODES.systemUserCreate), async c => {
  try {
    const {
      username,
      email,
      password,
      role = 'user',
      admin_level,
      department_id,
      assigned_to_admin,
      products
    } = await c.req.json();
    const currentUser = c.get('user');

    // 验证必填字段
    if (!username || !password) {
      return c.json({ error: '用户名和密码不能为空' }, 400);
    }

    // 验证用户名长度
    if (username.length < 3) {
      return c.json({ error: '用户名至少3个字符' }, 400);
    }

    // 验证密码长度
    if (password.length < 6) {
      return c.json({ error: '密码至少6个字符' }, 400);
    }

    if (!['admin', 'user'].includes(role)) {
      return c.json({ error: '用户角色无效' }, 400);
    }

    if (admin_level !== undefined && !['super', 'sub', null].includes(admin_level)) {
      return c.json({ error: '管理员级别无效' }, 400);
    }

    const requestedAdminLevel =
      admin_level === 'super' || admin_level === 'sub'
        ? admin_level
        : role === 'admin'
          ? 'sub'
          : null;

    // 只有总管理员可以授予管理员或总管理员权限。
    if (requestedAdminLevel && !isSuperAdmin(currentUser)) {
      return c.json({ error: '只有总管理员可以授予管理员权限' }, 403);
    }

    const db = new DatabaseWrapper(c.env.DB);

    let resolvedDepartmentId: number | null = null;
    if (requestedAdminLevel !== 'super') {
      // 部门必填：无部门用户对 dept 数据范围的查看者不可见，避免产生“孤儿用户”
      if (department_id === undefined || department_id === null) {
        return c.json({ error: '请选择部门' }, 400);
      }

      const parsedDepartmentId = Number(department_id);
      if (!Number.isInteger(parsedDepartmentId)) {
        return c.json({ error: '部门ID无效' }, 400);
      }

      const department = await db.get(
        `SELECT d.id
         FROM departments d
         WHERE d.id = ?
           AND NOT EXISTS (SELECT 1 FROM departments child WHERE child.parent_id = d.id)`,
        [parsedDepartmentId]
      );
      if (!department) {
        return c.json({ error: '用户只能分配到有效的子部门' }, 400);
      }

      // dept 数据范围的创建者只能把用户放进自己的部门子树，
      // 保证"自己创建的 ⊆ 自己可见的"，不产生创建后看不到的用户
      const access = await getUserAccess(c);
      if (access.dataScope === DATA_SCOPES.dept && access.departmentId !== null) {
        const inScope = await db.get(
          `WITH RECURSIVE dept_tree(id) AS (
             SELECT id FROM departments WHERE id = ?
             UNION ALL
             SELECT d.id FROM departments d JOIN dept_tree t ON d.parent_id = t.id
           )
           SELECT id FROM dept_tree WHERE id = ?`,
          [access.departmentId, parsedDepartmentId]
        );
        if (!inScope) {
          return c.json({ error: '只能选择本部门及子部门内的部门' }, 400);
        }
      }

      resolvedDepartmentId = parsedDepartmentId;
    }

    // 确定创建者ID
    let createdBy = currentUser.id;

    // 如果提供了 assigned_to_admin，验证并使用它
    if (assigned_to_admin) {
      // 只有总管理员可以分配用户给子管理员
      if (!isSuperAdmin(currentUser)) {
        return c.json({ error: '只有总管理员可以分配用户所属' }, 403);
      }

      // 验证 assigned_to_admin 是否是有效的子管理员
      const targetAdmin = await db.get(
        'SELECT id FROM users WHERE id = ? AND role = ? AND admin_level = ?',
        [assigned_to_admin, 'admin', 'sub']
      );

      if (!targetAdmin) {
        return c.json({ error: '指定的管理员不存在或不是子管理员' }, 400);
      }

      createdBy = assigned_to_admin;
    }

    // 检查用户名是否已存在
    const existingUser = await db.get(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUser) {
      return c.json({ error: '用户名已存在' }, 400);
    }

    // 检查邮箱是否已存在（如果提供了邮箱）
    if (email) {
      const existingEmail = await db.get(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );

      if (existingEmail) {
        return c.json({ error: '邮箱已存在' }, 400);
      }
    }

    // 加密密码 - 使用异步方法避免阻塞
    const hashedPassword = await bcrypt.hash(password, 10);

    // 获取当前本地时间
    const now = getCurrentShanghaiTime();

    // 确定用户角色和层级
    const userRole = requestedAdminLevel ? 'admin' : 'user';
    const userAdminLevel = requestedAdminLevel;

    // 创建用户（使用确定的创建者ID）
    const result = await db.run(
      'INSERT INTO users (username, password, email, role, admin_level, created_by, department_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        username,
        hashedPassword,
        email || null,
        userRole,
        userAdminLevel,
        createdBy,
        resolvedDepartmentId,
        now
      ]
    );

    const userId = result.meta?.last_row_id || result.lastInsertRowid;

    // 同步 RBAC 角色绑定（缺失时新用户无任何权限码）
    await syncUserRoleBinding(db, userId, userRole, userAdminLevel);

    // 处理产品配置（仅普通用户）
    const createdProducts = [];
    if (
      role === 'user' &&
      products &&
      Array.isArray(products) &&
      products.length > 0
    ) {
      for (const productConfig of products) {
        // 验证产品配置
        if (!productConfig.name || !productConfig.name.trim()) {
          continue; // 跳过没有名称的产品
        }

        const productName = productConfig.name.trim();
        const urls = productConfig.urls || [];

        // 过滤有效的URL
        const validUrls = urls.filter(
          (url: string) =>
            url && url.trim() && /[a-z0-9-]+\.[a-z0-9-]+/i.test(url.trim())
        );

        if (validUrls.length === 0) {
          continue; // 跳过没有有效URL的产品
        }

        try {
          // 1. 检查该用户下是否已有同名产品
          const existingUserProduct = await db.get(
            `
            SELECT id, name
            FROM products
            WHERE user_id = ? AND name = ?
          `,
            [userId, productName]
          );

          if (existingUserProduct) {
            logger.warn(`User ${userId} already has product: ${productName}`);
            continue; // 跳过重复的产品
          }

          // 2. 检查所有URL是否已被使用（使用标准化URL比对）
          for (const url of validUrls) {
            const normalizedUrl = normalizeUrl(url.trim());

            // 查询所有已有的URL并标准化后比对
            const allExistingUrls = await db.all(
              'SELECT id, product_id, url FROM product_urls'
            );

            for (const existingUrl of allExistingUrls) {
              const normalizedExisting = normalizeUrl(existingUrl.url);

              if (normalizedExisting === normalizedUrl) {
                // 获取占用该URL的产品信息
                const occupiedProduct = await db.get(
                  'SELECT name FROM products WHERE id = ?',
                  [existingUrl.product_id]
                );
                return c.json(
                  {
                    error: `URL "${url.trim()}" 已被产品 "${occupiedProduct?.name || '未知'}" 使用（标准化后相同）`
                  },
                  400
                );
              }
            }
          }

          // 3. 创建新产品（直接设置user_id）
          const productResult = await db.run(
            'INSERT INTO products (name, user_id) VALUES (?, ?)',
            [productName, userId]
          );

          const productId =
            productResult.meta?.last_row_id || productResult.lastInsertRowid;

          // 4. 批量添加URLs（保存标准化后的URL）
          for (const url of validUrls) {
            const normalizedUrl = normalizeUrl(url.trim());
            await db.run(
              'INSERT INTO product_urls (product_id, user_id, url) VALUES (?, ?, ?)',
              [productId, userId, normalizedUrl]
            );
          }

          createdProducts.push({
            id: productId,
            name: productName,
            url_count: validUrls.length
          });
        } catch (productError: any) {
          logger.error(
            `Failed to create product "${productName}" for user ${userId}`,
            productError
          );
          // 产品创建失败，但用户已创建，继续处理其他产品
        }
      }
    }

    return c.json({
      success: true,
      data: {
        id: userId,
        username,
        email,
        role: userRole,
        admin_level: userAdminLevel,
        department_id: resolvedDepartmentId,
        created_by: createdBy,
        created_at: now,
        products: createdProducts // 返回创建的产品列表
      },
      message:
        createdProducts.length > 0
          ? `用户创建成功，已关联 ${createdProducts.length} 个产品`
          : '用户创建成功'
    });
  } catch (error) {
    logger.error('Create user error', error);
    return c.json({ error: '创建用户失败' }, 500);
  }
});

// 创建或获取用户 (用于上传时的用户选择)
users.post('/create-or-get', authMiddleware, adminMiddleware, async c => {
  try {
    const { username, email, password } = await c.req.json();

    if (!username) {
      return c.json({ error: '用户名不能为空' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 先查找是否已存在
    let user = await db.get(
      'SELECT id, username, email, role, created_at FROM users WHERE username = ?',
      [username]
    );

    if (user) {
      return c.json({
        success: true,
        data: user,
        existed: true,
        message: '用户已存在'
      });
    }

    // 用户不存在，创建新用户
    const userPassword = password || 'temp123456'; // 使用传入的密码或默认密码
    const hashedPassword = await bcrypt.hash(userPassword, 10);

    // 获取当前本地时间
    const now = getCurrentShanghaiTime();

    const result = await db.run(
      'INSERT INTO users (username, password, email, role, created_at) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, email || null, 'user', now]
    );

    const userId = result.meta?.last_row_id || result.lastInsertRowid;

    // 同步 RBAC 角色绑定（缺失时新用户无任何权限码）
    await syncUserRoleBinding(db, userId, 'user', null);

    user = {
      id: userId,
      username,
      email,
      role: 'user',
      created_at: now
    };

    return c.json({
      success: true,
      data: user,
      existed: false,
      message: `新用户创建成功，密码：${userPassword}`,
      defaultPassword: userPassword
    });
  } catch (error) {
    logger.error('Create or get user error', error);
    return c.json({ error: '处理用户失败' }, 500);
  }
});

// 获取用户的Excel数据 (管理员可查看任何用户，普通用户只能查看自己的数据)
users.get('/:userId/data', authMiddleware, async c => {
  try {
    const userId = parseInt(c.req.param('userId'));

    if (isNaN(userId)) {
      return c.json({ error: '无效的用户ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);
    const currentUser = c.get('user');

    // 检查用户是否存在
    const user = await db.get(
      'SELECT id, username, created_by FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return c.json({ error: '用户不存在' }, 404);
    }

    // 权限检查：
    // - 总管理员可以查看所有用户数据
    // - 子管理员只能查看自己创建的用户数据
    // - 普通用户只能查看自己的数据
    if (currentUser.role === 'user' && currentUser.id !== userId) {
      return c.json({ error: '权限不足，只能查看自己的数据' }, 403);
    }

    if (isSubAdmin(currentUser)) {
      // 子管理员只能查看自己创建的用户数据
      if (user.created_by !== currentUser.id) {
        return c.json({ error: '权限不足，只能查看自己创建的用户数据' }, 403);
      }
    }

    // 获取用户有权限查看的Excel数据（考虑展示时间限制）
    // 定时发布功能：使用UTC时间进行比较

    const userData = await db.all(
      `
      SELECT
        ed.id,
        ed.file_id,
        ef.original_name as file_name,
        ef.data_year,
        ed.sheet_name,
        ed.row_index,
        ed.data,
        ed.created_at,
        ef.display_time,
        ef.scheduled_publish
      FROM excel_data ed
      JOIN excel_files ef ON ed.file_id = ef.id
      JOIN excel_file_permissions efp ON ef.id = efp.file_id
      WHERE efp.user_id = ?
        AND (
          ef.scheduled_publish = 0
          OR ef.display_time IS NULL
          OR datetime(ef.display_time, '-8 hours') <= datetime('now')
          OR ? = 'admin'
        )
      ORDER BY ed.created_at DESC, ed.file_id, ed.row_index
    `,
      [userId, currentUser.role]
    );

    // 解析数据并转换为前端需要的格式
    const formattedData = userData
      .map(row => {
        const parsedData = JSON.parse(row.data || '[]');

        // 假设数据结构是 [Date, Product, Requests, Matches, MatchRate, Impressions, ImpressionRate, Clicks, CRT, eCPM, Revenue]
        return {
          id: row.id,
          file_id: row.file_id,
          file_name: row.file_name,
          data_year: row.data_year,
          sheet_name: row.sheet_name,
          row_index: row.row_index,
          date: parsedData[0] || '',
          product: parsedData[1] || '',
          requests: parsedData[2] || 0,
          matches: parsedData[3] || 0,
          match_rate: parsedData[4] || 0,
          impressions: parsedData[5] || 0,
          impression_rate: parsedData[6] || 0,
          clicks: parsedData[7] || 0,
          crt: parsedData[8] || 0,
          ecpm: parsedData[9] || 0,
          revenue: parsedData[10] || 0,
          user_id: userId,
          created_at: row.created_at
        };
      })
      .filter(item => item.row_index > 0); // 过滤掉表头行

    return c.json({
      success: true,
      data: formattedData,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    logger.error('Get user data error', error);
    return c.json({ error: '获取用户数据失败' }, 500);
  }
});

// 更新用户信息（需 system:user:update 权限；行级归属仍由 canManageUser 二次校验）
users.put('/:userId', authMiddleware, requirePermission(PERMISSION_CODES.systemUserUpdate), async c => {
  try {
    const userId = parseInt(c.req.param('userId'));
    const payload = await c.req.json();
    const { admin_level, department_id, email, is_active, password, products, role } = payload;
    const currentUser = c.get('user');

    if (isNaN(userId)) {
      return c.json({ error: '无效的用户ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 检查用户是否存在，并获取用户信息
    const existingUser = await db.get(
      'SELECT id, username, role, admin_level, department_id, created_by, is_system FROM users WHERE id = ?',
      [userId]
    );

    if (!existingUser) {
      return c.json({ error: '用户不存在' }, 404);
    }

    // 权限检查：子管理员只能修改自己创建的用户
    if (!canManageUser(currentUser, userId, existingUser.created_by)) {
      return c.json({ error: '权限不足，只能修改自己创建的用户' }, 403);
    }

    // 状态变更防呆：不能禁用自己，受保护的系统账户不能禁用
    if (is_active !== undefined) {
      if (typeof is_active !== 'boolean') {
        return c.json({ error: '状态值无效' }, 400);
      }
      if (!is_active && Number(currentUser.id) === userId) {
        return c.json({ error: '不能禁用自己' }, 400);
      }
      if (!is_active && Boolean(existingUser.is_system)) {
        return c.json({ error: '受保护的系统账户不能禁用' }, 403);
      }
    }

    const changesAccess = role !== undefined || admin_level !== undefined;
    if (changesAccess && !isSuperAdmin(currentUser)) {
      return c.json({ error: '只有总管理员可以修改用户角色' }, 403);
    }

    if (changesAccess && Boolean(existingUser.is_system)) {
      return c.json({ error: '受保护的系统账户不能修改角色' }, 403);
    }

    const nextRole = role ?? existingUser.role;
    if (!['admin', 'user'].includes(nextRole)) {
      return c.json({ error: '用户角色无效' }, 400);
    }

    let nextAdminLevel = admin_level ?? existingUser.admin_level;
    if (nextRole === 'user') {
      nextAdminLevel = null;
    } else if (!['super', 'sub'].includes(nextAdminLevel)) {
      nextAdminLevel = 'sub';
    }

    const demotesSuperAdmin =
      existingUser.role === 'admin' &&
      existingUser.admin_level === 'super' &&
      (nextRole !== 'admin' || nextAdminLevel !== 'super');

    if (demotesSuperAdmin) {
      const superAdminCount = await db.get(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND admin_level = 'super'"
      );
      if (Number(superAdminCount?.count) <= 1) {
        return c.json({ error: '系统必须至少保留一个总管理员' }, 400);
      }
    }

    // 验证密码格式（如果提供密码）
    if (password) {
      // 8-18位，包含数字、字母、符号的任意两种组合
      const hasNumber = /\d/.test(password);
      const hasLetter = /[a-zA-Z]/.test(password);
      const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

      const typesCount = [hasNumber, hasLetter, hasSymbol].filter(
        Boolean
      ).length;

      if (password.length < 8 || password.length > 18) {
        return c.json({ error: '密码长度应为8-18位' }, 400);
      }

      if (typesCount < 2) {
        return c.json(
          { error: '密码必须包含数字、字母、符号中的至少两种' },
          400
        );
      }
    }

    // 检查邮箱是否已存在（如果提供邮箱且不为空）
    if (email && email.trim() !== '') {
      const existingEmail = await db.get(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );

      if (existingEmail) {
        return c.json({ error: '邮箱已存在' }, 400);
      }
    }

    // 构建更新字段和参数
    const updateFields = [];
    const params = [];

    if (email !== undefined) {
      updateFields.push('email = ?');
      params.push(email || null);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('password = ?');
      params.push(hashedPassword);
    }

    if (changesAccess) {
      updateFields.push('role = ?');
      params.push(nextRole);
      updateFields.push('admin_level = ?');
      params.push(nextAdminLevel);
    }

    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'department_id') || nextAdminLevel === 'super') {
      let resolvedDepartmentId: number | null = null;

      if (nextAdminLevel !== 'super' && department_id !== null && department_id !== undefined) {
        const parsedDepartmentId = Number(department_id);
        if (!Number.isInteger(parsedDepartmentId)) {
          return c.json({ error: '部门ID无效' }, 400);
        }

        const department = await db.get(
          `SELECT d.id
           FROM departments d
           WHERE d.id = ?
             AND NOT EXISTS (SELECT 1 FROM departments child WHERE child.parent_id = d.id)`,
          [parsedDepartmentId]
        );
        if (!department) {
          return c.json({ error: '用户只能分配到有效的子部门' }, 400);
        }

        resolvedDepartmentId = parsedDepartmentId;
      }

      updateFields.push('department_id = ?');
      params.push(resolvedDepartmentId);
    }

    // 更新用户基本信息（如果有）
    if (updateFields.length > 0) {
      params.push(userId);
      const updateQuery = `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      await db.run(updateQuery, params);
    }

    // 角色变更后重同步 RBAC 绑定（下次刷新令牌生效）
    if (changesAccess) {
      await syncUserRoleBinding(db, userId, nextRole, nextAdminLevel);
    }

    // 处理产品配置更新（完全替换模式）
    const updatedProducts = [];
    if (products && Array.isArray(products)) {
      // 1. 获取该用户当前的所有产品及其URLs（按ID升序，旧的在前）
      const currentUserProducts = await db.all(
        'SELECT id, name FROM products WHERE user_id = ? ORDER BY id ASC',
        [userId]
      );

      // 获取每个产品的URLs
      const currentProductsWithUrls = await Promise.all(
        currentUserProducts.map(async (product: any) => {
          const urls = await db.all(
            'SELECT url FROM product_urls WHERE product_id = ? ORDER BY url',
            [product.id]
          );
          return {
            name: product.name,
            urls: urls.map((u: any) => u.url).sort()
          };
        })
      );

      // 2. 检查产品配置是否真的变化了
      const incomingProducts = products
        .filter(p => p.name && p.name.trim())
        .map(p => ({
          name: p.name.trim(),
          urls: (p.urls || [])
            .filter(
              (url: string) =>
                url && url.trim() && /[a-z0-9-]+\.[a-z0-9-]+/i.test(url.trim())
            )
            .map((url: string) => normalizeUrl(url.trim()))
            .sort()
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const currentProducts = currentProductsWithUrls
        .map(p => ({
          name: p.name,
          urls: p.urls.sort()
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // 比较产品配置是否相同
      const productsChanged =
        JSON.stringify(currentProducts) !== JSON.stringify(incomingProducts);

      if (!productsChanged) {
        // 产品配置未变化，跳过更新
        logger.info(`User ${userId} products unchanged, skipping update`);
      } else {
        // 产品配置有变化，执行增量更新（增/删/改）
        logger.info(
          `User ${userId} products changed, performing incremental update`
        );

        // 2. 建立产品ID和名称到产品信息的映射
        const currentProductsByIdMap = new Map<
          number,
          { id: number; name: string; urls: string[] }
        >();
        const currentProductsByNameMap = new Map<
          string,
          { id: number; name: string; urls: string[] }
        >();

        for (const product of currentUserProducts) {
          const urls = await db.all(
            'SELECT url FROM product_urls WHERE product_id = ? ORDER BY url',
            [product.id]
          );
          const productInfo = {
            id: product.id,
            name: product.name,
            urls: urls.map((u: any) => u.url).sort()
          };
          currentProductsByIdMap.set(product.id, productInfo);
          currentProductsByNameMap.set(product.name, productInfo);
        }

        // 构建incoming products映射（支持ID和name）
        const incomingProductsMap = new Map<
          number | string,
          { id?: number; name: string; urls: string[] }
        >();
        for (const p of products) {
          if (!p.name || !p.name.trim()) continue;
          const name = p.name.trim();
          const urls = (p.urls || [])
            .filter(
              (url: string) =>
                url && url.trim() && /[a-z0-9-]+\.[a-z0-9-]+/i.test(url.trim())
            )
            .map((url: string) => normalizeUrl(url.trim()))
            .sort();
          if (urls.length > 0) {
            const key = p.id !== undefined ? p.id : name; // 优先使用ID作为key
            incomingProductsMap.set(key, { id: p.id, name, urls });
          }
        }

        // 3. 识别需要新增/更新/删除的产品
        const productsToAdd: Array<{ name: string; urls: string[] }> = [];
        const productsToUpdate: Array<{
          id: number;
          oldName: string;
          newName: string;
          oldUrls: string[];
          newUrls: string[];
        }> = [];
        const productsToDelete: number[] = [];
        const processedProductIds = new Set<number>();

        // 找出需要新增和更新的产品
        for (const [key, incoming] of incomingProductsMap.entries()) {
          let matched = false;

          // 优先通过ID匹配（如果incoming有ID）
          if (
            incoming.id !== undefined &&
            currentProductsByIdMap.has(incoming.id)
          ) {
            const current = currentProductsByIdMap.get(incoming.id)!;
            processedProductIds.add(current.id);

            // 检查name或urls是否变化
            const nameChanged = current.name !== incoming.name;
            const urlsChanged =
              JSON.stringify(current.urls) !== JSON.stringify(incoming.urls);

            if (nameChanged || urlsChanged) {
              productsToUpdate.push({
                id: current.id,
                oldName: current.name,
                newName: incoming.name,
                oldUrls: current.urls,
                newUrls: incoming.urls
              });
            }
            matched = true;
          }
          // 如果没有ID或ID未匹配，尝试通过name匹配（向后兼容）
          else if (
            typeof key === 'string' &&
            currentProductsByNameMap.has(key)
          ) {
            const current = currentProductsByNameMap.get(key)!;
            processedProductIds.add(current.id);

            const urlsChanged =
              JSON.stringify(current.urls) !== JSON.stringify(incoming.urls);
            if (urlsChanged) {
              productsToUpdate.push({
                id: current.id,
                oldName: current.name,
                newName: incoming.name,
                oldUrls: current.urls,
                newUrls: incoming.urls
              });
            }
            matched = true;
          }

          // 如果都没匹配到，说明是新产品
          if (!matched) {
            productsToAdd.push({ name: incoming.name, urls: incoming.urls });
          }
        }

        // 找出需要删除的产品（当前存在但incoming中没有的）
        for (const [id, current] of currentProductsByIdMap.entries()) {
          if (!processedProductIds.has(id)) {
            productsToDelete.push(id);
          }
        }

        logger.info(
          `Products diff: ${productsToAdd.length} to add, ${productsToUpdate.length} to update, ${productsToDelete.length} to delete`
        );

        // 4. 执行新增产品
        for (const product of productsToAdd) {
          try {
            // 检查URLs是否已被当前用户的其他产品使用
            for (const url of product.urls) {
              const existing = await db.get(
                'SELECT pu.id, pu.product_id, p.name FROM product_urls pu JOIN products p ON pu.product_id = p.id WHERE pu.url = ? AND pu.user_id = ?',
                [url, userId]
              );
              if (existing) {
                return c.json(
                  {
                    error: `URL "${url}" 已被产品 "${existing.name}" 使用`
                  },
                  400
                );
              }
            }

            // 创建新产品
            const productResult = await db.run(
              'INSERT INTO products (name, user_id) VALUES (?, ?)',
              [product.name, userId]
            );
            const productId =
              productResult.meta?.last_row_id || productResult.lastInsertRowid;

            // 添加URLs（标准化后保存）
            for (const url of product.urls) {
              const normalizedUrl = normalizeUrl(url.trim());
              await db.run(
                'INSERT INTO product_urls (product_id, user_id, url) VALUES (?, ?, ?)',
                [productId, userId, normalizedUrl]
              );
            }

            updatedProducts.push({
              id: productId,
              name: product.name,
              url_count: product.urls.length,
              action: 'added'
            });
            logger.info(
              `Added product "${product.name}" with ${product.urls.length} URLs`
            );
          } catch (error: any) {
            logger.error(`Failed to add product "${product.name}"`, error);
          }
        }

        // 5. 执行更新产品（更新name和URLs）
        for (const product of productsToUpdate) {
          try {
            // 5.1 如果产品名称变化，先更新产品名称
            if (product.oldName !== product.newName) {
              await db.run('UPDATE products SET name = ? WHERE id = ?', [
                product.newName,
                product.id
              ]);
              logger.info(
                `Updated product name: "${product.oldName}" -> "${product.newName}"`
              );
            }

            // 5.2 更新URLs
            const urlsToDelete = product.oldUrls.filter(
              url => !product.newUrls.includes(url)
            );
            const urlsToAdd = product.newUrls.filter(
              url => !product.oldUrls.includes(url)
            );

            // 检查新增的URLs是否已被当前用户的其他产品使用
            for (const url of urlsToAdd) {
              const existing = await db.get(
                'SELECT pu.id, pu.product_id, p.name FROM product_urls pu JOIN products p ON pu.product_id = p.id WHERE pu.url = ? AND pu.product_id != ? AND pu.user_id = ?',
                [url, product.id, userId]
              );
              if (existing) {
                return c.json(
                  {
                    error: `URL "${url}" 已被产品 "${existing.name}" 使用`
                  },
                  400
                );
              }
            }

            // 删除旧URLs及其关联的原始数据
            for (const url of urlsToDelete) {
              // 删除 product_urls
              await db.run(
                'DELETE FROM product_urls WHERE product_id = ? AND url = ?',
                [product.id, url]
              );

              // 同时删除 raw_data 中该 URL 的所有历史记录
              // 这样可以保持数据一致性，避免显示已删除URL的数据
              await db.run(
                'DELETE FROM raw_data WHERE url = ? AND user_id = ?',
                [url, userId]
              );

              logger.info(
                `Deleted URL "${url}" and its raw_data records for product "${product.newName}"`
              );
            }

            // 添加新URLs（标准化后保存）
            for (const url of urlsToAdd) {
              const normalizedUrl = normalizeUrl(url.trim());
              await db.run(
                'INSERT INTO product_urls (product_id, user_id, url) VALUES (?, ?, ?)',
                [product.id, userId, normalizedUrl]
              );
            }

            updatedProducts.push({
              id: product.id,
              name: product.newName,
              url_count: product.newUrls.length,
              action: 'updated',
              urls_added: urlsToAdd.length,
              urls_removed: urlsToDelete.length
            });
            logger.info(
              `Updated product "${product.newName}": +${urlsToAdd.length} URLs, -${urlsToDelete.length} URLs`
            );
          } catch (error: any) {
            logger.error(
              `Failed to update product "${product.newName}"`,
              error
            );
          }
        }

        // 6. 执行删除产品（CASCADE会自动删除关联的product_urls和data_reports）
        for (const productId of productsToDelete) {
          try {
            const product = await db.get(
              'SELECT name FROM products WHERE id = ?',
              [productId]
            );
            await db.run('DELETE FROM products WHERE id = ?', [productId]);
            logger.info(`Deleted product "${product?.name}" (id=${productId})`);
          } catch (error: any) {
            logger.error(`Failed to delete product id=${productId}`, error);
          }
        }
      } // 结束 else 块（产品配置有变化）
    }

    // 获取更新后的用户信息
    const updatedUser = await db.get(
      `SELECT
         u.id,
         u.username,
         u.email,
         u.role,
         u.admin_level,
         u.department_id,
         u.is_system,
         u.created_at,
         department.name AS department_name,
         parent_department.name AS department_parent_name
       FROM users u
       LEFT JOIN departments department ON u.department_id = department.id
       LEFT JOIN departments parent_department ON department.parent_id = parent_department.id
       WHERE u.id = ?`,
      [userId]
    );

    const message =
      updatedProducts.length > 0
        ? `用户信息更新成功，已更新 ${updatedProducts.length} 个产品`
        : updateFields.length > 0
          ? '用户信息更新成功'
          : '没有内容需要更新';

    return c.json({
      success: true,
      data: {
        ...updatedUser,
        products: updatedProducts
      },
      message
    });
  } catch (error) {
    logger.error('Update user error', error);
    return c.json({ error: '更新用户信息失败' }, 500);
  }
});

// 删除用户（需 system:user:delete 权限，种子中仅 super 持有；canDeleteUser 继续拦自删/系统账户）
users.delete('/:userId', authMiddleware, requirePermission(PERMISSION_CODES.systemUserDelete), async c => {
  try {
    const userId = parseInt(c.req.param('userId'));
    const currentUser = c.get('user');

    if (isNaN(userId)) {
      return c.json({ error: '无效的用户ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 获取目标用户信息
    const targetUser = await db.get(
      'SELECT id, username, role, admin_level, created_by, is_system FROM users WHERE id = ?',
      [userId]
    );

    if (!targetUser) {
      return c.json({ error: '用户不存在' }, 404);
    }

    // 权限检查：只有总管理员可以删除用户
    if (!canDeleteUser(currentUser, targetUser)) {
      return c.json(
        {
          error: '权限不足，不能删除自己或受保护的系统账户'
        },
        403
      );
    }

    if (targetUser.role === 'admin' && targetUser.admin_level === 'super') {
      const superAdminCount = await db.get(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND admin_level = 'super'"
      );
      if (Number(superAdminCount?.count) <= 1) {
        return c.json({ error: '系统必须至少保留一个总管理员' }, 400);
      }
    }

    // 按正确顺序删除关联数据（外键约束要求先删除子表数据）

    // 1. 删除该用户上传的文件的所有数据
    await db.run(
      'DELETE FROM excel_data WHERE file_id IN (SELECT id FROM excel_files WHERE uploaded_by = ?)',
      [userId]
    );

    // 2. 删除所有与该用户上传的文件相关的权限（包括分配给其他用户的权限）
    await db.run(
      'DELETE FROM excel_file_permissions WHERE file_id IN (SELECT id FROM excel_files WHERE uploaded_by = ?)',
      [userId]
    );

    // 3. 删除该用户上传的文件
    await db.run('DELETE FROM excel_files WHERE uploaded_by = ?', [userId]);

    // 4. 删除该用户的文件访问权限记录（作为被授权者或授权者）
    await db.run(
      'DELETE FROM excel_file_permissions WHERE user_id = ? OR granted_by = ?',
      [userId, userId]
    );

    // 5. 将该用户创建的子用户的 created_by 设置为 NULL（保留用户但断开关联）
    await db.run('UPDATE users SET created_by = NULL WHERE created_by = ?', [
      userId
    ]);

    // 6. 最后删除用户本身
    await db.run('DELETE FROM users WHERE id = ?', [userId]);

    return c.json({
      success: true,
      message: '用户删除成功'
    });
  } catch (error) {
    logger.error('Delete user error', error);
    return c.json({ error: '删除用户失败' }, 500);
  }
});

// ============================================
// 用户产品关联管理 (仅管理员)
// ============================================

// 获取用户关联的产品列表
users.get('/:userId/products', authMiddleware, adminMiddleware, async c => {
  try {
    const userId = parseInt(c.req.param('userId'));

    if (isNaN(userId)) {
      return c.json({ error: '无效的用户ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 检查用户是否存在
    const user = await db.get('SELECT id, username FROM users WHERE id = ?', [
      userId
    ]);
    if (!user) {
      return c.json({ error: '用户不存在' }, 404);
    }

    // 获取用户的所有产品（按创建时间升序，旧的在前）
    const products = await db.all(
      `
      SELECT
        p.id,
        p.name,
        p.created_at,
        GROUP_CONCAT(pu.url) AS urls
      FROM products p
      LEFT JOIN product_urls pu ON p.id = pu.product_id
      WHERE p.user_id = ?
      GROUP BY p.id, p.name, p.created_at
      ORDER BY p.id ASC
    `,
      [userId]
    );

    return c.json({
      success: true,
      data: {
        user: { id: user.id, username: user.username },
        products: products.map((p: any) => ({
          ...p,
          urls: p.urls ? p.urls.split(',').map(maskUrl).join(',') : null
        }))
      }
    });
  } catch (error) {
    logger.error('Get user products error', error);
    return c.json({ error: '获取用户产品列表失败' }, 500);
  }
});

// 为用户关联产品
// 注意：迁移006后，产品属于用户（一对多），不再支持"关联产品"功能
// 如需添加产品，请使用创建用户或更新用户接口
/* DEPRECATED after migration 006
users.post('/:userId/products', authMiddleware, adminMiddleware, async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'));
    const { product_id, product_ids } = await c.req.json();

    if (isNaN(userId)) {
      return c.json({ error: '无效的用户ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 检查用户是否存在
    const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return c.json({ error: '用户不存在' }, 404);
    }

    // 处理单个产品ID或批量产品ID
    const productIds = product_ids ? product_ids : (product_id ? [product_id] : []);

    if (productIds.length === 0) {
      return c.json({ error: '产品ID不能为空' }, 400);
    }

    // 验证所有产品是否存在
    const placeholders = productIds.map(() => '?').join(',');
    const existingProducts = await db.all(
      `SELECT id FROM products WHERE id IN (${placeholders})`,
      productIds
    );

    if (existingProducts.length !== productIds.length) {
      return c.json({ error: '部分产品不存在' }, 400);
    }

    // 批量插入用户产品关联（使用 INSERT OR IGNORE 避免重复）
    const addedProducts = [];
    for (const productId of productIds) {
      try {
        await db.run(
          'INSERT OR IGNORE INTO user_products (user_id, product_id) VALUES (?, ?)',
          [userId, productId]
        );
        addedProducts.push(productId);
      } catch (error) {
        logger.warn(`Failed to associate product ${productId} with user ${userId}`, error);
      }
    }

    return c.json({
      success: true,
      data: {
        user_id: userId,
        added_count: addedProducts.length,
        product_ids: addedProducts
      },
      message: `成功关联 ${addedProducts.length} 个产品`
    });

  } catch (error) {
    logger.error('Add user products error', error);
    return c.json({ error: '关联产品失败' }, 500);
  }
});
*/

// 删除用户产品关联
// 注意：迁移006后，产品属于用户（一对多），不再支持"取消关联产品"功能
// 如需删除产品，请使用更新用户接口（删除产品配置）
/* DEPRECATED after migration 006
users.delete('/:userId/products/:productId', authMiddleware, adminMiddleware, async (c) => {
  try {
    const userId = parseInt(c.req.param('userId'));
    const productId = parseInt(c.req.param('productId'));

    if (isNaN(userId) || isNaN(productId)) {
      return c.json({ error: '无效的用户ID或产品ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 检查关联是否存在
    const association = await db.get(
      'SELECT id FROM user_products WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    if (!association) {
      return c.json({ error: '用户产品关联不存在' }, 404);
    }

    // 删除关联
    await db.run(
      'DELETE FROM user_products WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    return c.json({
      success: true,
      message: '产品关联删除成功'
    });

  } catch (error) {
    logger.error('Delete user product error', error);
    return c.json({ error: '删除产品关联失败' }, 500);
  }
});
*/

// 普通用户查看自己的 API Key（只读）
users.get('/me/api-key', authMiddleware, async c => {
  const currentUser = c.get('user');
  const db = new DatabaseWrapper(c.env.DB);

  try {
    // 查询用户的 API Key
    const apiKeyRecord = await db.get(
      `
      SELECT api_key, is_active, created_at, expires_at, last_used_at
      FROM api_keys
      WHERE user_id = ?
    `,
      [currentUser.id]
    );

    // 用户没有 API Key
    if (!apiKeyRecord) {
      return c.json({
        success: true,
        data: {
          has_api_key: false,
          status_message: '您还没有 API Key，请联系管理员申请'
        }
      });
    }

    // 部分隐藏 API Key（显示前6位和后3位）
    const fullKey = apiKeyRecord.api_key;
    const maskedKey = `${fullKey.substring(0, 6)}...${fullKey.substring(fullKey.length - 3)}`;

    // 检查状态
    let statusMessage = null;
    if (!apiKeyRecord.is_active) {
      statusMessage = '您的 API Key 已被禁用，请联系管理员';
    } else if (
      apiKeyRecord.expires_at &&
      new Date(apiKeyRecord.expires_at) < new Date()
    ) {
      statusMessage = '您的 API Key 已过期，请联系管理员';
    }

    return c.json({
      success: true,
      data: {
        has_api_key: true,
        api_key: maskedKey,
        api_key_full: fullKey,
        is_active: apiKeyRecord.is_active === 1,
        created_at: apiKeyRecord.created_at
          ? toBeijingTime(apiKeyRecord.created_at)
          : null,
        expires_at: apiKeyRecord.expires_at
          ? toBeijingTime(apiKeyRecord.expires_at)
          : null,
        last_used_at: apiKeyRecord.last_used_at
          ? toBeijingTime(apiKeyRecord.last_used_at)
          : null,
        status_message: statusMessage
      }
    });
  } catch (error) {
    logger.error('Get user API key error', error);
    return c.json({ error: '获取 API Key 失败' }, 500);
  }
});

export default users;
