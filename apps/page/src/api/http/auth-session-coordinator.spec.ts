import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_ERROR_CODES,
  isTerminalAuthErrorCode,
} from "@admin-backend-3/admin-api-contract/auth";

import type { AuthTabChannel, AuthTabChannelEvent } from "@/api/http/auth-tab-channel";
import { createNoopAuthTabChannel } from "@/api/http/auth-tab-channel";
import { AuthSessionCoordinator } from "@/api/http/auth-session-coordinator";
import type { AuthErrorClassifier } from "@/api/http/types";
import {
  authSessionStore,
  clearAuthSession,
  getAccessToken,
  getAuthSessionSnapshot,
  saveAuthSession,
} from "@/api/session";
import type { AuthSessionResult } from "@/api/types";

const errorClassifier: AuthErrorClassifier = {
  isAccessTokenExpired(status, code) {
    return status === 401 && code === AUTH_ERROR_CODES.accessTokenExpired;
  },
  isTerminalAuthError(code) {
    return isTerminalAuthErrorCode(code);
  },
};

function makeSession(accessToken: string, expiresInMs = 15 * 60_000): AuthSessionResult {
  const now = Date.now();
  return {
    accessToken,
    expires: new Date(now + expiresInMs).toISOString(),
    sessionExpires: new Date(now + 30 * 24 * 60 * 60_000).toISOString(),
    tokenType: "Bearer",
    user: {
      id: 1,
      roles: ["admin"],
      username: "vben",
    },
  };
}

function createCoordinator(
  requestRefresh: () => Promise<AuthSessionResult>,
  tabChannel: AuthTabChannel<AuthSessionResult> = createNoopAuthTabChannel(),
) {
  return new AuthSessionCoordinator<AuthSessionResult>({
    tabChannel,
    errorClassifier,
    requestRefresh,
    sessionStore: authSessionStore,
  });
}

function createSharedExclusiveRunner() {
  let tail = Promise.resolve();

  return async function runExclusive<T>(task: () => Promise<T>) {
    const previous = tail;
    let release: () => void = () => undefined;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  };
}

function createSharedTabChannel(
  runExclusive: ReturnType<typeof createSharedExclusiveRunner>,
): AuthTabChannel<AuthSessionResult> {
  return {
    dispose() {},
    publish() {},
    requestPeerSession() {
      return Promise.resolve(null);
    },
    runExclusive,
    subscribe() {
      return () => undefined;
    },
  };
}

