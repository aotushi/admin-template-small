import { Hono } from 'hono';
import * as bcrypt from 'bcryptjs';
import { DATA_SCOPES, PERMISSION_CODES, ROLE_CODES } from '@admin-backend-3/admin-api-contract/permissions';
import { DatabaseWrapper } from '../models/database';
import type { Env } from '../index';
import { canDeleteUser, canManageUser, isSuperAdmin } from '../middlewares/permissions';
import { authMiddleware } from '../middlewares/auth';
import {
  assignUserRoles,
  buildUsersScopeCondition,
  countOtherActiveSuperAdmins,
  getUserAccess,
  requirePermission,
  resolveActiveRoles
} from '../services/permissions';
import { getCurrentShanghaiTime } from '../utils/datetime';
import { logger } from '../utils/logger';

const users = new Hono<{ Bindings: Env }>();

/** 用户与角色多对多：把角色码/角色名聚合成数组挂到每个用户行上 */
async function attachUserRoles(
  db: DatabaseWrapper,
  rows: any[]
): Promise<any[]> {
  if (rows.length === 0) {
    return rows;
  }

  const placeholders = rows.map(() => '?').join(', ');
  const bindings = await db.all(
    `SELECT ur.user_id, r.code, r.name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id IN (${placeholders})
     ORDER BY r.id ASC`,
    rows.map(row => row.id)
  );

  const rolesByUser = new Map<number, Array<{ code: string; name: string }>>();
  for (const binding of bindings as any[]) {
    const list = rolesByUser.get(binding.user_id) ?? [];
    list.push({ code: binding.code, name: binding.name });
    rolesByUser.set(binding.user_id, list);
  }

  return rows.map(row => {
    const roles = rolesByUser.get(row.id) ?? [];
    return {
      ...row,
      roles,
      role_codes: roles.map(role => role.code)
    };
  });
}

/** 查询目标用户当前绑定的角色码（含停用角色——绑定关系本身仍存在） */
async function getUserRoleCodes(
  db: DatabaseWrapper,
  userId: number
): Promise<string[]> {
  const rows = await db.all(
    `SELECT r.code FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ? ORDER BY r.id ASC`,
    [userId]
  );
  return (rows as any[]).map(row => row.code);
}

/**
 * 校验 roles 入参并应用角色业务规则，返回错误文案或校验通过的角色行。
 * 规则：全部存在且启用；super 不可与其他角色叠加；非纯 user 组合仅 super 可授予。
 */
async function validateRoleAssignment(
  db: DatabaseWrapper,
  currentUser: { id: number; role_codes: string[]; username: string },
  roleCodes: unknown
): Promise<{ error: string } | { roles: Array<{ code: string; id: number }> }> {
  if (
    !Array.isArray(roleCodes) ||
    roleCodes.length === 0 ||
    roleCodes.some(code => typeof code !== 'string' || !code.trim())
  ) {
    return { error: '用户角色无效' };
  }

  const codes = [...new Set(roleCodes as string[])];

  // super 是唯一顶点角色：叠加其他角色只会让"谁能管谁"的规则产生歧义
  if (codes.includes(ROLE_CODES.super) && codes.length > 1) {
    return { error: '总管理员角色不可与其他角色叠加' };
  }

  const roles = await resolveActiveRoles(db, codes);
  if (!roles) {
    return { error: '用户角色无效' };
  }

  // 只有总管理员可以授予普通用户以外的角色（含自定义角色）
  const grantsBeyondUser = codes.some(code => code !== ROLE_CODES.user);
  if (grantsBeyondUser && !isSuperAdmin(currentUser)) {
    return { error: '只有总管理员可以授予管理员权限' };
  }

  return { roles };
}

/** 校验部门是否为有效末级部门；通过返回部门 id，否则返回错误文案 */
async function validateLeafDepartment(
  db: DatabaseWrapper,
  departmentId: unknown
): Promise<{ error: string } | { id: number }> {
  const parsed = Number(departmentId);
  if (!Number.isInteger(parsed)) {
    return { error: '部门ID无效' };
  }

  const department = await db.get(
    `SELECT d.id
     FROM departments d
     WHERE d.id = ?
       AND NOT EXISTS (SELECT 1 FROM departments child WHERE child.parent_id = d.id)`,
    [parsed]
  );
  return department ? { id: parsed } : { error: '用户只能分配到有效的子部门' };
}

