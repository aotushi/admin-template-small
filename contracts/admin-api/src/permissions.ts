// RBAC 权限契约：权限码目录、数据范围、角色种子映射的单一事实源。
// 前端（按钮指令 / 路由 meta）与后端（requirePermission 中间件 / 数据范围过滤）
// 引用同一份常量；D1 种子迁移（services/api-hono/migrations/019、020）须与本文件保持同步。

/** 权限码命名规范：模块:资源:动作 */
export const PERMISSION_CODES = {
  systemDeptView: "system:dept:view",
  systemRoleUpdate: "system:role:update",
  systemRoleView: "system:role:view",
  systemUserCreate: "system:user:create",
  systemUserDelete: "system:user:delete",
  systemUserUpdate: "system:user:update",
  systemUserView: "system:user:view",
} as const;

export type PermissionCode = (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES];

/** 权限点分类：menu 控页面/菜单，button 控操作，api 仅后端接口，field 控字段可见性 */
export type PermissionType = "api" | "button" | "field" | "menu";

/** 数据范围：能看到/改动哪些行。all 全部，dept 本部门及子部门，self 仅本人创建 */
export const DATA_SCOPES = {
  all: "all",
  dept: "dept",
  self: "self",
} as const;

export type DataScope = (typeof DATA_SCOPES)[keyof typeof DATA_SCOPES];

/** 数据范围强弱序（多角色取最强） */
export const DATA_SCOPE_RANK: Record<DataScope, number> = {
  all: 3,
  dept: 2,
  self: 1,
};

/** 角色码：与 users.role/admin_level 的归一结果一致（super/admin/user） */
export const ROLE_CODES = {
  admin: "admin",
  super: "super",
  user: "user",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

/** 角色 → 权限码种子（迁移 019 据此写入 role_permissions） */
export const ROLE_PERMISSION_SEEDS: Record<RoleCode, readonly PermissionCode[]> = {
  admin: [
    PERMISSION_CODES.systemUserView,
    PERMISSION_CODES.systemUserCreate,
    PERMISSION_CODES.systemUserUpdate,
    PERMISSION_CODES.systemDeptView,
  ],
  super: Object.values(PERMISSION_CODES),
  user: [],
};

/** 角色 → 数据范围种子 */
export const ROLE_DATA_SCOPES: Record<RoleCode, DataScope> = {
  admin: DATA_SCOPES.self,
  super: DATA_SCOPES.all,
  user: DATA_SCOPES.self,
};

export function isPermissionCode(value: unknown): value is PermissionCode {
  return Object.values(PERMISSION_CODES).some((code) => code === value);
}

export function isDataScope(value: unknown): value is DataScope {
  return Object.values(DATA_SCOPES).some((scope) => scope === value);
}
