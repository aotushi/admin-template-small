import { computed, reactive, readonly } from "vue";

import {
  LEGACY_THEME_STORAGE_KEYS,
  PREFERENCES_STORAGE_KEYS,
} from "@/composables/preferenceStorage";

export {
  LEGACY_THEME_STORAGE_KEYS,
  PREFERENCES_STORAGE_KEYS,
  PREFERENCES_STORAGE_PREFIX,
} from "@/composables/preferenceStorage";

export type AppTheme = "dark" | "light";
export type LoginLayout = "center" | "left" | "right";
export type LoginLocale = "en-US" | "zh-CN";
export type ThemeMode = "auto" | AppTheme;

export type ThemePrimaryOption = {
  label: string;
  value: string;
};

export type ThemePreferences = {
  builtinType: "default";
  colorDestructive: string;
  colorPrimary: string;
  colorSuccess: string;
  colorWarning: string;
  fontSize: number;
  mode: ThemeMode;
  radius: string;
  semiDarkHeader: boolean;
  semiDarkSidebar: boolean;
  semiDarkSidebarSub: boolean;
};

export type AppPreferences = {
  authPageLayout: LoginLayout;
  locale: LoginLocale;
};

export type Preferences = {
  app: AppPreferences;
  theme: ThemePreferences;
};

type PreferenceUpdates = {
  app?: Partial<AppPreferences>;
  theme?: Partial<ThemePreferences>;
};

export const themePrimaryOptions = [
  {
    label: "Blue",
    value: "hsl(212 100% 45%)",
  },
  {
    label: "Violet",
    value: "hsl(262 83% 58%)",
  },
  {
    label: "Sky",
    value: "hsl(198 93% 48%)",
  },
  {
    label: "Emerald",
    value: "hsl(154 59% 45%)",
  },
  {
    label: "Rose",
    value: "hsl(346 77% 50%)",
  },
] as const satisfies readonly ThemePrimaryOption[];

export const defaultThemePrimary = themePrimaryOptions[0].value;

export const defaultPreferences: Preferences = {
  app: {
    authPageLayout: "right",
    locale: "zh-CN",
  },
  theme: {
    builtinType: "default",
    colorDestructive: "hsl(348 100% 61%)",
    colorPrimary: defaultThemePrimary,
    colorSuccess: "hsl(144 57% 58%)",
    colorWarning: "hsl(42 84% 61%)",
    fontSize: 16,
    mode: "light",
    radius: "0.5",
    semiDarkHeader: false,
    semiDarkSidebar: false,
    semiDarkSidebarSub: false,
  },
};

const preferences = reactive<Preferences>(loadPreferences());

const isDark = computed(() => resolveThemeMode(preferences.theme.mode) === "dark");
const theme = computed<AppTheme>(() => (isDark.value ? "dark" : "light"));
const sidebarTheme = computed<AppTheme>(() =>
  isDark.value || preferences.theme.semiDarkSidebar ? "dark" : "light",
);
const sidebarThemeSub = computed<AppTheme>(() =>
  isDark.value || preferences.theme.semiDarkSidebarSub ? "dark" : "light",
);
const headerTheme = computed<AppTheme>(() =>
  isDark.value || preferences.theme.semiDarkHeader ? "dark" : "light",
);

function clonePreferences(value: Preferences): Preferences {
  return {
    app: { ...value.app },
    theme: { ...value.theme },
  };
}

function createPreferences(updates: PreferenceUpdates = {}): Preferences {
  const app = {
    ...defaultPreferences.app,
    ...updates.app,
  };
  const themePreference = {
    ...defaultPreferences.theme,
    ...updates.theme,
  };

  return {
    app: {
      authPageLayout: isLoginLayout(app.authPageLayout)
        ? app.authPageLayout
        : defaultPreferences.app.authPageLayout,
      locale: isLoginLocale(app.locale) ? app.locale : defaultPreferences.app.locale,
    },
    theme: {
      builtinType: "default",
      colorDestructive: normalizeHslColor(
        themePreference.colorDestructive,
        defaultPreferences.theme.colorDestructive,
      ),
      colorPrimary: normalizeHslColor(themePreference.colorPrimary, defaultThemePrimary),
      colorSuccess: normalizeHslColor(
        themePreference.colorSuccess,
        defaultPreferences.theme.colorSuccess,
      ),
      colorWarning: normalizeHslColor(
        themePreference.colorWarning,
        defaultPreferences.theme.colorWarning,
      ),
      fontSize: normalizeFontSize(themePreference.fontSize),
      mode: isThemeMode(themePreference.mode)
        ? themePreference.mode
        : defaultPreferences.theme.mode,
      radius: normalizeRadius(themePreference.radius),
      semiDarkHeader: Boolean(themePreference.semiDarkHeader),
      semiDarkSidebar: Boolean(themePreference.semiDarkSidebar),
      semiDarkSidebarSub: Boolean(themePreference.semiDarkSidebarSub),
    },
  };
}

function loadPreferences() {
  const legacyPreferences = readLegacyPreferences();
  const cachedPreferences = readStorageValue<PreferenceUpdates>(PREFERENCES_STORAGE_KEYS.main);

  return createPreferences({
    app: {
      ...legacyPreferences.app,
      ...cachedPreferences?.app,
    },
    theme: {
      ...legacyPreferences.theme,
      ...cachedPreferences?.theme,
    },
  });
}

