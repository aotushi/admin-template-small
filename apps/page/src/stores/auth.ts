import { computed, shallowRef } from "vue";
import { defineStore } from "pinia";

import { logoutApi } from "@/api/modules/auth";
import { authSessionCoordinator } from "@/api/request";
import { getAuthSessionSnapshot, subscribeAuthSession } from "@/api/session";

export const useAuthStore = defineStore("auth", () => {
  const initialSession = getAuthSessionSnapshot();
  const accessToken = shallowRef<null | string>(initialSession.accessToken);
  const currentUser = shallowRef(initialSession.currentUser);
  const sessionRestoreCompleted = shallowRef(Boolean(initialSession.accessToken));
  let restorePromise: null | Promise<boolean> = null;

  // super 专属规则（如角色分配入口）用角色码判定；其余显隐一律走权限码
  const isSuper = computed(() => Boolean(currentUser.value?.roles?.includes("super")));
  const isAuthenticated = computed(() => Boolean(accessToken.value));

  subscribeAuthSession((nextSession) => {
    accessToken.value = nextSession.accessToken;
    currentUser.value = nextSession.currentUser;
    if (nextSession.accessToken) {
      sessionRestoreCompleted.value = true;
    }
  });

  function clearSession() {
    authSessionCoordinator.endSession();
    sessionRestoreCompleted.value = true;
  }

  async function restoreSession() {
    if (accessToken.value) {
      sessionRestoreCompleted.value = true;
      return true;
    }

    if (sessionRestoreCompleted.value) {
      return false;
    }

    restorePromise ??= authSessionCoordinator
      .refresh("restore")
      .then(() => {
        return true;
      })
      .catch(() => {
        return false;
      })
      .finally(() => {
        sessionRestoreCompleted.value = true;
        restorePromise = null;
      });

    return restorePromise;
  }

  async function logout() {
    await authSessionCoordinator.logout(logoutApi);
    sessionRestoreCompleted.value = true;
  }

  return {
    accessToken,
    clearSession,
    currentUser,
    isAuthenticated,
    isSuper,
    logout,
    restoreSession,
    sessionRestoreCompleted,
  };
});
