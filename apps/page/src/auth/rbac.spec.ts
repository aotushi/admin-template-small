import { describe, expect, it } from "vitest";

import type { CurrentUser } from "@/api/types";
import { hasAnyRole, resolveUserAccessRole } from "@/auth/rbac";

const superUser: CurrentUser = {
  admin_level: "super",
  id: 1,
  role: "admin",
  username: "vben",
};

const adminUser: CurrentUser = {
  admin_level: "sub",
  id: 2,
  role: "admin",
  username: "admin",
};

const normalUser: CurrentUser = {
  id: 3,
  role: "user",
  username: "jack",
};

describe("rbac role resolution", () => {
  it("maps backend user fields to frontend access roles", () => {
    expect(resolveUserAccessRole(superUser)).toBe("super");
    expect(resolveUserAccessRole(adminUser)).toBe("admin");
    expect(resolveUserAccessRole(normalUser)).toBe("user");
    expect(resolveUserAccessRole(null)).toBeNull();
  });

  it("checks whether a user has one of the allowed roles", () => {
    expect(hasAnyRole(superUser, ["super"])).toBe(true);
    expect(hasAnyRole(adminUser, ["super"])).toBe(false);
    expect(hasAnyRole(normalUser, ["super", "admin"])).toBe(false);
    expect(hasAnyRole(normalUser, ["user"])).toBe(true);
    expect(hasAnyRole(normalUser)).toBe(true);
  });
});
