import { computed, shallowRef } from "vue";
import { defineStore } from "pinia";

import type { CurrentUser, LoginResult } from "@/api/types";
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  saveAuthSession,
} from "@/api/session";
import { resolveUserAccessRole } from "@/auth/rbac";

export const useAuthStore = defineStore("auth", () => {
  const accessToken = shallowRef<string | null>(getAccessToken());
  const refreshToken = shallowRef<string | null>(getRefreshToken());
  const currentUser = shallowRef<CurrentUser | null>(getStoredUser());

  const accessRole = computed(() => resolveUserAccessRole(currentUser.value));
  const isAuthenticated = computed(() => Boolean(accessToken.value));

  function restoreFromStorage() {
    accessToken.value = getAccessToken();
    refreshToken.value = getRefreshToken();
    currentUser.value = getStoredUser();
  }

  function setSession(result: LoginResult) {
    saveAuthSession(result);
    accessToken.value = getAccessToken();
    refreshToken.value = getRefreshToken();
    currentUser.value = result.user ?? getStoredUser();
  }

  function clearSession() {
    clearAuthSession();
    accessToken.value = null;
    refreshToken.value = null;
    currentUser.value = null;
  }

  return {
    accessRole,
    accessToken,
    clearSession,
    currentUser,
    isAuthenticated,
    refreshToken,
    restoreFromStorage,
    setSession,
  };
});
