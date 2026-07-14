import type { Router } from "vue-router";

import { useAuthStore } from "@/stores/auth";
import { canAccessMatchedRoute } from "@/router/access";
import { resolvePostLoginRedirect } from "@/router/redirect";

const LOGIN_ROUTE_NAME = "Login";
const DASHBOARD_ROUTE_NAME = "Dashboard";
const FORBIDDEN_ROUTE_NAME = "Forbidden";

export function setupRouterGuards(router: Router) {
  router.beforeEach(async (to) => {
    const authStore = useAuthStore();

    if (!authStore.isAuthenticated && !authStore.sessionRestoreCompleted) {
      await authStore.restoreSession();
    }

    if (to.meta.guestOnly && authStore.isAuthenticated) {
      return {
        path: resolvePostLoginRedirect(to.query.redirect),
        replace: true,
      };
    }

    if (to.matched.some((record) => record.meta.requiresAuth) && !authStore.isAuthenticated) {
      if (to.name === LOGIN_ROUTE_NAME) {
        return true;
      }

      return {
        name: LOGIN_ROUTE_NAME,
        query: {
          redirect: to.fullPath,
        },
        replace: true,
      };
    }

    if (authStore.isAuthenticated && !canAccessMatchedRoute(to, authStore.currentUser)) {
      if (to.name === FORBIDDEN_ROUTE_NAME) {
        return true;
      }

      return {
        name: FORBIDDEN_ROUTE_NAME,
        query: {
          from: to.fullPath,
        },
        replace: true,
      };
    }

    if (to.path === "/" && authStore.isAuthenticated) {
      return {
        name: DASHBOARD_ROUTE_NAME,
        replace: true,
      };
    }

    return true;
  });
}
