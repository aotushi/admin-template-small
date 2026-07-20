// 可复用双 token 请求套件的公开出口。
// 本目录不依赖任何具体项目模块，宿主项目通过 createHttpClientContext 注入
// 会话存储与错误分类后获得 requestClient 与 authSessionCoordinator。
export {
  createBrowserAuthTabChannel,
  createNoopAuthTabChannel,
  type AuthTabChannel,
  type AuthTabChannelEvent,
  type BrowserAuthTabChannelOptions,
} from "@/api/http/auth-tab-channel";
export {
  AuthSessionCoordinator,
  type AuthRefreshReason,
  type AuthSessionCoordinatorOptions,
} from "@/api/http/auth-session-coordinator";
export { HttpClient } from "@/api/http/client";
export { createHttpClientContext, type HttpClientContext } from "@/api/http/context";
export { createHttpConfig } from "@/api/http/config";
export {
  ApiError,
  getApiErrorMessage,
  isApiError,
  normalizeAxiosError,
  readApiErrorCode,
} from "@/api/http/errors";
export { unwrapApiResponse } from "@/api/http/response";
export type {
  ApiFailure,
  ApiResponse,
  ApiSuccess,
  AuthErrorClassifier,
  AuthSession,
  AuthSessionStore,
  HttpClientContextOptions,
  HttpRequestOptions,
  InternalRequestConfig,
  RequestAuthMode,
  RequestConfig,
} from "@/api/http/types";
