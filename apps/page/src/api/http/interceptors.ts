import axios, { type AxiosInstance } from "axios";

import type { AuthSessionCoordinator } from "@/api/http/auth-session-coordinator";
import { normalizeAxiosError, readApiErrorCode } from "@/api/http/errors";
import type {
  AuthErrorClassifier,
  AuthSession,
  AuthSessionStore,
  InternalRequestConfig,
  RequestAuthMode,
} from "@/api/http/types";

export interface HttpInterceptorOptions<S extends AuthSession> {
  coordinator: AuthSessionCoordinator<S>;
  errorClassifier: AuthErrorClassifier;
  getPreferredLanguage?: () => string;
  proactiveRefreshWindowMs: number;
  sessionStore: AuthSessionStore<S>;
}

function getAuthMode(config?: InternalRequestConfig): RequestAuthMode {
  return config?.authMode ?? "required";
}

function setAccessToken(config: InternalRequestConfig, accessToken: string) {
  config.headers.set("Authorization", `Bearer ${accessToken}`);
  config._sentAccessToken = accessToken;
}

function installRequestInterceptor<S extends AuthSession>(
  client: AxiosInstance,
  options: HttpInterceptorOptions<S>,
) {
  const { coordinator, getPreferredLanguage, proactiveRefreshWindowMs, sessionStore } = options;

  client.interceptors.request.use(async (config) => {
    const requestConfig = config as InternalRequestConfig;
    const authMode = getAuthMode(requestConfig);

    if (
      authMode === "required" &&
      !requestConfig._authRetryCount &&
      coordinator.canRefresh() &&
      sessionStore.getAccessToken() &&
      sessionStore.getAccessTokenRemainingMs() <= proactiveRefreshWindowMs
    ) {
      try {
        await coordinator.refresh("proactive");
      } catch (error) {
        // 主动刷新失败但旧 token 还没过期时放行请求，交给响应侧兜底。
        const stillUsable =
          sessionStore.getAccessToken() && sessionStore.getAccessTokenRemainingMs() > 0;
        if (!stillUsable) {
          throw normalizeAxiosError(error);
        }
      }
    }

    const accessToken = sessionStore.getAccessToken();
    if (authMode === "none") {
      requestConfig.headers.delete("Authorization");
      requestConfig._sentAccessToken = undefined;
    } else if (accessToken) {
      setAccessToken(requestConfig, accessToken);
    }

    if (getPreferredLanguage) {
      requestConfig.headers.set("Accept-Language", getPreferredLanguage());
    }
    return requestConfig;
  });
}

function installResponseInterceptor<S extends AuthSession>(
  client: AxiosInstance,
  options: HttpInterceptorOptions<S>,
) {
  const { coordinator, errorClassifier, sessionStore } = options;

  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (!axios.isAxiosError(error)) {
        throw normalizeAxiosError(error);
      }

      const originalConfig = error.config as InternalRequestConfig | undefined;
      const authMode = getAuthMode(originalConfig);
      const errorCode = readApiErrorCode(error.response?.data);
      const accessTokenExpired = errorClassifier.isAccessTokenExpired(
        error.response?.status,
        errorCode,
      );
      const sentAccessToken = originalConfig?._sentAccessToken;
      const canRecover =
        accessTokenExpired &&
        authMode === "required" &&
        originalConfig &&
        sentAccessToken &&
        coordinator.canRefresh();

      if (canRecover) {
        if ((originalConfig._authRetryCount ?? 0) >= 1) {
          // 重放后仍然过期只上抛错误：是否终结会话由下方终止型错误码统一判定，
          // 不再直接 endSession，避免服务端时钟抖动等暂时故障误杀会话。
          throw normalizeAxiosError(error);
        }

        originalConfig._authRetryCount = 1;
        const currentAccessToken = sessionStore.getAccessToken();
        if (currentAccessToken && currentAccessToken !== sentAccessToken) {
          // 迟到的 401：其它请求已完成刷新，直接用当前 token 重放。
          setAccessToken(originalConfig, currentAccessToken);
          return client.request(originalConfig);
        }

        try {
          const session = await coordinator.refresh("reactive");
          setAccessToken(originalConfig, session.accessToken);
          return client.request(originalConfig);
        } catch (refreshError) {
          throw normalizeAxiosError(refreshError);
        }
      }

      if (authMode === "required" && errorClassifier.isTerminalAuthError(errorCode)) {
        coordinator.endSession();
      }

      throw normalizeAxiosError(error);
    },
  );
}

export function installHttpInterceptors<S extends AuthSession>(
  client: AxiosInstance,
  options: HttpInterceptorOptions<S>,
) {
  // 顺序固定为：请求前准备 -> 发送请求 -> 响应与错误处理。
  installRequestInterceptor(client, options);
  installResponseInterceptor(client, options);
}
