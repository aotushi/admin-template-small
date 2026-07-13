import { describe, expect, it } from "vitest";

import type { CurrentUser } from "@/api/types";
import { createMenuItems } from "@/router/menu";
import { appRoutes } from "@/router/routes";

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

describe("route driven menu", () => {
  it("keeps super user menu aligned with the v1 route plan", () => {
    const menu = createMenuItems(appRoutes, superUser);

    expect(menu.map((item) => item.title)).toEqual([
      "概览",
      "数据统计",
      "数据报告",
      "Excel管理",
      "API 管理",
      "公共组件",
      "系统管理",
    ]);
    expect(menu.find((item) => item.title === "数据统计")?.children?.[0]?.path).toBe(
      "/statistics/daily",
    );
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
    ).toEqual(["用户管理", "用户数据", "角色管理", "权限管理", "菜单管理"]);
  });

  it("hides super-only system entries from admin users", () => {
    const systemMenu = createMenuItems(appRoutes, adminUser).find(
      (item) => item.title === "系统管理",
    );

    expect(systemMenu?.children?.map((item) => item.title)).toEqual(["用户管理", "用户数据"]);
  });

  it("filters business menus for normal users", () => {
    const menu = createMenuItems(appRoutes, normalUser);

    expect(menu.map((item) => item.title)).toEqual([
      "概览",
      "数据报告",
      "Excel管理",
      "API 管理",
      "公共组件",
    ]);
    expect(
      menu.find((item) => item.title === "数据报告")?.children?.map((item) => item.title),
    ).toEqual(["数据报表", "结算单"]);
    expect(
      menu.find((item) => item.title === "Excel管理")?.children?.map((item) => item.title),
    ).toEqual(["文件列表"]);
    expect(
      menu.find((item) => item.title === "API 管理")?.children?.map((item) => item.title),
    ).toEqual(["我的 API Key", "API 文档"]);
  });
});
