const RELOAD_STORAGE_KEY = "admin-backend-3-release-reload-at";
const DEFAULT_RELOAD_COOLDOWN_MS = 10_000;

type ReleaseRecoveryOptions = {
  now?: () => number;
  reload?: () => void;
  reloadCooldownMs?: number;
  reportError?: (message: string, error: unknown) => void;
  storage?: Pick<Storage, "getItem" | "setItem">;
};

export function setupReleaseRecovery(options: ReleaseRecoveryOptions = {}) {
  const now = options.now ?? Date.now;
  const reload = options.reload ?? (() => window.location.reload());
  const reloadCooldownMs = options.reloadCooldownMs ?? DEFAULT_RELOAD_COOLDOWN_MS;
  const reportError = options.reportError ?? console.error;
  const storage = options.storage ?? window.sessionStorage;

  const handlePreloadError = (event: VitePreloadErrorEvent) => {
    event.preventDefault();

    const lastReloadAt = Number(storage.getItem(RELOAD_STORAGE_KEY) ?? 0);
    if (now() - lastReloadAt < reloadCooldownMs) {
      reportError("页面资源加载失败，自动刷新后仍未恢复", event.payload);
      return;
    }

    storage.setItem(RELOAD_STORAGE_KEY, String(now()));
    reload();
  };

  window.addEventListener("vite:preloadError", handlePreloadError);

  return () => {
    window.removeEventListener("vite:preloadError", handlePreloadError);
  };
}
