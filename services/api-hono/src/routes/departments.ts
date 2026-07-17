import { Hono } from 'hono';
import { DATA_SCOPES, PERMISSION_CODES } from '@admin-backend-3/admin-api-contract/permissions';
import type { Env } from '../index';
import { authMiddleware } from '../middlewares/auth';
import { getUserAccess, requirePermission } from '../services/permissions';
import { DatabaseWrapper } from '../models/database';
import { logger } from '../utils/logger';

interface DepartmentNode {
  children: DepartmentNode[];
  code: string;
  id: number;
  name: string;
  parent_id: number | null;
  remark: null | string;
  sort_order: number;
  status: number;
  user_count: number;
}

const departments = new Hono<{ Bindings: Env }>();

// 部门树：部门管理页与用户管理页（部门筛选树）共用，
// 因此对 dept:view / user:view 任一放行。
// ?scope=data 时按当前用户数据范围过滤：dept 档只返回本部门及子部门
// （用户表单的部门选择器用它，保证 dept 档管理员创建的用户始终落在自己可见范围内）
departments.get(
  '/tree',
  authMiddleware,
  requirePermission([PERMISSION_CODES.systemDeptView, PERMISSION_CODES.systemUserView]),
  async c => {
    try {
      const db = new DatabaseWrapper(c.env.DB);
      let rows = (await db.all(`
        SELECT
          d.id,
          d.parent_id,
          d.code,
          d.name,
          d.sort_order,
          d.status,
          d.remark,
          COUNT(u.id) AS user_count
        FROM departments d
        LEFT JOIN users u ON u.department_id = d.id
        GROUP BY d.id, d.parent_id, d.code, d.name, d.sort_order, d.status, d.remark
        ORDER BY d.sort_order ASC, d.id ASC
      `)) as Omit<DepartmentNode, 'children'>[];

      if (c.req.query('scope') === 'data') {
        const access = await getUserAccess(c);
        if (access.dataScope === DATA_SCOPES.dept && access.departmentId !== null) {
          rows = filterSubtreeRows(rows, access.departmentId);
        }
      }

      return c.json({
        success: true,
        data: buildDepartmentTree(rows)
      });
    } catch (error) {
      logger.error('Departments tree error', error);
      return c.json({ error: '获取部门列表失败' }, 500);
    }
  }
);

// 新增部门（code 自动生成 dept_<id>）
departments.post('/', authMiddleware, requirePermission(PERMISSION_CODES.systemDeptCreate), async c => {
  try {
    const body = await c.req.json();
    const db = new DatabaseWrapper(c.env.DB);

    const invalid = await validateDepartmentPayload(db, body, null);
    if (invalid) {
      return c.json({ error: invalid }, 400);
    }

    const result = await db.run(
      `INSERT INTO departments (parent_id, code, name, sort_order, status, remark)
       VALUES (?, 'pending', ?, ?, ?, ?)`,
      [
        body.parent_id ?? null,
        String(body.name).trim(),
        body.sort_order ?? 0,
        body.status ?? 1,
        body.remark ?? null
      ]
    );
    const deptId = Number((result as any).meta?.last_row_id);
    await db.run("UPDATE departments SET code = 'dept_' || id WHERE id = ?", [deptId]);

    return c.json({ success: true, message: '部门创建成功', data: { id: deptId } });
  } catch (error) {
    logger.error('Department create error', error);
    return c.json({ error: '创建部门失败' }, 500);
  }
});

