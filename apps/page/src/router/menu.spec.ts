import { describe, expect, it } from "vitest";

import type { CurrentUser } from "@/api/types";
import { createMenuItems } from "@/router/menu";
import { appRoutes } from "@/router/routes";

// permissions 对齐迁移 021 的角色种子：super 全量 16 码、子管理员仅用户管理三码
const superUser: CurrentUser = {
  id: 1,
  permissions: [
    "system:dept:create",
    "system:dept:delete",
    "system:dept:update",
    "system:dept:view",
    "system:menu:create",
    "system:menu:delete",
    "system:menu:update",
    "system:menu:view",
    "system:role:create",
    "system:role:delete",
    "system:role:update",
    "system:role:view",
    "system:user:create",
    "system:user:delete",
    "system:user:update",
    "system:user:view",
  ],
  roles: ["super"],
  username: "vben",
};

const adminUser: CurrentUser = {
  id: 2,
  permissions: ["system:user:create", "system:user:update", "system:user:view"],
  roles: ["admin"],
  username: "admin",
};

const normalUser: CurrentUser = {
  id: 3,
  roles: ["user"],
  username: "jack",
};

describe("route driven menu", () => {
  it("keeps super user menu aligned with the template route plan", () => {
    const menu = createMenuItems(appRoutes, superUser);

    expect(menu.map((item) => item.title)).toEqual(["概览", "公共组件", "系统管理"]);

    const componentMenu = menu.find((item) => item.title === "公共组件");
    const tableMenu = componentMenu?.children?.find((item) => item.title === "表格");

    expect(componentMenu?.path).toBe("/components");
    expect(componentMenu?.children?.map((item) => item.title)).toEqual([
      "表格",
      "查询表单",
      "树形筛选",
    ]);
    expect(tableMenu?.path).toBe("/components/table");
    expect(tableMenu?.children?.map((item) => item.title)).toEqual(["基础表格", "搜索表格"]);
    expect(tableMenu?.children?.map((item) => item.path)).toEqual([
      "/components/table/basic",
      "/components/table/search",
    ]);
    expect(
      menu.find((item) => item.title === "系统管理")?.children?.map((item) => item.title),
    ).toEqual(["用户管理", "角色管理", "菜单管理", "部门管理"]);
  });

  it("hides super-only system entries from admin users", () => {
    const systemMenu = createMenuItems(appRoutes, adminUser).find(
      (item) => item.title === "系统管理",
    );

    expect(systemMenu?.children?.map((item) => item.title)).toEqual(["用户管理"]);
  });

  it("filters business menus for normal users", () => {
    const menu = createMenuItems(appRoutes, normalUser);

    expect(menu.map((item) => item.title)).toEqual(["概览", "公共组件"]);
  });
});
