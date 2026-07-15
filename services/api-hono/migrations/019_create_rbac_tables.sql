-- RBAC 四表：角色、权限点、角色-权限、用户-角色。
-- 权限码与种子映射的单一事实源在 contracts/admin-api/src/permissions.ts，
-- 本文件的 INSERT 必须与其保持同步。

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  -- 数据范围：all 全部 / dept 本部门及子部门 / self 仅本人创建
  data_scope TEXT NOT NULL DEFAULT 'self' CHECK (data_scope IN ('all', 'dept', 'self')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 命名规范：模块:资源:动作
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  -- menu 控页面/菜单，button 控操作，api 仅后端接口，field 控字段可见性
  type TEXT NOT NULL DEFAULT 'api' CHECK (type IN ('menu', 'button', 'api', 'field')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role_id);

-- 角色种子（数据范围与 ROLE_DATA_SCOPES 同步）
INSERT OR IGNORE INTO roles (code, name, data_scope) VALUES
  ('super', '总管理员', 'all'),
  ('admin', '子管理员', 'self'),
  ('user', '普通用户', 'self');

-- 权限点种子（与 PERMISSION_CODES 同步）
INSERT OR IGNORE INTO permissions (code, name, type) VALUES
  ('system:user:view', '用户管理-查看', 'menu'),
  ('system:user:create', '用户管理-新增', 'button'),
  ('system:user:update', '用户管理-编辑', 'button'),
  ('system:user:delete', '用户管理-删除', 'button'),
  ('system:dept:view', '部门树-查看', 'api');

-- 角色-权限种子（与 ROLE_PERMISSION_SEEDS 同步）：super 全量
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'super';

-- admin：查看/新增/编辑 + 部门树（无删除）
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'admin'
  AND p.code IN ('system:user:view', 'system:user:create', 'system:user:update', 'system:dept:view');

-- 从 users.role/admin_level 回填 user_roles（归一规则与前端 resolveUserAccessRole 一致）
INSERT OR IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.code = CASE
  WHEN u.role = 'admin' AND u.admin_level = 'super' THEN 'super'
  WHEN u.role = 'admin' THEN 'admin'
  ELSE 'user'
END;
