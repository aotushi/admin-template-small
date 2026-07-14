import type { AxiosRequestConfig, CreateAxiosDefaults, InternalAxiosRequestConfig } from "axios";

// ---------------------------------------------------------------------------
// 请求策略
// ---------------------------------------------------------------------------

export type RequestAuthMode = "none" | "optional" | "required";

export interface HttpRequestOptions {
  /** 业务接口默认 required；登录、刷新和退出必须显式使用 none。 */
  authMode?: RequestAuthMode;
}

export type RequestConfig<D = unknown> = AxiosRequestConfig<D> & HttpRequestOptions;

export type InternalRequestConfig<D = unknown> = InternalAxiosRequestConfig<D> &
  HttpRequestOptions & {
    /** 受保护请求因 access token 过期最多重放一次。 */
    _authRetryCount?: number;
    /** 记录请求真正发送的 token，用于识别迟到的 401。 */
    _sentAccessToken?: string;
  };

// ---------------------------------------------------------------------------
// 响应外壳
// ---------------------------------------------------------------------------

export interface ApiSuccess<T> {
  data: T;
  success: true;
}

export interface ApiFailure {
  code?: number | string;
  error?: string;
  message?: string;
  success?: false;
}

export type ApiResponse<T> = ApiFailure | ApiSuccess<T> | T;

// ---------------------------------------------------------------------------
// 可注入的会话契约：本目录不依赖任何具体项目的会话实现
// ---------------------------------------------------------------------------

/** 套件对会话对象的最小要求；宿主项目可携带任意额外字段（如用户快照）。 */
export interface AuthSession {
  accessToken: string;
  /** access token 过期时间，ISO 字符串。 */
  expires: string;
  /** refresh 会话过期时间，ISO 字符串。 */
  sessionExpires: string;
}

/** 宿主项目提供的会话存储。套件只读写这份契约，不关心存储介质。 */
export interface AuthSessionStore<S extends AuthSession = AuthSession> {
  clear(): void;
  getAccessToken(): null | string;
  /** access token 距离过期的毫秒数；无 token 或不可解析时返回负数。 */
  getAccessTokenRemainingMs(): number;
  /** 会话每次写入或清空都必须递增，用于识别锁等待期间的会话变化。 */
  getRevision(): number;
  /** 返回可分享给其它标签页的完整会话；不完整时返回 null。 */
  getSession(): null | S;
  save(session: S): void;
}

/** 宿主项目提供的认证错误分类：套件不内置任何错误码契约。 */
export interface AuthErrorClassifier {
  /** 是否为“access token 已过期”，即唯一允许自动刷新重放的信号。 */
  isAccessTokenExpired(status: number | undefined, code: unknown): boolean;
  /** 是否为终止型错误：刷新无法恢复，应结束本地会话。 */
  isTerminalAuthError(code: unknown): boolean;
}

// ---------------------------------------------------------------------------
// 工厂配置
// ---------------------------------------------------------------------------

export interface HttpClientContextOptions {
  /** 覆盖 Axios 默认配置（baseURL、超时、适配器等）。 */
  axiosDefaults?: CreateAxiosDefaults;
  /** 请求头注入的首选语言；不提供则不写 Accept-Language。 */
  getPreferredLanguage?: () => string;
  /** peer 会话至少还要“新鲜”多少毫秒才被采纳；默认与主动刷新窗口一致。 */
  peerSessionMinRemainingMs?: number;
  /** access token 距过期小于该窗口时主动刷新；默认 30 秒。 */
  proactiveRefreshWindowMs?: number;
  /** 刷新接口地址；以 authMode: "none" 通过同一实例调用。 */
  refreshUrl: string;
}