function readLegacyPreferences(): PreferenceUpdates {
  if (typeof window === "undefined") {
    return {};
  }

  const legacyTheme = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEYS.theme);
  const legacyLayout = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEYS.layout);
  const legacyLocale = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEYS.locale);
  const legacyPrimary = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEYS.primary);

  return {
    app: {
      ...(isLoginLayout(legacyLayout) ? { authPageLayout: legacyLayout } : {}),
      ...(isLoginLocale(legacyLocale) ? { locale: legacyLocale } : {}),
    },
    theme: {
      ...(isThemeMode(legacyTheme) ? { mode: legacyTheme } : {}),
      ...(legacyPrimary ? { colorPrimary: legacyPrimary } : {}),
    },
  };
}

function readStorageValue<T>(key: string): T | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isRecord(parsed) && "value" in parsed) {
      return parsed.value as T;
    }

    return parsed as T;
  } catch {
    return undefined;
  }
}

function writeStorageValue<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify({ value }));
}

function clearLegacyPreferences() {
  if (typeof window === "undefined") {
    return;
  }

  Object.values(LEGACY_THEME_STORAGE_KEYS).forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

function savePreferences() {
  writeStorageValue(PREFERENCES_STORAGE_KEYS.main, clonePreferences(preferences));
  writeStorageValue(PREFERENCES_STORAGE_KEYS.locale, preferences.app.locale);
  writeStorageValue(PREFERENCES_STORAGE_KEYS.theme, preferences.theme.mode);
  clearLegacyPreferences();
}

function applyPreferences() {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle("dark", isDark.value);
  root.dataset.theme = preferences.theme.builtinType;
  applyThemeVariables(preferences.theme);
}

function applyThemeVariables(themePreference: ThemePreferences) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const primary = hslToChannels(themePreference.colorPrimary);
  const success = hslToChannels(themePreference.colorSuccess);
  const warning = hslToChannels(themePreference.colorWarning);
  const destructive = hslToChannels(themePreference.colorDestructive);

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--success", success);
  root.style.setProperty("--warning", warning);
  root.style.setProperty("--destructive", destructive);
  root.style.setProperty("--radius", `${themePreference.radius}rem`);
  root.style.setProperty("--font-size-base", `${themePreference.fontSize}px`);
  root.style.setProperty("--menu-font-size", `calc(${themePreference.fontSize}px * 0.875)`);
  applyElementPlusPrimaryColor(primary);
}

export function applyPrimaryColorToRoot(value: string) {
  if (typeof document === "undefined") {
    return;
  }

  applyElementPlusPrimaryColor(hslToChannels(normalizeHslColor(value, defaultThemePrimary)));
}

function applyElementPlusPrimaryColor(primary: string) {
  const root = document.documentElement;

  root.style.setProperty("--primary", primary);
  root.style.setProperty("--el-color-primary", `hsl(${primary})`);
  root.style.setProperty("--el-color-primary-light-3", `hsl(${primary} / 78%)`);
  root.style.setProperty("--el-color-primary-light-5", `hsl(${primary} / 58%)`);
  root.style.setProperty("--el-color-primary-light-7", `hsl(${primary} / 34%)`);
  root.style.setProperty("--el-color-primary-light-8", `hsl(${primary} / 24%)`);
  root.style.setProperty("--el-color-primary-light-9", `hsl(${primary} / 12%)`);
  root.style.setProperty("--el-color-primary-dark-2", `hsl(${primary} / 86%)`);
}

export function hslToChannels(value: string) {
  const trimmed = value.trim();
  const match = /^hsl\((.*)\)$/i.exec(trimmed);
  return (match?.[1] ?? trimmed).trim();
}

function normalizeHslColor(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const channels = hslToChannels(value);
  if (!channels) {
    return fallback;
  }

  return `hsl(${channels})`;
}

function normalizeFontSize(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 12 && value <= 22
    ? value
    : defaultPreferences.theme.fontSize;
}

function normalizeRadius(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : defaultPreferences.theme.radius;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLoginLayout(value: unknown): value is LoginLayout {
  return value === "center" || value === "left" || value === "right";
}

function isLoginLocale(value: unknown): value is LoginLocale {
  return value === "en-US" || value === "zh-CN";
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "auto" || value === "dark" || value === "light";
}

function resolveThemeMode(mode: ThemeMode): AppTheme {
  if (mode !== "auto") {
    return mode;
  }

  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getPreferencesSnapshot() {
  return clonePreferences(preferences);
}

export function setAuthPageLayout(value: LoginLayout) {
  updatePreferences({ app: { authPageLayout: value } });
}

export function setLocale(value: LoginLocale) {
  updatePreferences({ app: { locale: value } });
}

export function setPrimaryColor(value: string) {
  updatePreferences({ theme: { colorPrimary: value } });
}

export function setThemeMode(value: ThemeMode) {
  updatePreferences({ theme: { mode: value } });
}

export function toggleTheme() {
  setThemeMode(theme.value === "dark" ? "light" : "dark");
}

export function updatePreferences(updates: PreferenceUpdates) {
  const nextPreferences = createPreferences({
    app: {
      ...preferences.app,
      ...updates.app,
    },
    theme: {
      ...preferences.theme,
      ...updates.theme,
    },
  });

  Object.assign(preferences.app, nextPreferences.app);
  Object.assign(preferences.theme, nextPreferences.theme);

  applyPreferences();
  savePreferences();
}

applyPreferences();
savePreferences();

export function usePreferences() {
  return {
    appPreferences: readonly(preferences.app),
    getPreferencesSnapshot,
    headerTheme,
    isDark,
    preferences: readonly(preferences),
    setAuthPageLayout,
    setLocale,
    setPrimaryColor,
    setThemeMode,
    sidebarTheme,
    sidebarThemeSub,
    theme,
    toggleTheme,
    updatePreferences,
  };
}
