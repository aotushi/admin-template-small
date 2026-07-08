import { createRouter, createWebHistory } from "vue-router";

import { setupRouterGuards } from "@/router/guards";
import { routes } from "@/router/routes";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

setupRouterGuards(router);

export default router;
export { appRoutes, routes } from "@/router/routes";
