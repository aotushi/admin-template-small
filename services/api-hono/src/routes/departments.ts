import { Hono } from 'hono';
import type { Env } from '../index';
import { adminMiddleware, authMiddleware } from '../middlewares/auth';
import { DatabaseWrapper } from '../models/database';
import { logger } from '../utils/logger';

interface DepartmentNode {
  children: DepartmentNode[];
  code: string;
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  user_count: number;
}

const departments = new Hono<{ Bindings: Env }>();

departments.get('/tree', authMiddleware, adminMiddleware, async c => {
  try {
    const db = new DatabaseWrapper(c.env.DB);
    const rows = await db.all(`
      SELECT
        d.id,
        d.parent_id,
        d.code,
        d.name,
        d.sort_order,
        COUNT(u.id) AS user_count
      FROM departments d
      LEFT JOIN users u ON u.department_id = d.id
      GROUP BY d.id, d.parent_id, d.code, d.name, d.sort_order
      ORDER BY d.sort_order ASC, d.id ASC
    `);

    return c.json({
      success: true,
      data: buildDepartmentTree(rows as Omit<DepartmentNode, 'children'>[])
    });
  } catch (error) {
    logger.error('Departments tree error', error);
    return c.json({ error: '获取部门列表失败' }, 500);
  }
});

function buildDepartmentTree(
  rows: Omit<DepartmentNode, 'children'>[]
): DepartmentNode[] {
  const nodes = new Map<number, DepartmentNode>();
  const roots: DepartmentNode[] = [];

  for (const row of rows) {
    nodes.set(row.id, {
      ...row,
      children: [],
      user_count: Number(row.user_count)
    });
  }

  for (const node of nodes.values()) {
    if (node.parent_id === null) {
      roots.push(node);
      continue;
    }

    const parent = nodes.get(node.parent_id);
    if (parent) {
      parent.children.push(node);
    }
  }

  return roots;
}

export default departments;

