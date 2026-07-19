import { describe, expect, it } from "vitest";

import { toRoleOption } from "./userRoleOptions";

describe("toRoleOption", () => {
  it("内置角色码直接映射", () => {
    expect(toRoleOption({ role_code: "super" })).toBe("super");
    expect(toRoleOption({ role_code: "admin" })).toBe("admin");
    expect(toRoleOption({ role_code: "user" })).toBe("user");
  });

  it("自定义角色码与无绑定归入 user 展示", () => {
    expect(toRoleOption({ role_code: "role_4" })).toBe("user");
    expect(toRoleOption({ role_code: null })).toBe("user");
    expect(toRoleOption({})).toBe("user");
  });
});
