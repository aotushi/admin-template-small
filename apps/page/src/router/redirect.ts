import type { LocationQueryValue } from "vue-router";

const DEFAULT_POST_LOGIN_REDIRECT = "/dashboard";
const LOGIN_PATH_PREFIX = "/login";

export function resolvePostLoginRedirect(
  redirect: LocationQueryValue | LocationQueryValue[] | undefined,
  fallback = DEFAULT_POST_LOGIN_REDIRECT,
) {
  const target = Array.isArray(redirect) ? redirect[0] : redirect;

  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return fallback;
  }

  if (target === LOGIN_PATH_PREFIX || target.startsWith(`${LOGIN_PATH_PREFIX}?`)) {
    return fallback;
  }

  if (target.startsWith(`${LOGIN_PATH_PREFIX}/`)) {
    return fallback;
  }

  return target;
}
