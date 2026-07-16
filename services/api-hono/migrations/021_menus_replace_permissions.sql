-- 021：权限载体换代 —— menus 树表 + role_menus 取代 permissions + role_permissions。
-- 权限码与角色种子的单一事实源在 contracts/admin-api/src/permissions.ts，
-- 本文件的 INSERT 必须与其保持同步。
-- 角色绑定按 ROLE_PERMISSION_SEEDS 重建（模板项目无自定义角色数据，直接种子重置）。

-- 菜单树：catalog 目录 / menu 菜单页 / button 页内按钮；auth_code 即权限码
CREATE TABLE IF NOT EXISTS menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pid INTEGER REFERENCES menus (id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('catalog', 'menu', 'button')),
  title TEXT NOT NULL,
  auth_code TEXT UNIQUE,
  path TEXT,
  component TEXT,
  -- 1 启用 / 0 停用；停用节点不参与权限解析
  status INTEGER NOT NULL DEFAULT 1 CHECK (status IN (0, 1)),
  sort INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CHECK (pid IS NULL OR pid <> id)
);

CREATE INDEX IF NOT EXISTS idx_menus_pid ON menus (pid);

CREATE TABLE IF NOT EXISTS role_menus (
  role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  menu_id INTEGER NOT NULL REFERENCES menus (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, menu_id)
);

CREATE INDEX IF NOT EXISTS idx_role_menus_role ON role_menus (role_id);

-- roles 扩展：完整 CRUD 需要状态与备注；停用角色即时失去全部权限
ALTER TABLE roles ADD COLUMN status INTEGER NOT NULL DEFAULT 1 CHECK (status IN (0, 1));
ALTER TABLE roles ADD COLUMN remark TEXT;

-- departments 扩展：部门管理页需要状态与备注
ALTER TABLE departments ADD COLUMN status INTEGER NOT NULL DEFAULT 1 CHECK (status IN (0, 1));
ALTER TABLE departments ADD COLUMN remark TEXT;

-- ============ 菜单种子：系统管理目录 + 四个管理页 + 各自 CRUD 按钮 ============

INSERT INTO menus (pid, type, title, auth_code, path, component, sort)
VALUES (NULL, 'catalog', '系统管理', NULL, '/system', NULL, 60);

INSERT INTO menus (pid, type, title, auth_code, path, component, sort)
SELECT id, 'menu', '用户管理', 'system:user:view', '/system/users',
       'views/system/users/UserManagementView.vue', 10
FROM menus WHERE type = 'catalog' AND title = '系统管理';

INSERT INTO menus (pid, type, title, auth_code, path, component, sort)
SELECT id, 'menu', '角色管理', 'system:role:view', '/system/roles',
       'views/system/roles/RoleManagementView.vue', 20
FROM menus WHERE type = 'catalog' AND title = '系统管理';

INSERT INTO menus (pid, type, title, auth_code, path, component, sort)
SELECT id, 'menu', '菜单管理', 'system:menu:view', '/system/menus',
       'views/system/menus/MenuManagementView.vue', 30
FROM menus WHERE type = 'catalog' AND title = '系统管理';

INSERT INTO menus (pid, type, title, auth_code, path, component, sort)
SELECT id, 'menu', '部门管理', 'system:dept:view', '/system/depts',
       'views/system/depts/DeptManagementView.vue', 40
FROM menus WHERE type = 'catalog' AND title = '系统管理';

-- 各管理页的新增/编辑/删除按钮（auth_code = 页面码把 view 换成对应动作）
INSERT INTO menus (pid, type, title, auth_code, sort)
SELECT m.id, 'button', m.title || '-新增', REPLACE(m.auth_code, ':view', ':create'), 10
FROM menus m WHERE m.type = 'menu' AND m.auth_code LIKE 'system:%:view';

INSERT INTO menus (pid, type, title, auth_code, sort)
SELECT m.id, 'button', m.title || '-编辑', REPLACE(m.auth_code, ':view', ':update'), 20
FROM menus m WHERE m.type = 'menu' AND m.auth_code LIKE 'system:%:view';

INSERT INTO menus (pid, type, title, auth_code, sort)
SELECT m.id, 'button', m.title || '-删除', REPLACE(m.auth_code, ':view', ':delete'), 30
FROM menus m WHERE m.type = 'menu' AND m.auth_code LIKE 'system:%:view';

-- ============ 角色绑定种子（与 ROLE_PERMISSION_SEEDS 同步） ============

-- super：全量菜单
INSERT OR IGNORE INTO role_menus (role_id, menu_id)
SELECT r.id, m.id FROM roles r, menus m WHERE r.code = 'super';

-- admin：用户管理 查看/新增/编辑（不再单独持有 dept:view，
-- 用户页部门树接口对 user:view 同样放行）
INSERT OR IGNORE INTO role_menus (role_id, menu_id)
SELECT r.id, m.id FROM roles r, menus m
WHERE r.code = 'admin'
  AND m.auth_code IN ('system:user:view', 'system:user:create', 'system:user:update');

-- 补父链（button → menu → catalog，两轮覆盖两层）
INSERT OR IGNORE INTO role_menus (role_id, menu_id)
SELECT rm.role_id, m.pid FROM role_menus rm JOIN menus m ON m.id = rm.menu_id
WHERE m.pid IS NOT NULL;

INSERT OR IGNORE INTO role_menus (role_id, menu_id)
SELECT rm.role_id, m.pid FROM role_menus rm JOIN menus m ON m.id = rm.menu_id
WHERE m.pid IS NOT NULL;

-- ============ 旧权限表废弃 ============

DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
