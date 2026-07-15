import {
  DATA_SCOPE_RANK,
  DATA_SCOPES,
  ROLE_CODES,
  isDataScope,
  type DataScope,
  type PermissionCode,
  type RoleCode
} from '@admin-backend-3/admin-api-contract/permissions';
import { AUTH_ERROR_CODES } from '@admin-backend-3/admin-api-contract/auth';
import { authError } from './auth-responses';

/**
 * RBAC 权限解析服务
 * 每次请求从 D1 实时解析用户的权限码与数据范围（不进 JWT，改权限即时生效），
 * 结果缓存在 Hono context 上，同一请求内多次消费只查一次库。
 */

export interface UserAccess {
  /** 用户所属部门（dept 数据范围的锚点；无部门时 dept 降级为 self） */
  departmentId: null | number;
  /** 多角色合并后的最强数据范围 */
  dataScope: DataScope;
  /** 去重后的权限码集合 */
  permissionCodes: Set<string>;
}

interface AccessRow {
  code: null | string;
  data_scope: null | string;
  department_id: null | number;
}

const ACCESS_CONTEXT_KEY = 'userAccess';

/**
 * 一次查询取回：用户部门 + 所有角色的数据范围 + 所有角色的权限码。
 * 无任何角色的用户得到空权限集 + self 范围（最小权限兜底）。
 */
export async function resolveUserAccess(
  db: D1Database,
  userId: number
): Promise<UserAccess> {
  const { results } = await db
    .prepare(
      `SELECT u.department_id, r.data_scope, p.code
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
       WHERE u.id = ?`
    )
    .bind(userId)
    .all<AccessRow>();

  const permissionCodes = new Set<string>();
  let dataScope: DataScope = DATA_SCOPES.self;
  let departmentId: null | number = null;

  for (const row of results ?? []) {
    departmentId = row.department_id ?? departmentId;
    if (row.code) {
      permissionCodes.add(row.code);
    }
    if (
      isDataScope(row.data_scope) &&
      DATA_SCOPE_RANK[row.data_scope] > DATA_SCOPE_RANK[dataScope]
    ) {
      dataScope = row.data_scope;
    }
  }

  return { dataScope, departmentId, permissionCodes };
}

/**
 * 带 context 缓存的解析入口：同一请求内重复调用不再查库。
 * 必须在 authMiddleware 之后使用（依赖 c.get('user')）。
 */
export async function getUserAccess(c: any): Promise<UserAccess> {
  const cached = c.get(ACCESS_CONTEXT_KEY);
  if (cached) {
    return cached;
  }

  const user = c.get('user');
  const access = await resolveUserAccess(c.env.DB, user.id);
  c.set(ACCESS_CONTEXT_KEY, access);
  return access;
}

/**
 * 权限码中间件工厂：缺少指定权限码时返回 403。
 * 用法：users.post('/create', authMiddleware, requirePermission(PERMISSION_CODES.systemUserCreate), ...)
 */
export function requirePermission(code: PermissionCode) {
  return async (c: any, next: any) => {
    const access = await getUserAccess(c);
    if (!access.permissionCodes.has(code)) {
      return authError(c, 403, AUTH_ERROR_CODES.forbidden, `权限不足（${code}）`);
    }
    await next();
  };
}

/** 把 users.role/admin_level 归一为角色码（与迁移 019 回填规则一致） */
export function toRoleCode(role: null | string, adminLevel: null | string): RoleCode {
  if (role === 'admin' && adminLevel === 'super') {
    return ROLE_CODES.super;
  }
  if (role === 'admin') {
    return ROLE_CODES.admin;
  }
  return ROLE_CODES.user;
}

/**
 * 运行时同步 user_roles：用户创建或 role/admin_level 变更后必须调用，
 * 否则该用户在 RBAC 下解析不到任何权限码。
 * 角色归属当前仍以 users.role/admin_level 为单一来源，user_roles 是其派生绑定。
 */
export async function syncUserRoleBinding(
  db: { run(query: string, params?: any[]): Promise<any> },
  userId: number,
  role: null | string,
  adminLevel: null | string
): Promise<void> {
  const roleCode = toRoleCode(role, adminLevel);
  await db.run('DELETE FROM user_roles WHERE user_id = ?', [userId]);
  await db.run(
    'INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = ?',
    [userId, roleCode]
  );
}

export interface ScopeCondition {
  /** WHERE 片段（不含 WHERE 关键字）；空串表示不限制 */
  condition: string;
  params: unknown[];
}

/**
 * 把数据范围翻译成 users 表查询的 WHERE 片段。
 * - all：不限制
 * - dept：本部门及所有子部门（递归 CTE）；用户无部门时降级为 self
 * - self：仅自己创建的行
 * @param alias users 表在调用方 SQL 中的别名
 */
export function buildUsersScopeCondition(
  access: UserAccess,
  currentUserId: number,
  alias = 'u'
): ScopeCondition {
  if (access.dataScope === DATA_SCOPES.all) {
    return { condition: '', params: [] };
  }

  if (access.dataScope === DATA_SCOPES.dept && access.departmentId !== null) {
    return {
      condition: `${alias}.department_id IN (
        WITH RECURSIVE dept_tree(id) AS (
          SELECT id FROM departments WHERE id = ?
          UNION ALL
          SELECT d.id FROM departments d JOIN dept_tree t ON d.parent_id = t.id
        )
        SELECT id FROM dept_tree
      )`,
      params: [access.departmentId]
    };
  }

  return { condition: `${alias}.created_by = ?`, params: [currentUserId] };
}
