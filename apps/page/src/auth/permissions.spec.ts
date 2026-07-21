import { describe, expect, it } from "vitest";

import type { CurrentUser } from "@/api/types";
import { hasPermission } from "./permissions";

function createUser(permissions?: string[]): CurrentUser {
  return { id: 1, roles: ["admin"], username: "tester", permissions };
}

describe("hasPermission", () => {
  it("拥有权限码时返回 true", () => {
    expect(hasPermission(createUser(["system:user:create"]), "system:user:create")).toBe(true);
  });

  it("缺少权限码时返回 false", () => {
    expect(hasPermission(createUser(["system:user:view"]), "system:user:create")).toBe(false);
  });

  it("未传权限码时放行", () => {
    expect(hasPermission(createUser([]))).toBe(true);
  });

  it("用户为空或未下发 permissions 时拒绝", () => {
    expect(hasPermission(null, "system:user:view")).toBe(false);
    expect(hasPermission(createUser(), "system:user:view")).toBe(false);
  });
});