// 更新部门
departments.put('/:deptId', authMiddleware, requirePermission(PERMISSION_CODES.systemDeptUpdate), async c => {
  try {
    const deptId = parseInt(c.req.param('deptId'));
    if (isNaN(deptId)) {
      return c.json({ error: '无效的部门ID' }, 400);
    }

    const body = await c.req.json();
    const db = new DatabaseWrapper(c.env.DB);

    const existing = await db.get('SELECT id FROM departments WHERE id = ?', [deptId]);
    if (!existing) {
      return c.json({ error: '部门不存在' }, 404);
    }

    const invalid = await validateDepartmentPayload(db, body, deptId);
    if (invalid) {
      return c.json({ error: invalid }, 400);
    }

    await db.run(
      `UPDATE departments
       SET parent_id = ?, name = ?, sort_order = ?, status = ?, remark = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        body.parent_id ?? null,
        String(body.name).trim(),
        body.sort_order ?? 0,
        body.status ?? 1,
        body.remark ?? null,
        deptId
      ]
    );

    return c.json({ success: true, message: '部门更新成功' });
  } catch (error) {
    logger.error('Department update error', error);
    return c.json({ error: '更新部门失败' }, 500);
  }
});

// 删除部门（有子部门或仍有用户归属时禁删）
departments.delete('/:deptId', authMiddleware, requirePermission(PERMISSION_CODES.systemDeptDelete), async c => {
  try {
    const deptId = parseInt(c.req.param('deptId'));
    if (isNaN(deptId)) {
      return c.json({ error: '无效的部门ID' }, 400);
    }

    const db = new DatabaseWrapper(c.env.DB);

    const existing = await db.get('SELECT id FROM departments WHERE id = ?', [deptId]);
    if (!existing) {
      return c.json({ error: '部门不存在' }, 404);
    }

    const child = await db.get('SELECT id FROM departments WHERE parent_id = ? LIMIT 1', [deptId]);
    if (child) {
      return c.json({ error: '存在子部门，不可删除' }, 400);
    }

    const member = await db.get('SELECT id FROM users WHERE department_id = ? LIMIT 1', [deptId]);
    if (member) {
      return c.json({ error: '部门下仍有用户，不可删除' }, 400);
    }

    await db.run('DELETE FROM departments WHERE id = ?', [deptId]);

    return c.json({ success: true, message: '部门删除成功' });
  } catch (error) {
    logger.error('Department delete error', error);
    return c.json({ error: '删除部门失败' }, 500);
  }
});

// 通用入参校验；deptId 非空时校验"新父部门不能是自己或自己的后代"（防环）
async function validateDepartmentPayload(
  db: DatabaseWrapper,
  body: any,
  deptId: null | number
): Promise<null | string> {
  if (typeof body.name !== 'string' || body.name.trim() === '') {
    return '部门名称必填';
  }
  if (body.status !== undefined && body.status !== 0 && body.status !== 1) {
    return '状态无效';
  }
  if (body.sort_order !== undefined && !Number.isInteger(body.sort_order)) {
    return '排序值无效';
  }

  const parentId = body.parent_id ?? null;
  if (parentId !== null) {
    if (!Number.isInteger(parentId)) {
      return '上级部门无效';
    }
    if (deptId !== null && parentId === deptId) {
      return '上级部门不能是自己';
    }

    const parent = await db.get('SELECT id FROM departments WHERE id = ?', [parentId]);
    if (!parent) {
      return '上级部门不存在';
    }

    if (deptId !== null) {
      // 新上级落在自己的子树内会形成环
      const cycle = await db.get(
        `WITH RECURSIVE subtree(id) AS (
           SELECT id FROM departments WHERE parent_id = ?
           UNION ALL
           SELECT d.id FROM departments d JOIN subtree s ON d.parent_id = s.id
         )
         SELECT id FROM subtree WHERE id = ?`,
        [deptId, parentId]
      );
      if (cycle) {
        return '上级部门不能是自己的子部门';
      }
    }
  }

  return null;
}

// 取 rootId 及其所有后代（内存 BFS，行数据已全量在手无需再查库）
function filterSubtreeRows(
  rows: Omit<DepartmentNode, 'children'>[],
  rootId: number
): Omit<DepartmentNode, 'children'>[] {
  const keep = new Set<number>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const row of rows) {
      if (row.parent_id !== null && keep.has(row.parent_id) && !keep.has(row.id)) {
        keep.add(row.id);
        added = true;
      }
    }
  }
  return rows.filter(row => keep.has(row.id));
}

function buildDepartmentTree(
  rows: Omit<DepartmentNode, 'children'>[]
): DepartmentNode[] {
  const nodes = new Map<number, DepartmentNode>();
  const roots: DepartmentNode[] = [];

  for (const row of rows) {
    nodes.set(row.id, {
      ...row,
      children: [],
      status: Number(row.status),
      user_count: Number(row.user_count)
    });
  }

  for (const node of nodes.values()) {
    // parent 不在结果集内也视为根（scope=data 过滤后的子树根 parent_id 非空）
    const parent = node.parent_id === null ? undefined : nodes.get(node.parent_id);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export default departments;
