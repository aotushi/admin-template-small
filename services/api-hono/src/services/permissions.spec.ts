import { PERMISSION_CODES } from '@admin-backend-3/admin-api-contract/permissions';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import {
  assignUserRoles,
  buildUsersScopeCondition,
  countOtherActiveSuperAdmins,
  requirePermission,
  resolveActiveRoles,
  resolveUserAccess,
  type UserAccess
} from './permissions';

interface AccessRow {
  code: null | string;
  data_scope: null | string;
  department_id: null | number;
  role_code?: null | string;
}

function createDatabase(rows: AccessRow[], onQuery?: () => void) {
  return {
    prepare() {
      return {
        bind() {
          return {
            async all() {
              onQuery?.();
              return { results: rows, success: true };
            }
          };
        }
      };
    }
  } as unknown as D1Database;
}

describe('resolveUserAccess', () => {
  it('合并多角色：权限码去重、角色码收集、数据范围取最强', async () => {
    const db = createDatabase([
      { code: 'system:user:view', data_scope: 'self', department_id: 3, role_code: 'admin' },
      { code: 'system:user:view', data_scope: 'all', department_id: 3, role_code: 'super' },
      { code: 'system:user:create', data_scope: 'all', department_id: 3, role_code: 'super' }
    ]);

    const access = await resolveUserAccess(db, 1);

    expect(access.permissionCodes).toEqual(
      new Set(['system:user:view', 'system:user:create'])
    );
    expect(access.roleCodes).toEqual(new Set(['admin', 'super']));
    expect(access.dataScope).toBe('all');
    expect(access.departmentId).toBe(3);
  });

  it('无角色用户兜底为空权限集 + self 范围', async () => {
    const db = createDatabase([
      { code: null, data_scope: null, department_id: null, role_code: null }
    ]);

    const access = await resolveUserAccess(db, 1);

    expect(access.permissionCodes.size).toBe(0);
    expect(access.roleCodes.size).toBe(0);
    expect(access.dataScope).toBe('self');
    expect(access.departmentId).toBeNull();
  });
});

describe('requirePermission', () => {
  function createApp(rows: AccessRow[], onQuery?: () => void) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 1, role_codes: ['admin'], username: 'tester' } as never);
      await next();
    });
    app.get(
      '/',
      requirePermission(PERMISSION_CODES.systemUserCreate),
      requirePermission(PERMISSION_CODES.systemUserCreate),
      c => c.json({ success: true })
    );

    return app.request('http://localhost/', {}, {
      DB: createDatabase(rows, onQuery)
    });
  }

  it('拥有权限码时放行，且同一请求内只查一次库', async () => {
    let queryCount = 0;
    const response = await createApp(
      [{ code: 'system:user:create', data_scope: 'self', department_id: null }],
      () => {
        queryCount += 1;
      }
    );

    expect(response.status).toBe(200);
    expect(queryCount).toBe(1);
  });

  it('缺少权限码时返回 403 forbidden', async () => {
    const response = await createApp([
      { code: 'system:user:view', data_scope: 'all', department_id: null }
    ]);

    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('FORBIDDEN');
  });

  it('传数组时任一权限码命中即放行', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 1, role_codes: ['admin'], username: 'tester' } as never);
      await next();
    });
    app.get(
      '/',
      requirePermission([
        PERMISSION_CODES.systemDeptView,
        PERMISSION_CODES.systemUserView
      ]),
      c => c.json({ success: true })
    );

    const response = await app.request('http://localhost/', {}, {
      DB: createDatabase([
        { code: 'system:user:view', data_scope: 'self', department_id: null }
      ])
    });

    expect(response.status).toBe(200);
  });
});

