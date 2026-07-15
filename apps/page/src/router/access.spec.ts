import { describe, expect, it } from "vitest";
import type { RouteRecordRaw } from "vue-router";

import type { CurrentUser } from "@/api/types";
import { canAccessRouteMeta } from "@/router/access";

function createUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return { id: 1, role: "user", username: "tester", ...overrides };
}

function createRoute(meta: RouteRecordRaw["meta"]): RouteRecordRaw {
  return { meta, path: "/mock" } as RouteRecordRaw;
}

describe("canAccessRouteMeta", () => {
  it("声明 meta.permission 时由权限码判定，roles 不参与", () => {
    const route = createRoute({ permission: "system:user:view", roles: ["super"] });

    expect(canAccessRouteMeta(route, createUser({ permissions: ["system:user:view"] }))).toBe(true);
    expect(canAccessRouteMeta(route, createUser({ admin_level: "super", role: "admin" }))).toBe(
      false,
    );
  });

  it("未声明 meta.permission 时回落 roles 判定", () => {
    const route = createRoute({ roles: ["super", "admin"] });

    expect(canAccessRouteMeta(route, createUser({ role: "admin" }))).toBe(true);
    expect(canAccessRouteMeta(route, createUser())).toBe(false);
  });

  it("permission 与 roles 均未声明时放行", () => {
    expect(canAccessRouteMeta(createRoute({}), createUser())).toBe(true);
  });
});
