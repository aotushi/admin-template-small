import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import rolesRoutes from './roles';
import { createAccessToken } from '../services/tokens';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

const ACTIVE_USER = {
  created_by: null,
  id: 1,
  is_active: 1,
  username: 'vben'
};

interface FakeDbOptions {
  accessCodes: string[];
  knownMenuIds?: number[];
  onRun?: (statement: string, params: unknown[]) => void;
  role?: null | { code: string; id: number; user_count?: number };
}

// 按 SQL 语句分发的假 D1：覆盖 authMiddleware、权限解析和 roles 路由的全部查询
function createDatabase(options: FakeDbOptions) {
  const { accessCodes, knownMenuIds = [1, 2, 3], onRun, role } = options;

  return {
    prepare(statement: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first() {
              if (statement.includes('FROM roles')) {
                if (!role) {
                  return null;
                }
                return { user_count: 0, ...role };
              }
              return ACTIVE_USER;
            },
            async all() {
              if (statement.includes('LEFT JOIN user_roles')) {
                return {
                  results: accessCodes.map(code => ({
                    code,
                    data_scope: 'all',
                    department_id: null,
                    role_code: 'super'
                  })),
                  success: true
                };
              }
              if (statement.includes('FROM menus WHERE id IN')) {
                return {
                  results: knownMenuIds
                    .filter(id => params.includes(id))
                    .map(id => ({ id })),
                  success: true
                };
              }
              // 角色列表聚合查询
              return {
                results: [
                  {
                    code: 'admin',
                    created_at: '2026-07-01 00:00:00',
                    data_scope: 'self',
                    id: 2,
                    menu_ids: '3,1,2',
                    name: '子管理员',
                    remark: null,
                    status: 1,
                    user_count: 6
                  }
                ],
                success: true
              };
            },
            async run() {
              onRun?.(statement, params);
              return { meta: { last_row_id: 9 }, success: true };
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
    { id: 1, role_codes: ['super'], username: 'vben' },
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
  it('返回角色列表（菜单绑定解析为升序 id 数组）', async () => {
    const response = await request({ accessCodes: ['system:role:view'] }, '/');

    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.data.roles[0]).toMatchObject({
      code: 'admin',
      data_scope: 'self',
      menu_ids: [1, 2, 3],
      remark: '',
      status: 1,
      user_count: 6
    });
  });

  it('缺少 system:role:view 时 403', async () => {
    const response = await request({ accessCodes: ['system:user:view'] }, '/');
    expect(response.status).toBe(403);
  });
});

describe('POST /roles', () => {
  it('创建角色：插入后把 code 重写为 role_<id> 并绑定菜单', async () => {
    const runs: Array<{ params: unknown[]; statement: string }> = [];
    const response = await request(
      {
        accessCodes: ['system:role:create'],
        onRun: (statement, params) => runs.push({ params, statement })
      },
      '/',
      {
        body: JSON.stringify({ menu_ids: [1, 2], name: '运营' }),
        method: 'POST'
      }
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.data.id).toBe(9);

    expect(runs[0].statement).toContain('INSERT INTO roles');
    expect(runs[0].params).toEqual(['运营', 1, null, 'self']);
    expect(runs[1].statement).toContain("code = 'role_' || id");
    expect(runs[2].statement).toContain('DELETE FROM role_menus');
    expect(runs[3].params).toEqual([9, 1]);
    expect(runs[4].params).toEqual([9, 2]);
  });

  it('名称为空返回 400', async () => {
    const response = await request(
      { accessCodes: ['system:role:create'] },
      '/',
      { body: JSON.stringify({ name: '  ' }), method: 'POST' }
    );
    expect(response.status).toBe(400);
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
      { body: JSON.stringify({ status: 0 }), method: 'PUT' }
    );

    expect(response.status).toBe(403);
  });

  it('拒绝不存在的菜单 id', async () => {
    const response = await request(
      {
        accessCodes: ['system:role:update'],
        knownMenuIds: [1, 2],
        role: { code: 'admin', id: 2 }
      },
      '/2',
      { body: JSON.stringify({ menu_ids: [1, 99] }), method: 'PUT' }
    );

    expect(response.status).toBe(400);
  });

  it('重建 role_menus 并更新基础字段', async () => {
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
          menu_ids: [1, 3],
          name: '子管理员',
          remark: '本部门数据',
          status: 1
        }),
        method: 'PUT'
      }
    );

    expect(response.status).toBe(200);
    expect(runs[0].statement).toContain('DELETE FROM role_menus');
    expect(runs[0].params).toEqual([2]);
    expect(runs[1].params).toEqual([2, 1]);
    expect(runs[2].params).toEqual([2, 3]);
    expect(runs[3].statement).toContain('UPDATE roles SET');
    expect(runs[3].params).toEqual(['子管理员', 1, '本部门数据', 'dept', 2]);
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

describe('DELETE /roles/:roleId', () => {
  it('super 角色不可删除', async () => {
    const response = await request(
      {
        accessCodes: ['system:role:delete'],
        role: { code: 'super', id: 1 }
      },
      '/1',
      { method: 'DELETE' }
    );

    expect(response.status).toBe(403);
  });

  it('仍有用户绑定时禁删', async () => {
    const response = await request(
      {
        accessCodes: ['system:role:delete'],
        role: { code: 'role_9', id: 9, user_count: 3 }
      },
      '/9',
      { method: 'DELETE' }
    );

    expect(response.status).toBe(400);
  });

  it('删除角色时清理菜单绑定', async () => {
    const runs: Array<{ params: unknown[]; statement: string }> = [];
    const response = await request(
      {
        accessCodes: ['system:role:delete'],
        onRun: (statement, params) => runs.push({ params, statement }),
        role: { code: 'role_9', id: 9, user_count: 0 }
      },
      '/9',
      { method: 'DELETE' }
    );

    expect(response.status).toBe(200);
    expect(runs[0].statement).toContain('DELETE FROM role_menus');
    expect(runs[1].statement).toContain('DELETE FROM roles');
    expect(runs[1].params).toEqual([9]);
  });
});
