export const PREFERENCES_STORAGE_PREFIX = "admin-backend-3-page";

export const PREFERENCES_STORAGE_KEYS = {
  locale: `${PREFERENCES_STORAGE_PREFIX}-preferences-locale`,
  main: `${PREFERENCES_STORAGE_PREFIX}-preferences`,
  theme: `${PREFERENCES_STORAGE_PREFIX}-preferences-theme`,
} as const;

export const LEGACY_THEME_STORAGE_KEYS = {
  layout: "admin-backend-3-page-login-layout",
  locale: "admin-backend-3-page-login-locale",
  primary: "admin-backend-3-page-login-primary",
  theme: "admin-backend-3-page-login-theme",
} as const;
