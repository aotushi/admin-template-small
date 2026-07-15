import { describe, expect, it } from "vitest";

import { toRoleFields, toRoleOption } from "./userRoleOptions";

describe("toRoleOption", () => {
  it("归一规则与后端 toRoleCode 一致", () => {
    expect(toRoleOption({ admin_level: "super", role: "admin" })).toBe("super");
    expect(toRoleOption({ admin_level: "sub", role: "admin" })).toBe("admin");
    expect(toRoleOption({ admin_level: null, role: "admin" })).toBe("admin");
    expect(toRoleOption({ admin_level: null, role: "user" })).toBe("user");
  });
});

describe("toRoleFields", () => {
  it("角色选项映射回 role/admin_level 字段", () => {
    expect(toRoleFields("super")).toEqual({ admin_level: "super", role: "admin" });
    expect(toRoleFields("admin")).toEqual({ admin_level: "sub", role: "admin" });
    expect(toRoleFields("user")).toEqual({ admin_level: null, role: "user" });
  });

  it("与 toRoleOption 互为往返", () => {
    for (const option of ["super", "admin", "user"] as const) {
      expect(toRoleOption(toRoleFields(option))).toBe(option);
    }
  });
});
