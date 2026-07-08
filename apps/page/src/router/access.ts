import type { RouteLocationNormalized, RouteRecordRaw } from "vue-router";

import type { CurrentUser } from "@/api/types";
import { hasAnyRole } from "@/auth/rbac";

export function canAccessRouteMeta(route: RouteRecordRaw, user: CurrentUser | null) {
  return hasAnyRole(user, route.meta?.roles);
}

export function canAccessMatchedRoute(to: RouteLocationNormalized, user: CurrentUser | null) {
  return to.matched.every((record) => hasAnyRole(user, record.meta.roles));
}
