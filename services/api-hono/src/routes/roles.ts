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

// 角色列表 + 全量权限点目录（角色管理页一次取齐）
roles.get('/', authMiddleware, requirePermission(PERMISSION_CODES.systemRoleView), async c => {
  try {
    const db = new DatabaseWrapper(c.env.DB);

    const permissionRows = await db.all(
      'SELECT id, code, name, type FROM permissions ORDER BY id ASC'
    );

    const roleRows = await db.all(`
      SELECT
        r.id,
        r.code,
        r.name,
        r.data_scope,
        GROUP_CONCAT(p.code) AS permission_codes,
        (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      GROUP BY r.id, r.code, r.name, r.data_scope
      ORDER BY r.id ASC
    `);

    return c.json({
      success: true,
      data: {
        permissions: permissionRows,
        roles: (roleRows as any[]).map(row => ({
          id: row.id,
          code: row.code,
          name: row.name,
          data_scope: row.data_scope,
          permission_codes: row.permission_codes
            ? String(row.permission_codes).split(',').sort()
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

// 更新角色的权限绑定与数据范围
roles.put('/:roleId', authMiddleware, requirePermission(PERMISSION_CODES.systemRoleUpdate), async c => {
  try {
    const roleId = parseInt(c.req.param('roleId'));
    if (isNaN(roleId)) {
      return c.json({ error: '无效的角色ID' }, 400);
    }

    const { data_scope, permission_codes } = await c.req.json();

    if (data_scope !== undefined && !isDataScope(data_scope)) {
      return c.json({ error: '数据范围无效' }, 400);
    }

    if (
      permission_codes !== undefined &&
      (!Array.isArray(permission_codes) ||
        permission_codes.some(code => typeof code !== 'string'))
    ) {
      return c.json({ error: '权限码列表无效' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    const role = await db.get('SELECT id, code FROM roles WHERE id = ?', [roleId]);
    if (!role) {
      return c.json({ error: '角色不存在' }, 404);
    }

    // super 角色保持全量权限，禁止编辑（防止把自己锁在角色管理外）
    if (role.code === 'super') {
      return c.json({ error: '总管理员角色不可编辑' }, 403);
    }

    if (permission_codes !== undefined) {
      // 权限码必须都在权限点目录中
      const catalog = await db.all('SELECT code FROM permissions');
      const known = new Set((catalog as any[]).map(row => row.code));
      const unknown = permission_codes.filter((code: string) => !known.has(code));
      if (unknown.length > 0) {
        return c.json({ error: `未知权限码：${unknown.join(', ')}` }, 400);
      }

      await db.run('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
      for (const code of permission_codes) {
        await db.run(
          'INSERT INTO role_permissions (role_id, permission_id) SELECT ?, id FROM permissions WHERE code = ?',
          [roleId, code]
        );
      }
    }

    if (data_scope !== undefined) {
      await db.run('UPDATE roles SET data_scope = ? WHERE id = ?', [data_scope, roleId]);
    }

    return c.json({ success: true, message: '角色更新成功' });
  } catch (error) {
    logger.error('Role update error', error);
    return c.json({ error: '更新角色失败' }, 500);
  }
});

export default roles;
