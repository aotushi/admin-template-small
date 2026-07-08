import { describe, expect, it } from "vitest";
import type { RouteRecordRaw } from "vue-router";

import App from "./App.vue";
import router, { routes } from "./router";
import { quickAccounts } from "./views/loginAccounts";

function hasRoutePath(routeRecords: readonly RouteRecordRaw[], path: string): boolean {
  return routeRecords.some(
    (route) => route.path === path || hasRoutePath(route.children ?? [], path),
  );
}

describe("page scaffold", () => {
  it("loads the Vue entry component and login route", () => {
    expect(App).toBeTruthy();
    expect(router).toBeTruthy();
    expect(routes.some((route) => route.path === "/login")).toBe(true);
    expect(hasRoutePath(routes, "/dashboard")).toBe(true);
    expect(routes.some((route) => route.path === "/" && route.children?.length)).toBe(true);
    expect(routes.some((route) => route.path === "/403")).toBe(true);
    expect(routes.some((route) => route.path === "/404")).toBe(true);
  });

  it("keeps quick login accounts aligned with the target admin template", () => {
    expect(quickAccounts.map((account) => account.label)).toEqual(["Super", "Admin", "User"]);
    expect(quickAccounts.map((account) => account.username)).toEqual(["vben", "admin", "jack"]);
  });
});
