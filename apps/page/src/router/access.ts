import type { RouteLocationNormalized, RouteMeta, RouteRecordRaw } from "vue-router";

import type { CurrentUser } from "@/api/types";
import { hasPermission } from "@/auth/permissions";

// 声明了 meta.permission 的路由用权限码判定（后端实时下发）；未声明视为登录即可访问。
function canAccessMeta(meta: RouteMeta | undefined, user: CurrentUser | null) {
  if (meta?.permission) {
    return hasPermission(user, meta.permission);
  }

  return true;
}

export function canAccessRouteMeta(route: RouteRecordRaw, user: CurrentUser | null) {
  return canAccessMeta(route.meta, user);
}

export function canAccessMatchedRoute(to: RouteLocationNormalized, user: CurrentUser | null) {
  return to.matched.every((record) => canAccessMeta(record.meta, user));
}