// 获取所有用户列表（需 system:user:view 权限，行级可见性由角色数据范围决定）
users.get('/list', authMiddleware, requirePermission(PERMISSION_CODES.systemUserView), async c => {
  try {
    const db = new DatabaseWrapper(c.env.DB);
    const currentUser = c.get('user');

    // 构建查询语句（角色是多对多，另查 user_roles 聚合，避免 JOIN 产生重复行）
    let query = `
      SELECT
        u.id,
        u.username,
        u.email,
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
      data: await attachUserRoles(db, usersList)
    });
  } catch (error) {
    logger.error('Users list error', error);
    return c.json({ error: '获取用户列表失败' }, 500);
  }
});

// 创建新用户（需 system:user:create 权限）
users.post('/create', authMiddleware, requirePermission(PERMISSION_CODES.systemUserCreate), async c => {
  try {
    const {
      username,
      email,
      password,
      roles = [ROLE_CODES.user],
      department_id,
      assigned_to_admin
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

    const db = new DatabaseWrapper(c.env.DB);

    const roleAssignment = await validateRoleAssignment(db, currentUser, roles);
    if ('error' in roleAssignment) {
      return c.json({ error: roleAssignment.error }, roleAssignment.error.startsWith('只有') ? 403 : 400);
    }
    const roleCodes = roleAssignment.roles.map(role => role.code);
    const isSuperTarget = roleCodes.includes(ROLE_CODES.super);

    let resolvedDepartmentId: number | null = null;
    if (!isSuperTarget) {
      // 部门必填：无部门用户对 dept 数据范围的查看者不可见，避免产生"孤儿用户"
      if (department_id === undefined || department_id === null) {
        return c.json({ error: '请选择部门' }, 400);
      }

      const leaf = await validateLeafDepartment(db, department_id);
      if ('error' in leaf) {
        return c.json({ error: leaf.error }, 400);
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
          [access.departmentId, leaf.id]
        );
        if (!inScope) {
          return c.json({ error: '只能选择本部门及子部门内的部门' }, 400);
        }
      }

      resolvedDepartmentId = leaf.id;
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
        `SELECT u.id FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE u.id = ? AND r.code = ?`,
        [assigned_to_admin, ROLE_CODES.admin]
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

    // 创建用户（使用确定的创建者ID）
    const result = await db.run(
      'INSERT INTO users (username, password, email, created_by, department_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        username,
        hashedPassword,
        email || null,
        createdBy,
        resolvedDepartmentId,
        now
      ]
    );

    const userId = result.meta?.last_row_id || result.lastInsertRowid;

    // 写入 RBAC 角色绑定（user_roles 是角色归属唯一来源，缺失时新用户无任何权限码）
    await assignUserRoles(c.env.DB, userId, roleAssignment.roles.map(role => role.id));

    return c.json({
      success: true,
      data: {
        id: userId,
        username,
        email,
        role_codes: roleCodes,
        department_id: resolvedDepartmentId,
        created_by: createdBy,
        created_at: now
      },
      message: '用户创建成功'
    });
  } catch (error) {
    logger.error('Create user error', error);
    return c.json({ error: '创建用户失败' }, 500);
  }
});

// 更新用户信息（需 system:user:update 权限；行级归属仍由 canManageUser 二次校验）
users.put('/:userId', authMiddleware, requirePermission(PERMISSION_CODES.systemUserUpdate), async c => {
  try {
    const userId = parseInt(c.req.param('userId'));
    const payload = await c.req.json();
    const { department_id, email, is_active, password, roles } = payload;
    const currentUser = c.get('user');

    if (isNaN(userId)) {
      return c.json({ error: '无效的用户ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    // 检查用户是否存在（角色绑定另查，避免多角色 JOIN 行数不确定）
    const existingUser = await db.get(
      'SELECT id, username, department_id, created_by, is_system FROM users WHERE id = ?',
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

    const changesAccess = roles !== undefined;
    if (changesAccess && !isSuperAdmin(currentUser)) {
      return c.json({ error: '只有总管理员可以修改用户角色' }, 403);
    }

    if (changesAccess && Boolean(existingUser.is_system)) {
      return c.json({ error: '受保护的系统账户不能修改角色' }, 403);
    }

    // 目标角色集：未传时沿用现绑定
    const currentRoleCodes = await getUserRoleCodes(db, userId);
    let nextRoleCodes = currentRoleCodes;
    let nextRoleIds: null | number[] = null;
    if (changesAccess) {
      const roleAssignment = await validateRoleAssignment(db, currentUser, roles);
      if ('error' in roleAssignment) {
        return c.json({ error: roleAssignment.error }, roleAssignment.error.startsWith('只有') ? 403 : 400);
      }
      nextRoleCodes = roleAssignment.roles.map(role => role.code);
      nextRoleIds = roleAssignment.roles.map(role => role.id);
    }

    const demotesSuperAdmin =
      currentRoleCodes.includes(ROLE_CODES.super) &&
      !nextRoleCodes.includes(ROLE_CODES.super);

    // 系统必须保留至少一个"启用状态"的总管理员（停用的 super 登录即被拦，不算数）
    if (demotesSuperAdmin && (await countOtherActiveSuperAdmins(db, userId)) < 1) {
      return c.json({ error: '系统必须至少保留一个总管理员' }, 400);
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

    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    // 部门与最终角色集联动：super 不归属部门，其余角色必须落在有效末级部门
    const isSuperTarget = nextRoleCodes.includes(ROLE_CODES.super);
    if (isSuperTarget) {
      // 升为/保持 super 时强制清空部门
      if (existingUser.department_id !== null || Object.prototype.hasOwnProperty.call(payload, 'department_id')) {
        updateFields.push('department_id = ?');
        params.push(null);
      }
    } else {
      const hasDeptInPayload = Object.prototype.hasOwnProperty.call(payload, 'department_id');
      if (hasDeptInPayload) {
        if (department_id === null || department_id === undefined) {
          return c.json({ error: '请选择部门' }, 400);
        }
        const leaf = await validateLeafDepartment(db, department_id);
        if ('error' in leaf) {
          return c.json({ error: leaf.error }, 400);
        }
        updateFields.push('department_id = ?');
        params.push(leaf.id);
      } else if (existingUser.department_id === null) {
        // 目标角色集非 super 但用户没有部门（如从 super 降级）：必须补部门
        return c.json({ error: '请选择部门' }, 400);
      }
    }

    // 更新用户基本信息（如果有）
    if (updateFields.length > 0) {
      params.push(userId);
      const updateQuery = `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      await db.run(updateQuery, params);
    }

    // 角色变更后原子重设 user_roles 绑定（下次请求即生效，authMiddleware 每请求实时解析）
    if (changesAccess && nextRoleIds) {
      await assignUserRoles(c.env.DB, userId, nextRoleIds);
    }

    // 获取更新后的用户信息
    const updatedUser = await db.get(
      `SELECT
         u.id,
         u.username,
         u.email,
         u.department_id,
         u.is_system,
         u.is_active,
         u.created_at,
         department.name AS department_name,
         parent_department.name AS department_parent_name
       FROM users u
       LEFT JOIN departments department ON u.department_id = department.id
       LEFT JOIN departments parent_department ON department.parent_id = parent_department.id
       WHERE u.id = ?`,
      [userId]
    );
    const [updatedWithRoles] = await attachUserRoles(db, [updatedUser]);

    return c.json({
      success: true,
      data: updatedWithRoles,
      message:
        updateFields.length > 0 || changesAccess
          ? '用户信息更新成功'
          : '没有内容需要更新'
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
      'SELECT id, username, created_by, is_system FROM users WHERE id = ?',
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

    const targetRoleCodes = await getUserRoleCodes(db, userId);
    if (
      targetRoleCodes.includes(ROLE_CODES.super) &&
      (await countOtherActiveSuperAdmins(db, userId)) < 1
    ) {
      return c.json({ error: '系统必须至少保留一个总管理员' }, 400);
    }

    // 原子删除：断开子用户归属、清角色绑定、吊销刷新会话、删用户本体
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE users SET created_by = NULL WHERE created_by = ?').bind(userId),
      c.env.DB.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(userId),
      c.env.DB.prepare('DELETE FROM refresh_sessions WHERE user_id = ?').bind(userId),
      c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId)
    ]);

    return c.json({
      success: true,
      message: '用户删除成功'
    });
  } catch (error) {
    logger.error('Delete user error', error);
    return c.json({ error: '删除用户失败' }, 500);
  }
});

export default users;
