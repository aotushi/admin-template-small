import {
  applyPrimaryColorToRoot,
  defaultThemePrimary,
  getPreferencesSnapshot,
  PREFERENCES_STORAGE_KEYS,
  PREFERENCES_STORAGE_PREFIX,
  setPrimaryColor,
  themePrimaryOptions,
  type ThemePrimaryOption,
} from "@/composables/preferences";

export type { ThemePrimaryOption };
export { defaultThemePrimary, themePrimaryOptions };

export const THEME_STORAGE_PREFIX = PREFERENCES_STORAGE_PREFIX;
export const THEME_STORAGE_KEYS = PREFERENCES_STORAGE_KEYS;

export function readStoredPrimaryColor() {
  return getPreferencesSnapshot().theme.colorPrimary;
}

export function applyPrimaryColor(value: string) {
  applyPrimaryColorToRoot(value);
}

export function persistPrimaryColor(value: string) {
  setPrimaryColor(value);
}
