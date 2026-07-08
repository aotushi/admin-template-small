import type { RouteRecordRaw } from "vue-router";

import type { CurrentUser } from "@/api/types";
import { canAccessRouteMeta } from "@/router/access";

export interface AppMenuItem {
  children?: AppMenuItem[];
  icon?: string;
  name?: string;
  path: string;
  title: string;
}

export function createMenuItems(
  routes: readonly RouteRecordRaw[],
  user: CurrentUser | null,
  parentPath = "",
) {
  return routes
    .filter((route) => canAccessRouteMeta(route, user))
    .filter((route) => route.meta?.title && !route.meta.hideInMenu)
    .sort(sortByRouteOrder)
    .map((route) => createMenuItem(route, user, parentPath));
}

function createMenuItem(
  route: RouteRecordRaw,
  user: CurrentUser | null,
  parentPath: string,
): AppMenuItem {
  const routePath = resolveRoutePath(route, parentPath);
  const children = route.children ? createMenuItems(route.children, user, routePath) : [];
  const path = resolveMenuPath(route, routePath);

  return {
    ...(children.length ? { children } : {}),
    ...(route.meta?.icon ? { icon: route.meta.icon } : {}),
    ...(route.name ? { name: String(route.name) } : {}),
    path,
    title: route.meta?.title ?? path,
  };
}

function resolveRoutePath(route: RouteRecordRaw, parentPath: string) {
  if (route.path.startsWith("/")) {
    return route.path;
  }

  return `${parentPath.replace(/\/$/, "")}/${route.path}`;
}

function resolveMenuPath(route: RouteRecordRaw, routePath: string) {
  if (typeof route.redirect === "string") {
    return route.redirect;
  }

  return routePath;
}

function sortByRouteOrder(left: RouteRecordRaw, right: RouteRecordRaw) {
  return (left.meta?.order ?? 0) - (right.meta?.order ?? 0);
}
