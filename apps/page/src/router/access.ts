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

// 在分组记录的子树中找第一个当前用户可访问的叶子路径（与菜单同按 meta.order 排序）。
// 用于分组 redirect 的固定落点（如 /system -> /system/users）对当前用户无权时改投。
export function resolveFirstAccessiblePath(
  record: { children?: readonly RouteRecordRaw[]; path: string },
  user: CurrentUser | null,
): string | null {
  const children = [...(record.children ?? [])].sort(
    (left, right) => (left.meta?.order ?? 0) - (right.meta?.order ?? 0),
  );

  for (const child of children) {
    if (!canAccessRouteMeta(child, user)) {
      continue;
    }

    const childPath = child.path.startsWith("/")
      ? child.path
      : `${record.path.replace(/\/$/, "")}/${child.path}`;

    if (child.children?.length) {
      const nested = resolveFirstAccessiblePath(
        { children: child.children, path: childPath },
        user,
      );

      if (nested) {
        return nested;
      }

      continue;
    }

    return childPath;
  }

  return null;
}
