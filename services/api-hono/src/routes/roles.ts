import { Hono } from 'hono';
import {
  PERMISSION_CODES,
  isDataScope
} from '@admin-backend-3/admin-api-contract/permissions';
import type { Env } from '../index';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../services/permissions';
import { DatabaseWrapper } from '../models/database';
import { logger } from '../utils/logger';

const roles = new Hono<{ Bindings: Env }>();

// 校验 menu_ids 入参并过滤出真实存在的菜单 id；返回 null 表示入参非法
async function normalizeMenuIds(
  db: DatabaseWrapper,
  menuIds: unknown
): Promise<null | number[]> {
  if (!Array.isArray(menuIds) || menuIds.some(id => !Number.isInteger(id))) {
    return null;
  }

  if (menuIds.length === 0) {
    return [];
  }

  const placeholders = menuIds.map(() => '?').join(', ');
  const rows = await db.all(
    `SELECT id FROM menus WHERE id IN (${placeholders})`,
    menuIds
  );
  const known = new Set((rows as any[]).map(row => row.id));
  const unknown = menuIds.filter(id => !known.has(id));
  return unknown.length > 0 ? null : menuIds;
}

// 重建角色-菜单绑定
async function replaceRoleMenus(
  db: DatabaseWrapper,
  roleId: number,
  menuIds: number[]
): Promise<void> {
  await db.run('DELETE FROM role_menus WHERE role_id = ?', [roleId]);
  for (const menuId of menuIds) {
    await db.run('INSERT INTO role_menus (role_id, menu_id) VALUES (?, ?)', [
      roleId,
      menuId
    ]);
  }
}

// 角色列表（含菜单绑定与用户数；菜单树由 /api/menus/tree 提供）
roles.get('/', authMiddleware, requirePermission(PERMISSION_CODES.systemRoleView), async c => {
  try {
    const db = new DatabaseWrapper(c.env.DB);

    const roleRows = await db.all(`
      SELECT
        r.id,
        r.code,
        r.name,
        r.status,
        r.remark,
        r.data_scope,
        r.created_at,
        GROUP_CONCAT(rm.menu_id) AS menu_ids,
        (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
      FROM roles r
      LEFT JOIN role_menus rm ON rm.role_id = r.id
      GROUP BY r.id
      ORDER BY r.id ASC
    `);

    return c.json({
      success: true,
      data: {
        roles: (roleRows as any[]).map(row => ({
          id: row.id,
          code: row.code,
          name: row.name,
          status: Number(row.status),
          remark: row.remark ?? '',
          data_scope: row.data_scope,
          created_at: row.created_at,
          menu_ids: row.menu_ids
            ? String(row.menu_ids)
                .split(',')
                .map(Number)
                .sort((a, b) => a - b)
            : [],
          user_count: Number(row.user_count)
        }))
      }
    });
  } catch (error) {
    logger.error('Roles list error', error);
    return c.json({ error: '获取角色列表失败' }, 500);
  }
});

