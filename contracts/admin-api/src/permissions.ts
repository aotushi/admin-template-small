// RBAC 权限契约：权限码目录、数据范围、角色种子映射的单一事实源。
// 前端（按钮指令 / 路由 meta）与后端（requirePermission 中间件 / 数据范围过滤）
// 引用同一份常量；D1 种子迁移（services/api-hono/migrations/021）须与本文件保持同步。
// 权限载体自迁移 021 起为 menus 树表（auth_code 列），permissions 表已废弃。

/** 权限码命名规范：模块:资源:动作（system 下四个资源 × 完整 CRUD） */
export const PERMISSION_CODES = {
  systemDeptCreate: "system:dept:create",
  systemDeptDelete: "system:dept:delete",
  systemDeptUpdate: "system:dept:update",
  systemDeptView: "system:dept:view",
  systemMenuCreate: "system:menu:create",
  systemMenuDelete: "system:menu:delete",
  systemMenuUpdate: "system:menu:update",
  systemMenuView: "system:menu:view",
  systemRoleCreate: "system:role:create",
  systemRoleDelete: "system:role:delete",
  systemRoleUpdate: "system:role:update",
  systemRoleView: "system:role:view",
  systemUserCreate: "system:user:create",
  systemUserDelete: "system:user:delete",
  systemUserUpdate: "system:user:update",
  systemUserView: "system:user:view",
} as const;

export type PermissionCode = (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES];

/** 菜单节点类型：catalog 目录（只组织层级）/ menu 菜单页（可挂路由）/ button 页内按钮 */
export const MENU_TYPES = {
  button: "button",
  catalog: "catalog",
  menu: "menu",
} as const;

export type MenuType = (typeof MENU_TYPES)[keyof typeof MENU_TYPES];

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

/** 内置角色码（roles 表种子）；用户的角色归属唯一来源是 user_roles 表 */
export const ROLE_CODES = {
  admin: "admin",
  super: "super",
  user: "user",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

/**
 * 角色 → 权限码种子（迁移 021 据此写入 role_menus）。
 * admin 不再单独持有 system:dept:view：用户页部门树接口对
 * system:user:view 或 system:dept:view 任一放行（见 departments 路由）。
 */
export const ROLE_PERMISSION_SEEDS: Record<RoleCode, readonly PermissionCode[]> = {
  admin: [
    PERMISSION_CODES.systemUserView,
    PERMISSION_CODES.systemUserCreate,
    PERMISSION_CODES.systemUserUpdate,
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

export function isMenuType(value: unknown): value is MenuType {
  return Object.values(MENU_TYPES).some((type) => type === value);
}
