-- 角色管理权限码：system:role:view / system:role:update，仅授予 super。
-- 与 contracts/admin-api/src/permissions.ts 的 PERMISSION_CODES / ROLE_PERMISSION_SEEDS 保持同步。

INSERT OR IGNORE INTO permissions (code, name, type) VALUES
  ('system:role:view', '角色管理-查看', 'menu'),
  ('system:role:update', '角色管理-编辑', 'button');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'super'
  AND p.code IN ('system:role:view', 'system:role:update');
