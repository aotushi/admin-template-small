import type { AuthTabChannel, AuthTabChannelEvent } from "@/api/http/auth-tab-channel";
import { ApiError, normalizeAxiosError } from "@/api/http/errors";
import type { AuthErrorClassifier, AuthSession, AuthSessionStore } from "@/api/http/types";

export type AuthRefreshReason = "proactive" | "reactive" | "restore";
type AuthTransition = "idle" | "login" | "logout";
interface AuthTransitionContext {
  lifecycle: number;
  transitionId: number;
}

export interface AuthSessionCoordinatorOptions<S extends AuthSession> {
  tabChannel: AuthTabChannel<S>;
  errorClassifier: AuthErrorClassifier;
  /** peer 会话至少还要“新鲜”多少毫秒才被采纳，避免拿到临过期 token 立刻再刷一轮。 */
  peerSessionMinRemainingMs?: number;
  requestRefresh: () => Promise<S>;
  sessionStore: AuthSessionStore<S>;
}

const DEFAULT_PEER_SESSION_MIN_REMAINING_MS = 30_000;

function transitionError() {
  return new ApiError("登录状态正在切换，请稍后重试", { kind: "cancel" });
}

export class AuthSessionCoordinator<S extends AuthSession = AuthSession> {
  private readonly tabChannel: AuthTabChannel<S>;
  private readonly errorClassifier: AuthErrorClassifier;
  /** 事件发布方标识：同毫秒的跨标签页事件靠它区分，避免误当重复丢弃。 */
  private readonly instanceId = crypto.randomUUID();
  private lastEventAt = 0;
  private lastEventSourceId = "";
  private lifecycle = 0;
  private readonly peerSessionMinRemainingMs: number;
  private refreshPromise: null | Promise<S> = null;
  private readonly requestRefresh: () => Promise<S>;
  private readonly store: AuthSessionStore<S>;
  private transition: AuthTransition = "idle";
  private transitionId = 0;
  private readonly unsubscribe: () => void;

  constructor(options: AuthSessionCoordinatorOptions<S>) {
    this.tabChannel = options.tabChannel;
    this.errorClassifier = options.errorClassifier;
    this.peerSessionMinRemainingMs =
      options.peerSessionMinRemainingMs ?? DEFAULT_PEER_SESSION_MIN_REMAINING_MS;
    this.requestRefresh = options.requestRefresh;
    this.store = options.sessionStore;
    this.unsubscribe = this.tabChannel.subscribe((event) => this.handleTabChannelEvent(event));
  }

  canRefresh() {
    return this.transition === "idle";
  }

  dispose() {
    this.unsubscribe();
    this.tabChannel.dispose();
  }

  refresh(_reason: AuthRefreshReason): Promise<S> {
    if (!this.canRefresh()) {
      return Promise.reject(transitionError());
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const lifecycle = this.lifecycle;
    const initialAccessToken = this.store.getAccessToken();
    const initialRevision = this.store.getRevision();

    this.refreshPromise = this.tabChannel
      .runExclusive(async () => {
        if (lifecycle !== this.lifecycle || !this.canRefresh()) {
          throw transitionError();
        }

        // 等锁期间其它上下文可能已经完成刷新并同步了会话。
        const coordinatedSession = this.store.getSession();
        const sessionChanged = this.store.getRevision() !== initialRevision;
        if (
          coordinatedSession &&
          sessionChanged &&
          coordinatedSession.accessToken !== initialAccessToken
        ) {
          return coordinatedSession;
        }

        const peerSession = await this.tabChannel.requestPeerSession();
        if (lifecycle !== this.lifecycle || !this.canRefresh()) {
          throw transitionError();
        }

        if (
          this.isUsablePeerSession(peerSession) &&
          peerSession.accessToken !== initialAccessToken
        ) {
          this.store.save(peerSession);
          return peerSession;
        }

        try {
          const result = await this.requestRefresh();

          if (lifecycle !== this.lifecycle || !this.canRefresh()) {
            throw transitionError();
          }

          this.acceptSession(result);
          return result;
        } catch (error) {
          const normalizedError = normalizeAxiosError(error);
          if (this.errorClassifier.isTerminalAuthError(normalizedError.code)) {
            this.endSession();
          }
          throw normalizedError;
        }
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  async login(requestLogin: () => Promise<S>): Promise<S> {
    const transition = this.beginTransition("login");
    await this.waitForCurrentRefresh();

    try {
      return await this.tabChannel.runExclusive(async () => {
        if (transition.lifecycle !== this.lifecycle) {
          throw transitionError();
        }

        const result = await requestLogin();
        if (transition.lifecycle !== this.lifecycle) {
          throw transitionError();
        }

        this.acceptSession(result);
        return result;
      });
    } finally {
      this.finishTransition(transition);
    }
  }

  async logout(requestLogout: () => Promise<unknown>) {
    const transition = this.beginTransition("logout");
    await this.waitForCurrentRefresh();
    let requestError: unknown;

    try {
      await this.tabChannel.runExclusive(async () => {
        try {
          await requestLogout();
        } catch (error) {
          requestError = normalizeAxiosError(error);
        }
      });
    } finally {
      this.endSession();
      this.finishTransition(transition);
    }

    if (requestError) {
      throw requestError;
    }
  }

  endSession() {
    this.lifecycle += 1;
    this.store.clear();
    this.publish({ type: "session-ended" });
  }

  private acceptSession(session: S) {
    this.store.save(session);
    this.publish({ session, type: "session-updated" });
  }

  private beginTransition(transition: Exclude<AuthTransition, "idle">) {
    this.lifecycle += 1;
    this.transitionId += 1;
    this.transition = transition;
    return {
      lifecycle: this.lifecycle,
      transitionId: this.transitionId,
    } satisfies AuthTransitionContext;
  }

  private finishTransition(transition: AuthTransitionContext) {
    if (transition.transitionId === this.transitionId) {
      this.transition = "idle";
    }
  }

  private handleTabChannelEvent(event: AuthTabChannelEvent<S>) {
    // 旧事件直接丢弃；同毫秒但来自不同发布方的事件不算重复，按到达顺序应用。
    if (
      event.sentAt < this.lastEventAt ||
      (event.sentAt === this.lastEventAt && event.sourceId === this.lastEventSourceId)
    ) {
      return;
    }

    this.lastEventAt = event.sentAt;
    this.lastEventSourceId = event.sourceId;
    if (event.type === "session-ended") {
      this.lifecycle += 1;
      this.store.clear();
      return;
    }

    if (this.transition === "idle") {
      this.store.save(event.session);
    }
  }

  private isUsablePeerSession(session: null | S): session is S {
    if (!session) {
      return false;
    }

    const now = Date.now();
    return (
      Date.parse(session.expires) - now > this.peerSessionMinRemainingMs &&
      Date.parse(session.sessionExpires) > now
    );
  }

  private publish(event: { session: S; type: "session-updated" } | { type: "session-ended" }) {
    const sentAt = Math.max(Date.now(), this.lastEventAt + 1);
    this.lastEventAt = sentAt;
    this.lastEventSourceId = this.instanceId;
    this.tabChannel.publish({ ...event, sentAt, sourceId: this.instanceId });
  }

  private async waitForCurrentRefresh() {
    try {
      await this.refreshPromise;
    } catch {
      // The transition owns the final session state, so refresh failures are ignored here.
    }
  }
}
