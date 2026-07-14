import axios, { type AxiosInstance, type AxiosResponse } from "axios";

import { createNoopAuthCoordination, type AuthCoordination } from "@/api/http/auth-coordination";
import { AuthSessionCoordinator } from "@/api/http/auth-session-coordinator";
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

export class HttpClient {
  constructor(private readonly instance: AxiosInstance) {}

  async request<T, D = unknown>(config: RequestConfig<D>): Promise<T> {
    // 3. 所有业务请求经过 Axios 后，只在这里剥离一次响应外壳。
    const response = await this.instance.request<ApiResponse<T>, AxiosResponse<ApiResponse<T>>, D>(
      config,
    );
    return unwrapApiResponse<T>(response);
  }

  get<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "GET", url });
  }

  delete<T, D = unknown>(url: string, config?: RequestConfig<D>): Promise<T> {
    return this.request<T, D>({ ...config, method: "DELETE", url });
  }

  head<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "HEAD", url });
  }

  options<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "OPTIONS", url });
  }

  post<T, D = unknown>(url: string, data?: D, config?: RequestConfig<D>): Promise<T> {
    return this.request<T, D>({ ...config, data, method: "POST", url });
  }

  put<T, D = unknown>(url: string, data?: D, config?: RequestConfig<D>): Promise<T> {
    return this.request<T, D>({ ...config, data, method: "PUT", url });
  }

  patch<T, D = unknown>(url: string, data?: D, config?: RequestConfig<D>): Promise<T> {
    return this.request<T, D>({ ...config, data, method: "PATCH", url });
  }
}

export interface HttpClientContext<S extends AuthSession> {
  authSessionCoordinator: AuthSessionCoordinator<S>;
  requestClient: HttpClient;
}

export function createHttpClientContext<S extends AuthSession>(
  options: HttpClientContextOptions & {
    coordination?: AuthCoordination<S>;
    errorClassifier: AuthErrorClassifier;
    sessionStore: AuthSessionStore<S>;
  },
): HttpClientContext<S> {
  const coordination = options.coordination ?? createNoopAuthCoordination<S>();
  const proactiveRefreshWindowMs =
    options.proactiveRefreshWindowMs ?? DEFAULT_PROACTIVE_REFRESH_WINDOW_MS;

  // 1. 创建该上下文唯一的 Axios 实例。
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
    coordination,
    errorClassifier: options.errorClassifier,
    peerSessionMinRemainingMs: options.peerSessionMinRemainingMs ?? proactiveRefreshWindowMs,
    requestRefresh,
    sessionStore: options.sessionStore,
  });

  // 2. 依次安装请求拦截器和响应拦截器。
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
