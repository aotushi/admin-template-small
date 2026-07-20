import type { AuthSession } from "@/api/http/types";

const DEFAULT_CHANNEL_NAME = "auth-session-coordination";
const DEFAULT_LOCK_NAME = "auth-session-lock";
const DEFAULT_PEER_RESPONSE_TIMEOUT_MS = 100;

export type AuthTabChannelEvent<S extends AuthSession = AuthSession> =
  | {
      sentAt: number;
      session: S;
      sourceId: string;
      type: "session-updated";
    }
  | {
      sentAt: number;
      sourceId: string;
      type: "session-ended";
    };

type AuthTabChannelListener<S extends AuthSession> = (event: AuthTabChannelEvent<S>) => void;

type AuthTabChannelWireMessage<S extends AuthSession> =
  | {
      event: AuthTabChannelEvent<S>;
      kind: "event";
      sourceId: string;
    }
  | {
      kind: "hello";
      sourceId: string;
    }
  | {
      kind: "present";
      sourceId: string;
    }
  | {
      kind: "session-request";
      requestId: string;
      sourceId: string;
    }
  | {
      kind: "session-response";
      requestId: string;
      session: S;
      sourceId: string;
      targetId: string;
    }
  | {
      kind: "bye";
      sourceId: string;
    };

export interface AuthTabChannel<S extends AuthSession = AuthSession> {
  dispose(): void;
  publish(event: AuthTabChannelEvent<S>): void;
  requestPeerSession(): Promise<null | S>;
  runExclusive<T>(task: () => Promise<T>): Promise<T>;
  subscribe(listener: AuthTabChannelListener<S>): () => void;
}

export interface BrowserAuthTabChannelOptions {
  channelName?: string;
  lockName?: string;
  /** 已知存在 peer 标签页时，等待对方回传会话的上限。 */
  peerResponseTimeoutMs?: number;
}

export function createNoopAuthTabChannel<S extends AuthSession = AuthSession>(): AuthTabChannel<S> {
  return {
    dispose() {},
    publish() {},
    requestPeerSession() {
      return Promise.resolve(null);
    },
    runExclusive<T>(task: () => Promise<T>) {
      return task();
    },
    subscribe() {
      return () => undefined;
    },
  };
}

let warnedMissingWebLocks = false;

export function createBrowserAuthTabChannel<S extends AuthSession = AuthSession>(
  readSession: () => null | S,
  options: BrowserAuthTabChannelOptions = {},
): AuthTabChannel<S> {
  const channelName = options.channelName ?? DEFAULT_CHANNEL_NAME;
  const lockName = options.lockName ?? DEFAULT_LOCK_NAME;
  const peerResponseTimeoutMs = options.peerResponseTimeoutMs ?? DEFAULT_PEER_RESPONSE_TIMEOUT_MS;

  const sourceId = crypto.randomUUID();
  const listeners = new Set<AuthTabChannelListener<S>>();
  // 已知存活的 peer 标签页；为空时跳过会话索取，省掉冷启动的等待。
  const knownPeers = new Set<string>();
  const pendingSessionRequests = new Map<
    string,
    {
      resolve: (session: null | S) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  >();
  const channel =
    typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(channelName);

  function post(message: AuthTabChannelWireMessage<S>) {
    channel?.postMessage(message);
  }

  channel?.addEventListener("message", (message: MessageEvent<AuthTabChannelWireMessage<S>>) => {
    const wireMessage = message.data;
    if (!wireMessage || wireMessage.sourceId === sourceId) {
      return;
    }

    if (wireMessage.kind === "bye") {
      knownPeers.delete(wireMessage.sourceId);
      return;
    }

    // 任何其它消息都证明发送方存活。
    knownPeers.add(wireMessage.sourceId);

    if (wireMessage.kind === "hello") {
      post({ kind: "present", sourceId });
      return;
    }

    if (wireMessage.kind === "present") {
      return;
    }

    if (wireMessage.kind === "event") {
      for (const listener of listeners) {
        listener(wireMessage.event);
      }
      return;
    }

    if (wireMessage.kind === "session-request") {
      const session = readSession();
      if (session) {
        post({
          kind: "session-response",
          requestId: wireMessage.requestId,
          session,
          sourceId,
          targetId: wireMessage.sourceId,
        });
      }
      return;
    }

    if (wireMessage.targetId !== sourceId) {
      return;
    }

    const pendingRequest = pendingSessionRequests.get(wireMessage.requestId);
    if (pendingRequest) {
      clearTimeout(pendingRequest.timeoutId);
      pendingSessionRequests.delete(wireMessage.requestId);
      pendingRequest.resolve(wireMessage.session);
    }
  });

  // 启动即握手：已存在的标签页会回应 present，之后才需要等待 peer 会话。
  post({ kind: "hello", sourceId });

  const onPageHide = () => post({ kind: "bye", sourceId });
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", onPageHide);
  }

  return {
    dispose() {
      if (typeof window !== "undefined") {
        window.removeEventListener("pagehide", onPageHide);
      }
      post({ kind: "bye", sourceId });
      listeners.clear();
      knownPeers.clear();
      for (const pendingRequest of pendingSessionRequests.values()) {
        clearTimeout(pendingRequest.timeoutId);
        pendingRequest.resolve(null);
      }
      pendingSessionRequests.clear();
      channel?.close();
    },
    publish(event) {
      post({ event, kind: "event", sourceId });
    },
    requestPeerSession() {
      // 没有已知 peer 时立即返回，避免单标签页冷启动固定等待超时。
      // presence 记录可能残留（标签页崩溃没发 bye），此时靠超时兜底。
      if (!channel || knownPeers.size === 0) {
        return Promise.resolve(null);
      }

      const requestId = crypto.randomUUID();
      return new Promise<null | S>((resolve) => {
        const timeoutId = setTimeout(() => {
          pendingSessionRequests.delete(requestId);
          resolve(null);
        }, peerResponseTimeoutMs);
        pendingSessionRequests.set(requestId, { resolve, timeoutId });
        post({ kind: "session-request", requestId, sourceId });
      });
    },
    async runExclusive<T>(task: () => Promise<T>) {
      if (typeof navigator === "undefined" || !navigator.locks) {
        // 没有 Web Locks 时退化为无跨标签页互斥：并发刷新可能触发
        // 服务端重放检测。服务端轮换宽限期是这里的最后一道兜底。
        if (!warnedMissingWebLocks) {
          warnedMissingWebLocks = true;
          console.warn("[auth-tab-channel] Web Locks 不可用，跨标签页刷新失去互斥保护");
        }
        return task();
      }

      return navigator.locks.request(lockName, { mode: "exclusive" }, task);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
