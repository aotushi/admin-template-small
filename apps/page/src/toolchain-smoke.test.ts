import { describe, expect, it } from "vitest";

import App from "./App.vue";
import router, { routes } from "./router";
import { quickAccounts } from "./views/loginAccounts";

describe("page scaffold", () => {
  it("loads the Vue entry component and login route", () => {
    expect(App).toBeTruthy();
    expect(router).toBeTruthy();
    expect(routes.some((route) => route.path === "/login")).toBe(true);
    expect(routes.some((route) => route.path === "/dashboard")).toBe(true);
  });

  it("keeps quick login accounts aligned with the target admin template", () => {
    expect(quickAccounts.map((account) => account.label)).toEqual(["Super", "Admin", "User"]);
    expect(quickAccounts.map((account) => account.username)).toEqual(["vben", "admin", "jack"]);
  });
});