describe("AuthSessionCoordinator", () => {
  beforeEach(() => {
    clearAuthSession();
  });

  it("performs one refresh when two coordinated contexts refresh together", async () => {
    saveAuthSession(makeSession("old-access-token"));
    const runExclusive = createSharedExclusiveRunner();
    const requestRefresh = vi.fn(async () => makeSession("new-access-token"));
    const first = createCoordinator(requestRefresh, createSharedTabChannel(runExclusive));
    const second = createCoordinator(requestRefresh, createSharedTabChannel(runExclusive));

    const results = await Promise.all([first.refresh("reactive"), second.refresh("reactive")]);

    expect(requestRefresh).toHaveBeenCalledTimes(1);
    expect(results.map((result) => result.accessToken)).toEqual([
      "new-access-token",
      "new-access-token",
    ]);
    first.dispose();
    second.dispose();
  });

  it("uses a newer peer session instead of rotating the refresh cookie again", async () => {
    saveAuthSession(makeSession("old-access-token"));
    const requestRefresh = vi.fn(async () => makeSession("unexpected-access-token"));
    const peerSession = makeSession("peer-access-token");
    const tabChannel: AuthTabChannel<AuthSessionResult> = {
      ...createNoopAuthTabChannel<AuthSessionResult>(),
      requestPeerSession: vi.fn(async () => peerSession),
    };
    const coordinator = createCoordinator(requestRefresh, tabChannel);

    await expect(coordinator.refresh("reactive")).resolves.toEqual(peerSession);

    expect(requestRefresh).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe("peer-access-token");
    coordinator.dispose();
  });

  it("skips a peer session that is about to expire and refreshes instead", async () => {
    saveAuthSession(makeSession("old-access-token"));
    const requestRefresh = vi.fn(async () => makeSession("fresh-access-token"));
    // peer token 剩余 10 秒，低于 30 秒新鲜度门槛，采纳后会立刻再触发刷新。
    const stalePeerSession = makeSession("stale-peer-access-token", 10_000);
    const tabChannel: AuthTabChannel<AuthSessionResult> = {
      ...createNoopAuthTabChannel<AuthSessionResult>(),
      requestPeerSession: vi.fn(async () => stalePeerSession),
    };
    const coordinator = createCoordinator(requestRefresh, tabChannel);

    await expect(coordinator.refresh("reactive")).resolves.toMatchObject({
      accessToken: "fresh-access-token",
    });

    expect(requestRefresh).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBe("fresh-access-token");
    coordinator.dispose();
  });

  it("applies same-millisecond events from different publishers in arrival order", () => {
    let deliver!: (event: AuthTabChannelEvent<AuthSessionResult>) => void;
    const tabChannel: AuthTabChannel<AuthSessionResult> = {
      ...createNoopAuthTabChannel<AuthSessionResult>(),
      subscribe(listener) {
        deliver = listener;
        return () => undefined;
      },
    };
    const coordinator = createCoordinator(async () => makeSession("unused"), tabChannel);
    const sentAt = Date.now();

    deliver({
      sentAt,
      session: makeSession("from-tab-a"),
      sourceId: "tab-a",
      type: "session-updated",
    });
    expect(getAccessToken()).toBe("from-tab-a");

    // 同毫秒但不同发布方：不是重复事件，必须继续应用。
    deliver({
      sentAt,
      session: makeSession("from-tab-b"),
      sourceId: "tab-b",
      type: "session-updated",
    });
    expect(getAccessToken()).toBe("from-tab-b");

    // 同毫秒同发布方：视为重复投递，丢弃。
    deliver({
      sentAt,
      session: makeSession("duplicate"),
      sourceId: "tab-b",
      type: "session-updated",
    });
    expect(getAccessToken()).toBe("from-tab-b");
    coordinator.dispose();
  });

  it("ignores an in-flight refresh result when logout has already started", async () => {
    saveAuthSession(makeSession("old-access-token"));
    let resolveRefresh!: (session: AuthSessionResult) => void;
    let markRefreshStarted!: () => void;
    const refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve;
    });
    const coordinator = createCoordinator(
      () =>
        new Promise<AuthSessionResult>((resolve) => {
          resolveRefresh = resolve;
          markRefreshStarted();
        }),
    );
    const requestLogout = vi.fn(async () => undefined);

    const refresh = coordinator.refresh("reactive");
    await refreshStarted;
    const logout = coordinator.logout(requestLogout);
    resolveRefresh(makeSession("stale-refresh-result"));

    await expect(refresh).rejects.toMatchObject({ kind: "cancel" });
    await logout;

    expect(requestLogout).toHaveBeenCalledTimes(1);
    expect(getAuthSessionSnapshot().currentUser).toBeNull();
    expect(getAccessToken()).toBeNull();
    coordinator.dispose();
  });

  it("keeps a newer login transition locked when an older login finishes", async () => {
    let resolveFirst!: (session: AuthSessionResult) => void;
    let resolveSecond!: (session: AuthSessionResult) => void;
    let markFirstStarted!: () => void;
    let markSecondStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const secondStarted = new Promise<void>((resolve) => {
      markSecondStarted = resolve;
    });
    const coordinator = createCoordinator(async () => makeSession("unused-refresh-token"));

    const firstLogin = coordinator.login(
      () =>
        new Promise<AuthSessionResult>((resolve) => {
          resolveFirst = resolve;
          markFirstStarted();
        }),
    );
    await firstStarted;
    const secondLogin = coordinator.login(
      () =>
        new Promise<AuthSessionResult>((resolve) => {
          resolveSecond = resolve;
          markSecondStarted();
        }),
    );
    await secondStarted;

    resolveFirst(makeSession("first-account-token"));
    await expect(firstLogin).rejects.toMatchObject({ kind: "cancel" });
    expect(coordinator.canRefresh()).toBe(false);

    resolveSecond(makeSession("second-account-token"));
    await expect(secondLogin).resolves.toMatchObject({ accessToken: "second-account-token" });
    expect(coordinator.canRefresh()).toBe(true);
    expect(getAccessToken()).toBe("second-account-token");
    coordinator.dispose();
  });
});
