import type { RouteRecordRaw } from "vue-router";

import { createRouter, createWebHistory } from "vue-router";

import { getAccessToken } from "@/api/session";
import { resolvePostLoginRedirect } from "@/router/redirect";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/dashboard",
  },
  {
    component: () => import("@/views/LoginView.vue"),
    meta: {
      guestOnly: true,
    },
    name: "Login",
    path: "/login",
  },
  {
    component: () => import("@/views/DashboardView.vue"),
    meta: {
      requiresAuth: true,
    },
    name: "Dashboard",
    path: "/dashboard",
  },
  {
    path: "/login/:action(mobile|qrcode|forgot-password|register)",
    redirect: "/login",
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to) => {
  const isAuthenticated = Boolean(getAccessToken());

  if (to.meta.guestOnly && isAuthenticated) {
    return resolvePostLoginRedirect(to.query.redirect);
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    return {
      path: "/login",
      query: {
        redirect: to.fullPath,
      },
    };
  }

  return true;
});

export default router;
