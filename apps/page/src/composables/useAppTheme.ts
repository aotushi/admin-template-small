import { setThemeMode, usePreferences, type AppTheme } from "@/composables/preferences";

export type { AppTheme };

function setTheme(value: AppTheme) {
  setThemeMode(value);
}

export function useAppTheme() {
  const { headerTheme, isDark, sidebarTheme, theme, toggleTheme } = usePreferences();

  return {
    headerTheme,
    isDark,
    setTheme,
    sidebarTheme,
    theme,
    toggleTheme,
  };
}
