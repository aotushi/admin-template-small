import type { AuthSessionStore } from "@/api/http/types";
import type { AuthSessionResult, CurrentUser, LoginResult, TokenRefreshResult } from "@/api/types";
import { PREFERENCES_STORAGE_KEYS } from "@/composables/preferenceStorage";

const LEGACY_AUTH_STORAGE_KEYS = [
  "admin-backend-3-token",
  "admin-backend-3-refresh-token",
  "admin-backend-3-token-expires",
  "admin-backend-3-current-user",
] as const;

export interface AuthSessionSnapshot {
  accessToken: null | string;
  currentUser: CurrentUser | null;
  expires: null | string;
  sessionExpires: null | string;
}

type AuthSessionListener = (session: Readonly<AuthSessionSnapshot>) => void;

let session: AuthSessionSnapshot = {
  accessToken: null,
  currentUser: null,
  expires: null,
  sessionExpires: null,
};
const listeners = new Set<AuthSessionListener>();
let sessionRevision = 0;

function getStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function removeLegacyAuthStorage() {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  for (const key of LEGACY_AUTH_STORAGE_KEYS) {
    storage.removeItem(key);
  }
}

function notifySessionListeners() {
  for (const listener of listeners) {
    listener(session);
  }
}

removeLegacyAuthStorage();

export function getAccessToken() {
  return session.accessToken;
}

export function getAuthSessionRevision() {
  return sessionRevision;
}

export function getAuthSessionSnapshot(): Readonly<AuthSessionSnapshot> {
  return session;
}

export function getPreferredLocale() {
  const storage = getStorage();
  const rawLocale = storage?.getItem(PREFERENCES_STORAGE_KEYS.locale);

  if (rawLocale) {
    try {
      const parsed = JSON.parse(rawLocale) as { value?: unknown };
      if (typeof parsed.value === "string") {
        return parsed.value;
      }
    } catch {
      return rawLocale;
    }
  }

  return typeof navigator === "undefined" ? "zh-CN" : navigator.language || "zh-CN";
}

export function getAuthSessionResult(): AuthSessionResult | null {
  if (!session.accessToken || !session.currentUser || !session.expires || !session.sessionExpires) {
    return null;
  }

  return {
    accessToken: session.accessToken,
    expires: session.expires,
    sessionExpires: session.sessionExpires,
    tokenType: "Bearer",
    user: session.currentUser,
  };
}

export function getAccessTokenRemainingMs(now = Date.now()) {
  const expiresAt = session.expires ? Date.parse(session.expires) : Number.NaN;
  return Number.isFinite(expiresAt) ? expiresAt - now : Number.NEGATIVE_INFINITY;
}

export function saveAuthSession(result: LoginResult | TokenRefreshResult) {
  sessionRevision += 1;
  session = {
    accessToken: result.accessToken,
    currentUser: result.user,
    expires: result.expires,
    sessionExpires: result.sessionExpires,
  };
  removeLegacyAuthStorage();
  notifySessionListeners();
}

export function clearAuthSession() {
  sessionRevision += 1;
  session = {
    accessToken: null,
    currentUser: null,
    expires: null,
    sessionExpires: null,
  };
  removeLegacyAuthStorage();
  notifySessionListeners();
}

export function subscribeAuthSession(listener: AuthSessionListener) {
  listeners.add(listener);
  listener(session);

  return () => listeners.delete(listener);
}

/** 供 http 套件注入的会话存储适配器：套件只依赖这份契约，不感知内存实现。 */
export const authSessionStore: AuthSessionStore<AuthSessionResult> = {
  clear: clearAuthSession,
  getAccessToken,
  getAccessTokenRemainingMs,
  getRevision: getAuthSessionRevision,
  getSession: getAuthSessionResult,
  save: saveAuthSession,
};
