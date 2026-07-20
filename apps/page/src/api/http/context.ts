import axios, { type AxiosResponse } from "axios";

import { createNoopAuthTabChannel, type AuthTabChannel } from "@/api/http/auth-tab-channel";
import { AuthSessionCoordinator } from "@/api/http/auth-session-coordinator";
import { HttpClient } from "@/api/http/client";
import { createHttpConfig } from "@/api/http/config";
import { installHttpInterceptors } from "@/api/http/interceptors";
import { unwrapApiResponse } from "@/api/http/response";
import type {
  ApiResponse,
  AuthErrorClassifier,
  AuthSession,
  AuthSessionStore,
  HttpClientContextOptions,
  RequestConfig,
} from "@/api/http/types";

const DEFAULT_PROACTIVE_REFRESH_WINDOW_MS = 30_000;

export interface HttpClientContext<S extends AuthSession> {
  authSessionCoordinator: AuthSessionCoordinator<S>;
  requestClient: HttpClient;
}

export function createHttpClientContext<S extends AuthSession>(
  options: HttpClientContextOptions & {
    tabChannel?: AuthTabChannel<S>;
    errorClassifier: AuthErrorClassifier;
    sessionStore: AuthSessionStore<S>;
  },
): HttpClientContext<S> {
  const tabChannel = options.tabChannel ?? createNoopAuthTabChannel<S>();
  const proactiveRefreshWindowMs =
    options.proactiveRefreshWindowMs ?? DEFAULT_PROACTIVE_REFRESH_WINDOW_MS;

  // 创建该上下文唯一的 Axios 实例。
  const instance = axios.create(createHttpConfig(options.axiosDefaults));

  // 刷新请求走同一个实例：authMode "none" 保证不带 Authorization，
  // 浏览器自动携带 HttpOnly refresh Cookie。
  const requestRefresh = async () => {
    const response = await instance.request<ApiResponse<S>, AxiosResponse<ApiResponse<S>>>({
      authMode: "none",
      method: "POST",
      url: options.refreshUrl,
    } as RequestConfig);
    return unwrapApiResponse<S>(response);
  };

  const authSessionCoordinator = new AuthSessionCoordinator<S>({
    tabChannel,
    errorClassifier: options.errorClassifier,
    peerSessionMinRemainingMs: options.peerSessionMinRemainingMs ?? proactiveRefreshWindowMs,
    requestRefresh,
    sessionStore: options.sessionStore,
  });

  // 依次安装请求拦截器和响应拦截器。
  installHttpInterceptors(instance, {
    coordinator: authSessionCoordinator,
    errorClassifier: options.errorClassifier,
    getPreferredLanguage: options.getPreferredLanguage,
    proactiveRefreshWindowMs,
    sessionStore: options.sessionStore,
  });

  return {
    authSessionCoordinator,
    requestClient: new HttpClient(instance),
  };
}