// 新增角色（code 自动生成 role_<id>，避免和内置角色码冲突）
roles.post('/', authMiddleware, requirePermission(PERMISSION_CODES.systemRoleCreate), async c => {
  try {
    const { name, status, remark, data_scope, menu_ids } = await c.req.json();

    if (typeof name !== 'string' || name.trim() === '' || name.trim().length > 20) {
      return c.json({ error: '角色名称必填且不超过 20 字' }, 400);
    }
    if (status !== undefined && status !== 0 && status !== 1) {
      return c.json({ error: '状态无效' }, 400);
    }
    if (data_scope !== undefined && !isDataScope(data_scope)) {
      return c.json({ error: '数据范围无效' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    let menuIds: null | number[] = [];
    if (menu_ids !== undefined) {
      menuIds = await normalizeMenuIds(db, menu_ids);
      if (menuIds === null) {
        return c.json({ error: '菜单绑定列表无效' }, 400);
      }
    }

    const result = await db.run(
      `INSERT INTO roles (code, name, status, remark, data_scope)
       VALUES ('pending', ?, ?, ?, ?)`,
      [name.trim(), status ?? 1, remark ?? null, data_scope ?? 'self']
    );
    const roleId = Number((result as any).meta?.last_row_id);
    await db.run("UPDATE roles SET code = 'role_' || id WHERE id = ?", [roleId]);

    if (menuIds.length > 0) {
      await replaceRoleMenus(db, roleId, menuIds);
    }

    return c.json({ success: true, message: '角色创建成功', data: { id: roleId } });
  } catch (error) {
    logger.error('Role create error', error);
    return c.json({ error: '创建角色失败' }, 500);
  }
});

// 更新角色（名称/状态/备注/数据范围/菜单绑定）
roles.put('/:roleId', authMiddleware, requirePermission(PERMISSION_CODES.systemRoleUpdate), async c => {
  try {
    const roleId = parseInt(c.req.param('roleId'));
    if (isNaN(roleId)) {
      return c.json({ error: '无效的角色ID' }, 400);
    }

    const { name, status, remark, data_scope, menu_ids } = await c.req.json();

    if (
      name !== undefined &&
      (typeof name !== 'string' || name.trim() === '' || name.trim().length > 20)
    ) {
      return c.json({ error: '角色名称必填且不超过 20 字' }, 400);
    }
    if (status !== undefined && status !== 0 && status !== 1) {
      return c.json({ error: '状态无效' }, 400);
    }
    if (data_scope !== undefined && !isDataScope(data_scope)) {
      return c.json({ error: '数据范围无效' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    const role = await db.get('SELECT id, code FROM roles WHERE id = ?', [roleId]);
    if (!role) {
      return c.json({ error: '角色不存在' }, 404);
    }

    // super 角色保持全量权限，禁止编辑/停用（防止把自己锁在角色管理外）
    if (role.code === 'super') {
      return c.json({ error: '总管理员角色不可编辑' }, 403);
    }

    if (menu_ids !== undefined) {
      const menuIds = await normalizeMenuIds(db, menu_ids);
      if (menuIds === null) {
        return c.json({ error: '菜单绑定列表无效' }, 400);
      }
      await replaceRoleMenus(db, roleId, menuIds);
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    if (name !== undefined) {
      sets.push('name = ?');
      params.push(name.trim());
    }
    if (status !== undefined) {
      sets.push('status = ?');
      params.push(status);
    }
    if (remark !== undefined) {
      sets.push('remark = ?');
      params.push(remark ?? null);
    }
    if (data_scope !== undefined) {
      sets.push('data_scope = ?');
      params.push(data_scope);
    }
    if (sets.length > 0) {
      await db.run(`UPDATE roles SET ${sets.join(', ')} WHERE id = ?`, [
        ...params,
        roleId
      ]);
    }

    return c.json({ success: true, message: '角色更新成功' });
  } catch (error) {
    logger.error('Role update error', error);
    return c.json({ error: '更新角色失败' }, 500);
  }
});

// 删除角色（super 禁删；仍有用户绑定时禁删）
roles.delete('/:roleId', authMiddleware, requirePermission(PERMISSION_CODES.systemRoleDelete), async c => {
  try {
    const roleId = parseInt(c.req.param('roleId'));
    if (isNaN(roleId)) {
      return c.json({ error: '无效的角色ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    const role = await db.get(
      `SELECT r.id, r.code,
              (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
       FROM roles r WHERE r.id = ?`,
      [roleId]
    );
    if (!role) {
      return c.json({ error: '角色不存在' }, 404);
    }
    if (role.code === 'super') {
      return c.json({ error: '总管理员角色不可删除' }, 403);
    }
    if (Number(role.user_count) > 0) {
      return c.json({ error: `该角色仍绑定 ${role.user_count} 个用户，不可删除` }, 400);
    }

    await db.run('DELETE FROM role_menus WHERE role_id = ?', [roleId]);
    await db.run('DELETE FROM roles WHERE id = ?', [roleId]);

    return c.json({ success: true, message: '角色删除成功' });
  } catch (error) {
    logger.error('Role delete error', error);
    return c.json({ error: '删除角色失败' }, 500);
  }
});

export default roles;