describe('resolveActiveRoles', () => {
  function createRolesDatabase(rows: Array<{ code: string; id: number }>) {
    const queries: Array<{ params: any[]; query: string }> = [];
    const db = {
      async all(query: string, params: any[] = []) {
        queries.push({ params, query });
        return rows;
      }
    };
    return { db, queries };
  }

  it('全部命中启用角色时返回 id + code 列表（自动去重）', async () => {
    const { db, queries } = createRolesDatabase([
      { code: 'admin', id: 2 },
      { code: 'user', id: 3 }
    ]);

    const roles = await resolveActiveRoles(db, ['admin', 'user', 'admin']);

    expect(roles).toEqual([
      { code: 'admin', id: 2 },
      { code: 'user', id: 3 }
    ]);
    expect(queries[0].params).toEqual(['admin', 'user']);
    expect(queries[0].query).toContain('status = 1');
  });

  it('空数组或含空白角色码时返回 null', async () => {
    const { db } = createRolesDatabase([]);

    expect(await resolveActiveRoles(db, [])).toBeNull();
    expect(await resolveActiveRoles(db, ['admin', '  '])).toBeNull();
  });

  it('任一角色码不存在或已停用时返回 null', async () => {
    const { db } = createRolesDatabase([{ code: 'admin', id: 2 }]);

    expect(await resolveActiveRoles(db, ['admin', 'ghost'])).toBeNull();
  });
});

describe('assignUserRoles', () => {
  it('单个 batch 内先清空旧绑定，再逐个插入新绑定', async () => {
    const statements: Array<{ params: any[]; query: string }> = [];
    let batchCount = 0;
    const d1 = {
      prepare(query: string) {
        return {
          bind(...params: any[]) {
            return { params, query };
          }
        };
      },
      async batch(items: Array<{ params: any[]; query: string }>) {
        batchCount += 1;
        statements.push(...items);
        return [];
      }
    } as unknown as D1Database;

    await assignUserRoles(d1, 42, [2, 3]);

    expect(batchCount).toBe(1);
    expect(statements).toHaveLength(3);
    expect(statements[0].query).toBe('DELETE FROM user_roles WHERE user_id = ?');
    expect(statements[0].params).toEqual([42]);
    expect(statements[1].query).toContain('INSERT INTO user_roles');
    expect(statements[1].params).toEqual([42, 2]);
    expect(statements[2].params).toEqual([42, 3]);
  });
});

describe('countOtherActiveSuperAdmins', () => {
  it('排除目标用户并只统计启用账号的 super 绑定', async () => {
    const queries: Array<{ params: any[]; query: string }> = [];
    const db = {
      async get(query: string, params: any[] = []) {
        queries.push({ params, query });
        return { count: 2 };
      }
    };

    const count = await countOtherActiveSuperAdmins(db, 42);

    expect(count).toBe(2);
    expect(queries[0].params).toEqual([42]);
    expect(queries[0].query).toContain("r.code = 'super'");
    expect(queries[0].query).toContain('u.is_active = 1');
    expect(queries[0].query).toContain('u.id != ?');
  });

  it('查询无结果时兜底为 0', async () => {
    const db = {
      async get() {
        return undefined;
      }
    };

    expect(await countOtherActiveSuperAdmins(db, 1)).toBe(0);
  });
});

describe('buildUsersScopeCondition', () => {
  const baseAccess = (overrides: Partial<UserAccess>): UserAccess => ({
    dataScope: 'self',
    departmentId: null,
    permissionCodes: new Set(),
    roleCodes: new Set(),
    ...overrides
  });

  it('all 范围不限制', () => {
    const scope = buildUsersScopeCondition(baseAccess({ dataScope: 'all' }), 1);
    expect(scope.condition).toBe('');
    expect(scope.params).toEqual([]);
  });

  it('self 范围限制为自己创建的行', () => {
    const scope = buildUsersScopeCondition(baseAccess({ dataScope: 'self' }), 7);
    expect(scope.condition).toBe('u.created_by = ?');
    expect(scope.params).toEqual([7]);
  });

  it('dept 范围用递归 CTE 覆盖部门子树', () => {
    const scope = buildUsersScopeCondition(
      baseAccess({ dataScope: 'dept', departmentId: 5 }),
      1
    );
    expect(scope.condition).toContain('WITH RECURSIVE dept_tree');
    expect(scope.params).toEqual([5]);
  });

  it('dept 范围但用户无部门时降级为 self', () => {
    const scope = buildUsersScopeCondition(
      baseAccess({ dataScope: 'dept', departmentId: null }),
      9
    );
    expect(scope.condition).toBe('u.created_by = ?');
    expect(scope.params).toEqual([9]);
  });
});
