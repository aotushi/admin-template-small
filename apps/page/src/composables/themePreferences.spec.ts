import { beforeEach, describe, expect, it, vi } from "vitest";

describe("theme preferences", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    document.documentElement.removeAttribute("style");
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
  });

  it("initializes one preferences record and applies Vben-style document theme markers", async () => {
    const { PREFERENCES_STORAGE_KEYS, defaultThemePrimary, hslToChannels } =
      await import("@/composables/preferences");

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.dataset.theme).toBe("default");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(
      hslToChannels(defaultThemePrimary),
    );
    expect(JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEYS.theme) ?? "{}")).toEqual(
      { value: "light" },
    );
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEYS.main)).toContain("colorPrimary");
  });

  it("persists the selected primary color through the unified preferences record", async () => {
    const { PREFERENCES_STORAGE_KEYS, setPrimaryColor } = await import("@/composables/preferences");

    setPrimaryColor("hsl(154 59% 45%)");

    const stored = JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEYS.main) ?? "{}");
    expect(stored.value.theme.colorPrimary).toBe("hsl(154 59% 45%)");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("154 59% 45%");
    expect(document.documentElement.style.getPropertyValue("--el-color-primary")).toBe(
      "hsl(154 59% 45%)",
    );
    expect(document.documentElement.style.getPropertyValue("--el-color-primary-light-9")).toBe(
      "hsl(154 59% 45% / 12%)",
    );
  });

  it("uses the dark class and default builtin theme marker when switching to dark mode", async () => {
    const { PREFERENCES_STORAGE_KEYS, setThemeMode } = await import("@/composables/preferences");

    setThemeMode("dark");

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("default");
    expect(JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEYS.theme) ?? "{}")).toEqual(
      { value: "dark" },
    );
  });

  it("migrates old login theme keys once and removes them from local storage", async () => {
    window.localStorage.setItem("admin-backend-3-page-login-theme", "dark");
    window.localStorage.setItem("admin-backend-3-page-login-primary", "154 59% 45%");
    window.localStorage.setItem("admin-backend-3-page-login-layout", "left");
    window.localStorage.setItem("admin-backend-3-page-login-locale", "en-US");

    const { PREFERENCES_STORAGE_KEYS, getPreferencesSnapshot } =
      await import("@/composables/preferences");
    const snapshot = getPreferencesSnapshot();

    expect(snapshot.app.authPageLayout).toBe("left");
    expect(snapshot.app.locale).toBe("en-US");
    expect(snapshot.theme.colorPrimary).toBe("hsl(154 59% 45%)");
    expect(snapshot.theme.mode).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem("admin-backend-3-page-login-theme")).toBeNull();
    expect(window.localStorage.getItem("admin-backend-3-page-login-primary")).toBeNull();
    expect(window.localStorage.getItem(PREFERENCES_STORAGE_KEYS.main)).toContain("authPageLayout");
  });
});
