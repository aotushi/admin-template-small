import { describe, expect, it } from "vitest";

import type { AdminRoleItem } from "@/api/modules/roles";
import {
  buildRoleOptions,
  getUserRoleCodes,
  isSameRoleSelection,
  normalizeRoleSelection,
} from "./userRoleOptions";

function createRole(overrides: Partial<AdminRoleItem>): AdminRoleItem {
  return {
    code: "user",
    created_at: "2026-07-01 00:00:00",
    data_scope: "self",
    id: 3,
    menu_ids: [],
    name: "普通用户",
    remark: "",
    status: 1,
    user_count: 0,
    ...overrides,
  };
}

describe("buildRoleOptions", () => {
  it("只保留启用角色，label 用角色名、value 用角色码（含自定义角色）", () => {
    const options = buildRoleOptions([
      createRole({ code: "super", id: 1, name: "总管理员" }),
      createRole({ code: "role_9", id: 9, name: "审计员" }),
      createRole({ code: "role_10", id: 10, name: "停用角色", status: 0 }),
    ]);

    expect(options).toEqual([
      { label: "总管理员", value: "super" },
      { label: "审计员", value: "role_9" },
    ]);
  });
});

describe("getUserRoleCodes", () => {
  it("返回用户绑定的角色码副本", () => {
    expect(getUserRoleCodes({ role_codes: ["admin", "role_9"] })).toEqual(["admin", "role_9"]);
  });

  it("无绑定回退 user（与后端创建默认一致）", () => {
    expect(getUserRoleCodes({ role_codes: [] })).toEqual(["user"]);
    expect(getUserRoleCodes({})).toEqual(["user"]);
  });
});

describe("isSameRoleSelection", () => {
  it("忽略顺序与重复比较角色集合", () => {
    expect(isSameRoleSelection(["admin", "user"], ["user", "admin"])).toBe(true);
    expect(isSameRoleSelection(["admin", "admin"], ["admin"])).toBe(true);
    expect(isSameRoleSelection(["admin"], ["admin", "user"])).toBe(false);
  });
});

describe("normalizeRoleSelection", () => {
  it("新勾选 super 时只保留 super", () => {
    expect(normalizeRoleSelection(["user", "super"], ["user"])).toEqual(["super"]);
  });

  it("已是 super 再勾选其他角色时移除 super", () => {
    expect(normalizeRoleSelection(["super", "admin"], ["super"])).toEqual(["admin"]);
  });

  it("不含 super 或仅 super 时原样返回", () => {
    expect(normalizeRoleSelection(["admin", "user"], ["admin"])).toEqual(["admin", "user"]);
    expect(normalizeRoleSelection(["super"], ["user"])).toEqual(["super"]);
  });
});
