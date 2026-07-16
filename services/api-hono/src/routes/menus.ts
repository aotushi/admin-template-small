import { Hono } from 'hono';
import {
  PERMISSION_CODES,
  isMenuType
} from '@admin-backend-3/admin-api-contract/permissions';
import type { Env } from '../index';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../services/permissions';
import { DatabaseWrapper } from '../models/database';
import { logger } from '../utils/logger';

interface MenuNode {
  auth_code: null | string;
  children: MenuNode[];
  component: null | string;
  id: number;
  path: null | string;
  pid: null | number;
  sort: number;
  status: number;
  title: string;
  type: string;
}

const menus = new Hono<{ Bindings: Env }>();

// 菜单树：菜单管理页与角色管理页（分配勾选树）共用，
// 因此对 menu:view / role:view 任一放行
menus.get(
  '/tree',
  authMiddleware,
  requirePermission([PERMISSION_CODES.systemMenuView, PERMISSION_CODES.systemRoleView]),
  async c => {
    try {
      const db = new DatabaseWrapper(c.env.DB);
      const rows = await db.all(`
        SELECT id, pid, type, title, auth_code, path, component, status, sort
        FROM menus
        ORDER BY sort ASC, id ASC
      `);

      return c.json({
        success: true,
        data: buildMenuTree(rows as Omit<MenuNode, 'children'>[])
      });
    } catch (error) {
      logger.error('Menus tree error', error);
      return c.json({ error: '获取菜单列表失败' }, 500);
    }
  }
);

// 新增菜单节点
menus.post('/', authMiddleware, requirePermission(PERMISSION_CODES.systemMenuCreate), async c => {
  try {
    const body = await c.req.json();
    const db = new DatabaseWrapper(c.env.DB);

    const invalid = await validateMenuPayload(db, body, null);
    if (invalid) {
      return c.json({ error: invalid }, 400);
    }

    const result = await db.run(
      `INSERT INTO menus (pid, type, title, auth_code, path, component, status, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.pid ?? null,
        body.type,
        String(body.title).trim(),
        body.auth_code || null,
        body.path || null,
        body.component || null,
        body.status ?? 1,
        body.sort ?? 0
      ]
    );

    return c.json({
      success: true,
      message: '菜单创建成功',
      data: { id: Number((result as any).meta?.last_row_id) }
    });
  } catch (error) {
    if (isUniqueAuthCodeError(error)) {
      return c.json({ error: '权限标识已被其他菜单占用' }, 400);
    }
    logger.error('Menu create error', error);
    return c.json({ error: '创建菜单失败' }, 500);
  }
});

// 更新菜单节点
menus.put('/:menuId', authMiddleware, requirePermission(PERMISSION_CODES.systemMenuUpdate), async c => {
  try {
    const menuId = parseInt(c.req.param('menuId'));
    if (isNaN(menuId)) {
      return c.json({ error: '无效的菜单ID' }, 400);
    }

    const body = await c.req.json();
    const db = new DatabaseWrapper(c.env.DB);

    const existing = await db.get('SELECT id FROM menus WHERE id = ?', [menuId]);
    if (!existing) {
      return c.json({ error: '菜单不存在' }, 404);
    }

    const invalid = await validateMenuPayload(db, body, menuId);
    if (invalid) {
      return c.json({ error: invalid }, 400);
    }

    await db.run(
      `UPDATE menus
       SET pid = ?, type = ?, title = ?, auth_code = ?, path = ?, component = ?, status = ?, sort = ?
       WHERE id = ?`,
      [
        body.pid ?? null,
        body.type,
        String(body.title).trim(),
        body.auth_code || null,
        body.path || null,
        body.component || null,
        body.status ?? 1,
        body.sort ?? 0,
        menuId
      ]
    );

    return c.json({ success: true, message: '菜单更新成功' });
  } catch (error) {
    if (isUniqueAuthCodeError(error)) {
      return c.json({ error: '权限标识已被其他菜单占用' }, 400);
    }
    logger.error('Menu update error', error);
    return c.json({ error: '更新菜单失败' }, 500);
  }
});

// 删除菜单节点（有子节点禁删；role_menus 绑定级联清理）
menus.delete('/:menuId', authMiddleware, requirePermission(PERMISSION_CODES.systemMenuDelete), async c => {
  try {
    const menuId = parseInt(c.req.param('menuId'));
    if (isNaN(menuId)) {
      return c.json({ error: '无效的菜单ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    const existing = await db.get('SELECT id FROM menus WHERE id = ?', [menuId]);
    if (!existing) {
      return c.json({ error: '菜单不存在' }, 404);
    }

    const child = await db.get('SELECT id FROM menus WHERE pid = ? LIMIT 1', [menuId]);
    if (child) {
      return c.json({ error: '存在子节点，不可删除' }, 400);
    }

    await db.run('DELETE FROM role_menus WHERE menu_id = ?', [menuId]);
    await db.run('DELETE FROM menus WHERE id = ?', [menuId]);

    return c.json({ success: true, message: '菜单删除成功' });
  } catch (error) {
    logger.error('Menu delete error', error);
    return c.json({ error: '删除菜单失败' }, 500);
  }
});

// 通用入参校验；menuId 非空时校验"新父节点不能是自己或自己的后代"（防环）
async function validateMenuPayload(
  db: DatabaseWrapper,
  body: any,
  menuId: null | number
): Promise<null | string> {
  if (!isMenuType(body.type)) {
    return '菜单类型无效';
  }
  if (typeof body.title !== 'string' || body.title.trim() === '') {
    return '菜单名称必填';
  }
  if (body.status !== undefined && body.status !== 0 && body.status !== 1) {
    return '状态无效';
  }
  if (body.sort !== undefined && !Number.isInteger(body.sort)) {
    return '排序值无效';
  }
  if (body.type === 'button' && !body.auth_code) {
    return '按钮节点必须填写权限标识';
  }

  const pid = body.pid ?? null;
  if (pid !== null) {
    if (!Number.isInteger(pid)) {
      return '父级菜单无效';
    }
    if (menuId !== null && pid === menuId) {
      return '父级菜单不能是自己';
    }

    const parent = await db.get('SELECT id, type FROM menus WHERE id = ?', [pid]);
    if (!parent) {
      return '父级菜单不存在';
    }
    if (parent.type === 'button') {
      return '按钮节点下不可再挂子节点';
    }

    if (menuId !== null) {
      // 新父节点落在自己的子树内会形成环
      const cycle = await db.get(
        `WITH RECURSIVE subtree(id) AS (
           SELECT id FROM menus WHERE pid = ?
           UNION ALL
           SELECT m.id FROM menus m JOIN subtree s ON m.pid = s.id
         )
         SELECT id FROM subtree WHERE id = ?`,
        [menuId, pid]
      );
      if (cycle) {
        return '父级菜单不能是自己的子节点';
      }
    }
  }

  return null;
}

function isUniqueAuthCodeError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE') && error.message.includes('auth_code');
}

function buildMenuTree(rows: Omit<MenuNode, 'children'>[]): MenuNode[] {
  const nodes = new Map<number, MenuNode>();
  const roots: MenuNode[] = [];

  for (const row of rows) {
    nodes.set(row.id, { ...row, children: [], status: Number(row.status), sort: Number(row.sort) });
  }

  for (const node of nodes.values()) {
    if (node.pid === null) {
      roots.push(node);
      continue;
    }
    const parent = nodes.get(node.pid);
    if (parent) {
      parent.children.push(node);
    }
  }

  return roots;
}

export default menus;
