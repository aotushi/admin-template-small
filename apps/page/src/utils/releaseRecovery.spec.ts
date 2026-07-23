import { afterEach, describe, expect, it, vi } from "vitest";

import { setupReleaseRecovery } from "@/utils/releaseRecovery";

const cleanupCallbacks: Array<() => void> = [];

function dispatchPreloadError(payload: unknown) {
  const event = Object.assign(new Event("vite:preloadError", { cancelable: true }), {
    payload,
  });

  window.dispatchEvent(event);
  return event;
}

afterEach(() => {
  cleanupCallbacks.splice(0).forEach((cleanup) => cleanup());
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("release recovery", () => {
  it("prevents the preload error and reloads the page once", () => {
    const reload = vi.fn();
    cleanupCallbacks.push(setupReleaseRecovery({ now: () => 20_000, reload }));

    const event = dispatchPreloadError(
      new TypeError("Failed to fetch dynamically imported module"),
    );

    expect(event.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not enter a reload loop when the refreshed page fails again", () => {
    const reload = vi.fn();
    const reportError = vi.fn();
    cleanupCallbacks.push(
      setupReleaseRecovery({
        now: () => 20_000,
        reload,
        reportError,
      }),
    );

    dispatchPreloadError(new TypeError("first failure"));
    dispatchPreloadError(new TypeError("second failure"));

    expect(reload).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledOnce();
  });

  it("allows another recovery attempt after the cooldown", () => {
    let currentTime = 20_000;
    const reload = vi.fn();
    cleanupCallbacks.push(
      setupReleaseRecovery({
        now: () => currentTime,
        reload,
      }),
    );

    dispatchPreloadError(new TypeError("first failure"));
    currentTime += 10_001;
    dispatchPreloadError(new TypeError("later failure"));

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("stops handling errors after cleanup", () => {
    const reload = vi.fn();
    const cleanup = setupReleaseRecovery({ now: () => 20_000, reload });

    cleanup();
    dispatchPreloadError(new TypeError("failure"));

    expect(reload).not.toHaveBeenCalled();
  });
});
