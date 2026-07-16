import { PERMISSION_CODES } from '@admin-backend-3/admin-api-contract/permissions';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import {
  buildUsersScopeCondition,
  requirePermission,
  resolveUserAccess,
  syncUserRoleBinding,
  toRoleCode,
  type UserAccess
} from './permissions';

interface AccessRow {
  code: null | string;
  data_scope: null | string;
  department_id: null | number;
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
  it('合并多角色：权限码去重、数据范围取最强', async () => {
    const db = createDatabase([
      { code: 'system:user:view', data_scope: 'self', department_id: 3 },
      { code: 'system:user:view', data_scope: 'all', department_id: 3 },
      { code: 'system:user:create', data_scope: 'all', department_id: 3 }
    ]);

    const access = await resolveUserAccess(db, 1);

    expect(access.permissionCodes).toEqual(
      new Set(['system:user:view', 'system:user:create'])
    );
    expect(access.dataScope).toBe('all');
    expect(access.departmentId).toBe(3);
  });

  it('无角色用户兜底为空权限集 + self 范围', async () => {
    const db = createDatabase([
      { code: null, data_scope: null, department_id: null }
    ]);

    const access = await resolveUserAccess(db, 1);

    expect(access.permissionCodes.size).toBe(0);
    expect(access.dataScope).toBe('self');
    expect(access.departmentId).toBeNull();
  });
});

describe('requirePermission', () => {
  function createApp(rows: AccessRow[], onQuery?: () => void) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 1, role: 'admin', username: 'tester' } as never);
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
      c.set('user' as never, { id: 1, role: 'admin', username: 'tester' } as never);
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

describe('toRoleCode', () => {
  it('与迁移 019 回填规则一致', () => {
    expect(toRoleCode('admin', 'super')).toBe('super');
    expect(toRoleCode('admin', 'sub')).toBe('admin');
    expect(toRoleCode('admin', null)).toBe('admin');
    expect(toRoleCode('user', null)).toBe('user');
    expect(toRoleCode(null, null)).toBe('user');
  });
});

describe('syncUserRoleBinding', () => {
  it('先清空旧绑定，再按角色码插入新绑定', async () => {
    const calls: Array<{ params: any[]; query: string }> = [];
    const db = {
      async run(query: string, params: any[] = []) {
        calls.push({ params, query });
      }
    };

    await syncUserRoleBinding(db, 42, 'admin', 'super');

    expect(calls).toHaveLength(2);
    expect(calls[0].query).toBe('DELETE FROM user_roles WHERE user_id = ?');
    expect(calls[0].params).toEqual([42]);
    expect(calls[1].query).toContain('INSERT INTO user_roles');
    expect(calls[1].params).toEqual([42, 'super']);
  });
});

describe('buildUsersScopeCondition', () => {
  const baseAccess = (overrides: Partial<UserAccess>): UserAccess => ({
    dataScope: 'self',
    departmentId: null,
    permissionCodes: new Set(),
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
