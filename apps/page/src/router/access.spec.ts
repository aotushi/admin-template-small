import { describe, expect, it } from "vitest";
import type { RouteRecordRaw } from "vue-router";

import type { CurrentUser } from "@/api/types";
import { canAccessRouteMeta } from "@/router/access";

function createUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return { id: 1, username: "tester", ...overrides };
}

function createRoute(meta: RouteRecordRaw["meta"]): RouteRecordRaw {
  return { meta, path: "/mock" } as RouteRecordRaw;
}

describe("canAccessRouteMeta", () => {
  it("声明 meta.permission 时由权限码判定", () => {
    const route = createRoute({ permission: "system:user:view" });

    expect(canAccessRouteMeta(route, createUser({ permissions: ["system:user:view"] }))).toBe(true);
    expect(canAccessRouteMeta(route, createUser({ permissions: [] }))).toBe(false);
    expect(canAccessRouteMeta(route, createUser())).toBe(false);
  });

  it("未声明 meta.permission 时放行", () => {
    expect(canAccessRouteMeta(createRoute({}), createUser())).toBe(true);
    expect(canAccessRouteMeta(createRoute(undefined), null)).toBe(true);
  });
});
