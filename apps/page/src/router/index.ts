// 静态路由作为页面和菜单的前端单一来源，后端权限码决定哪些菜单可见，后端接口再次执行真正的权限校验。
import { createRouter, createWebHistory } from "vue-router";

import { setupRouterGuards } from "@/router/guards";
import { routes } from "@/router/routes";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

setupRouterGuards(router);

export default router;
