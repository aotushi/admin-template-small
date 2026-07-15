import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import rolesRoutes from './roles';
import { createAccessToken } from '../services/tokens';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

const ACTIVE_USER = {
  admin_level: 'super',
  created_by: null,
  id: 1,
  is_active: 1,
  role: 'admin',
  username: 'vben'
};

const PERMISSION_CATALOG = [
  { code: 'system:user:view', id: 1, name: '用户管理-查看', type: 'menu' },
  { code: 'system:role:view', id: 6, name: '角色管理-查看', type: 'menu' },
  { code: 'system:role:update', id: 7, name: '角色管理-编辑', type: 'button' }
];

interface FakeDbOptions {
  accessCodes: string[];
  onRun?: (statement: string, params: unknown[]) => void;
  role?: null | { code: string; id: number };
}

// 按 SQL 语句分发的假 D1：覆盖 authMiddleware、权限解析和 roles 路由的全部查询
function createDatabase(options: FakeDbOptions) {
  const { accessCodes, onRun, role } = options;

  return {
    prepare(statement: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first() {
              if (statement.includes('FROM roles WHERE id')) {
                return role ?? null;
              }
              return ACTIVE_USER;
            },
            async all() {
              if (statement.includes('LEFT JOIN user_roles')) {
                return {
                  results: accessCodes.map(code => ({
                    code,
                    data_scope: 'all',
                    department_id: null
                  })),
                  success: true
                };
              }
              if (statement.includes('SELECT code FROM permissions')) {
                return {
                  results: PERMISSION_CATALOG.map(({ code }) => ({ code })),
                  success: true
                };
              }
              if (statement.includes('FROM permissions ORDER BY')) {
                return { results: PERMISSION_CATALOG, success: true };
              }
              // 角色列表聚合查询
              return {
                results: [
                  {
                    code: 'admin',
                    data_scope: 'self',
                    id: 2,
                    name: '子管理员',
                    permission_codes: 'system:user:view,system:role:view',
                    user_count: 6
                  }
                ],
                success: true
              };
            },
            async run() {
              onRun?.(statement, params);
              return { meta: {}, success: true };
            }
          };
        }
      };
    }
  } as unknown as D1Database;
}

async function request(
  options: FakeDbOptions,
  path: string,
  init: RequestInit = {}
) {
  const app = new Hono();
  app.route('/', rolesRoutes);

  const { accessToken } = await createAccessToken(
    { id: 1, role: 'admin', username: 'vben' },
    JWT_SECRET
  );

  return app.request(
    `http://localhost${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...init.headers
      }
    },
    { DB: createDatabase(options), JWT_SECRET }
  );
}

describe('GET /roles', () => {
  it('返回角色列表（权限码解析为数组）和权限点目录', async () => {
    const response = await request({ accessCodes: ['system:role:view'] }, '/');

    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.data.permissions).toHaveLength(3);
    expect(body.data.roles[0]).toMatchObject({
      code: 'admin',
      data_scope: 'self',
      permission_codes: ['system:role:view', 'system:user:view'],
      user_count: 6
    });
  });

  it('缺少 system:role:view 时 403', async () => {
    const response = await request({ accessCodes: ['system:user:view'] }, '/');
    expect(response.status).toBe(403);
  });
});

describe('PUT /roles/:roleId', () => {
  it('super 角色不可编辑', async () => {
    const response = await request(
      {
        accessCodes: ['system:role:update'],
        role: { code: 'super', id: 1 }
      },
      '/1',
      { body: JSON.stringify({ data_scope: 'self' }), method: 'PUT' }
    );

    expect(response.status).toBe(403);
  });

  it('拒绝未知权限码', async () => {
    const response = await request(
      {
        accessCodes: ['system:role:update'],
        role: { code: 'admin', id: 2 }
      },
      '/2',
      {
        body: JSON.stringify({ permission_codes: ['system:not:exists'] }),
        method: 'PUT'
      }
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('system:not:exists');
  });

  it('重建 role_permissions 并更新 data_scope', async () => {
    const runs: Array<{ params: unknown[]; statement: string }> = [];
    const response = await request(
      {
        accessCodes: ['system:role:update'],
        onRun: (statement, params) => runs.push({ params, statement }),
        role: { code: 'admin', id: 2 }
      },
      '/2',
      {
        body: JSON.stringify({
          data_scope: 'dept',
          permission_codes: ['system:user:view', 'system:role:view']
        }),
        method: 'PUT'
      }
    );

    expect(response.status).toBe(200);
    const writes = runs.filter(
      ({ statement }) =>
        statement.includes('role_permissions') || statement.includes('UPDATE roles')
    );
    expect(writes[0].statement).toContain('DELETE FROM role_permissions');
    expect(writes[0].params).toEqual([2]);
    expect(writes[1].params).toEqual([2, 'system:user:view']);
    expect(writes[2].params).toEqual([2, 'system:role:view']);
    expect(writes[3].statement).toContain('UPDATE roles SET data_scope');
    expect(writes[3].params).toEqual(['dept', 2]);
  });

  it('无效数据范围返回 400', async () => {
    const response = await request(
      {
        accessCodes: ['system:role:update'],
        role: { code: 'admin', id: 2 }
      },
      '/2',
      { body: JSON.stringify({ data_scope: 'world' }), method: 'PUT' }
    );

    expect(response.status).toBe(400);
  });
});
