import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBrowserAuthCoordination } from "@/api/http/auth-coordination";
import type { AuthSession } from "@/api/http/types";

function makeSession(accessToken: string): AuthSession {
  const now = Date.now();
  return {
    accessToken,
    expires: new Date(now + 15 * 60_000).toISOString(),
    sessionExpires: new Date(now + 30 * 24 * 60 * 60_000).toISOString(),
  };
}

// 模拟 BroadcastChannel：同名频道互相投递，不回投给发送方自己。
const channelRegistry = new Map<string, Set<FakeBroadcastChannel>>();

class FakeBroadcastChannel {
  private readonly listeners = new Set<(event: MessageEvent) => void>();

  constructor(private readonly name: string) {
    let peers = channelRegistry.get(name);
    if (!peers) {
      peers = new Set();
      channelRegistry.set(name, peers);
    }
    peers.add(this);
  }

  addEventListener(_type: "message", listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }

  close() {
    channelRegistry.get(this.name)?.delete(this);
    this.listeners.clear();
  }

  postMessage(data: unknown) {
    for (const peer of channelRegistry.get(this.name) ?? []) {
      if (peer === this) {
        continue;
      }
      for (const listener of peer.listeners) {
        listener({ data } as MessageEvent);
      }
    }
  }
}

describe("createBrowserAuthCoordination", () => {
  beforeEach(() => {
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    channelRegistry.clear();
    vi.useRealTimers();
  });

  it("resolves immediately without waiting when no peer tab is known", async () => {
    const solo = createBrowserAuthCoordination(() => null, { channelName: "solo" });

    vi.useFakeTimers();
    // 不推进任何计时器也能拿到结果，说明单标签页没有固定等待。
    await expect(solo.requestPeerSession()).resolves.toBeNull();
    solo.dispose();
  });

  it("shares the session from an existing tab discovered via the hello handshake", async () => {
    const older = createBrowserAuthCoordination(() => makeSession("older-tab-token"), {
      channelName: "share",
    });
    const newer = createBrowserAuthCoordination(() => null, { channelName: "share" });

    await expect(newer.requestPeerSession()).resolves.toMatchObject({
      accessToken: "older-tab-token",
    });

    older.dispose();
    newer.dispose();
  });

  it("falls back to null after the timeout when peers have no session", async () => {
    const first = createBrowserAuthCoordination(() => null, { channelName: "empty" });
    const second = createBrowserAuthCoordination(() => null, { channelName: "empty" });

    vi.useFakeTimers();
    const pending = second.requestPeerSession();
    await vi.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toBeNull();

    first.dispose();
    second.dispose();
  });

  it("forgets a disposed peer and stops waiting for it", async () => {
    const leaving = createBrowserAuthCoordination(() => makeSession("leaving-token"), {
      channelName: "bye",
    });
    const staying = createBrowserAuthCoordination(() => null, { channelName: "bye" });

    leaving.dispose();

    vi.useFakeTimers();
    await expect(staying.requestPeerSession()).resolves.toBeNull();
    staying.dispose();
  });

  it("delivers published events to other tabs but not back to the publisher", () => {
    const publisher = createBrowserAuthCoordination(() => null, { channelName: "events" });
    const subscriberTab = createBrowserAuthCoordination(() => null, { channelName: "events" });
    const publisherListener = vi.fn();
    const subscriberListener = vi.fn();
    publisher.subscribe(publisherListener);
    subscriberTab.subscribe(subscriberListener);

    publisher.publish({
      sentAt: Date.now(),
      session: makeSession("published-token"),
      sourceId: "publisher",
      type: "session-updated",
    });

    expect(subscriberListener).toHaveBeenCalledTimes(1);
    expect(subscriberListener.mock.calls[0]?.[0]).toMatchObject({
      session: { accessToken: "published-token" },
      type: "session-updated",
    });
    expect(publisherListener).not.toHaveBeenCalled();

    publisher.dispose();
    subscriberTab.dispose();
  });
});
