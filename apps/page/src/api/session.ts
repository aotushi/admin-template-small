import type { CurrentUser, LoginResult, TokenRefreshResult } from "@/api/types";

export const ACCESS_TOKEN_KEY = "admin-backend-3-token";
const REFRESH_TOKEN_KEY = "admin-backend-3-refresh-token";
const TOKEN_EXPIRES_KEY = "admin-backend-3-token-expires";
const CURRENT_USER_KEY = "admin-backend-3-current-user";
const LOGIN_LOCALE_KEY = "admin-backend-3-page-login-locale";

function getStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getAccessToken() {
  return getStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function getRefreshToken() {
  return getStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
}

export function getPreferredLocale() {
  const storage = getStorage();
  return storage?.getItem(LOGIN_LOCALE_KEY) || navigator.language || "zh-CN";
}

export function getStoredUser(): CurrentUser | null {
  const rawUser = getStorage()?.getItem(CURRENT_USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as CurrentUser;
  } catch {
    return null;
  }
}

export function saveAuthSession(result: LoginResult) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  saveAuthTokens(result);

  if (result.user) {
    storage.setItem(CURRENT_USER_KEY, JSON.stringify(result.user));
  }
}

export function saveAuthTokens(result: LoginResult | TokenRefreshResult) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(ACCESS_TOKEN_KEY, result.accessToken);

  if (result.refreshToken) {
    storage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
  }

  if (result.expires) {
    storage.setItem(TOKEN_EXPIRES_KEY, result.expires);
  }
}

export function clearAuthSession() {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(REFRESH_TOKEN_KEY);
  storage.removeItem(TOKEN_EXPIRES_KEY);
  storage.removeItem(CURRENT_USER_KEY);
}
