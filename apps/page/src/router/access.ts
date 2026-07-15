import type { RouteLocationNormalized, RouteMeta, RouteRecordRaw } from "vue-router";

import type { CurrentUser } from "@/api/types";
import { hasPermission } from "@/auth/permissions";
import { hasAnyRole } from "@/auth/rbac";

// 声明了 meta.permission 的路由用权限码判定（细粒度、后端实时下发），
// 未声明的回落到 meta.roles 角色判定（粗粒度、由 role/admin_level 归一）。
function canAccessMeta(meta: RouteMeta | undefined, user: CurrentUser | null) {
  if (meta?.permission) {
    return hasPermission(user, meta.permission);
  }

  return hasAnyRole(user, meta?.roles);
}

export function canAccessRouteMeta(route: RouteRecordRaw, user: CurrentUser | null) {
  return canAccessMeta(route.meta, user);
}

export function canAccessMatchedRoute(to: RouteLocationNormalized, user: CurrentUser | null) {
  return to.matched.every((record) => canAccessMeta(record.meta, user));
}
