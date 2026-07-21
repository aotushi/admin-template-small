import { describe, expect, it } from "vitest";
import type { RouteRecordRaw } from "vue-router";

import { compareRouteOrder } from "@/router/order";

function createRoute(meta: RouteRecordRaw["meta"]): RouteRecordRaw {
  return { meta, path: "/mock" } as RouteRecordRaw;
}

function sortTitles(routes: RouteRecordRaw[]) {
  return routes.sort(compareRouteOrder).map((route) => route.meta?.title);
}

describe("compareRouteOrder", () => {
  it("按 meta.order 升序排列", () => {
    const routes = [createRoute({ order: 20, title: "b" }), createRoute({ order: 10, title: "a" })];

    expect(sortTitles(routes)).toEqual(["a", "b"]);
  });

  it("未声明 order 的路由排在同级最后", () => {
    const routes = [createRoute({ title: "last" }), createRoute({ order: 10, title: "first" })];

    expect(sortTitles(routes)).toEqual(["first", "last"]);
  });

  it("同级均未声明 order 时保持声明顺序", () => {
    const routes = [
      createRoute({ title: "a" }),
      createRoute({ title: "b" }),
      createRoute({ title: "c" }),
    ];

    expect(sortTitles(routes)).toEqual(["a", "b", "c"]);
  });
});
