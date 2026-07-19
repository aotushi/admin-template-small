import "vue-router";

export interface AppRouteMeta {
  activeMenu?: string;
  guestOnly?: boolean;
  hideInMenu?: boolean;
  icon?: string;
  order?: number;
  /** RBAC 权限码（生效的访问控制）：声明后由后端下发的 user.permissions 判定，未声明视为登录即可访问 */
  permission?: string;
  /** 占位页展示用的权限码清单（不参与访问控制）；逐步迁移到 permission 后移除 */
  permissions?: readonly string[];
  requiresAuth?: boolean;
  title?: string;
}

declare module "vue-router" {
  interface RouteMeta extends AppRouteMeta {}
}
