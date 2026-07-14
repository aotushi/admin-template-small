// 稳定出口 + 组装点：把可复用的 http 套件与本项目的会话存储、错误码契约、
// 环境配置装配到一起。业务 API 只依赖本文件，不感知内部拆分。
import {
  AUTH_ERROR_CODES,
  isTerminalAuthErrorCode,
} from "@admin-backend-3/admin-api-contract/auth";
import type { CreateAxiosDefaults } from "axios";

import {
  createBrowserAuthCoordination,
  createHttpClientContext,
  createNoopAuthCoordination,
  type AuthCoordination,
  type AuthErrorClassifier,
} from "@/api/http";
import { authSessionStore, getPreferredLocale } from "@/api/session";
import type { AuthSessionResult } from "@/api/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/admin";
const REFRESH_SESSION_URL = "/api/auth/refresh";

/** 本项目的认证错误分类：依据后端稳定错误码契约，不解析 message 文案。 */
const adminAuthErrorClassifier: AuthErrorClassifier = {
  isAccessTokenExpired(status, code) {
    return status === 401 && code === AUTH_ERROR_CODES.accessTokenExpired;
  },
  isTerminalAuthError(code) {
    return isTerminalAuthErrorCode(code);
  },
};

/** 装配本项目请求上下文；测试传入自定义 adapter 和 noop 协调即可获得隔离实例。 */
export function createAdminHttpContext(
  axiosDefaults: CreateAxiosDefaults = {},
  coordination?: AuthCoordination<AuthSessionResult>,
) {
  return createHttpClientContext<AuthSessionResult>({
    axiosDefaults: { baseURL: API_BASE_URL, ...axiosDefaults },
    coordination,
    errorClassifier: adminAuthErrorClassifier,
    getPreferredLanguage: getPreferredLocale,
    refreshUrl: REFRESH_SESSION_URL,
    sessionStore: authSessionStore,
  });
}

const productionContext = createAdminHttpContext(
  {},
  import.meta.env.MODE === "test"
    ? createNoopAuthCoordination<AuthSessionResult>()
    : createBrowserAuthCoordination<AuthSessionResult>(() => authSessionStore.getSession(), {
        channelName: "admin-backend-3-auth",
        lockName: "admin-backend-3-auth-session",
      }),
);

export const requestClient = productionContext.requestClient;
export const authSessionCoordinator = productionContext.authSessionCoordinator;

export {
  ApiError,
  getApiErrorMessage,
  isApiError,
  normalizeAxiosError,
  readApiErrorCode,
  unwrapApiResponse,
} from "@/api/http";
export type {
  ApiFailure,
  ApiResponse,
  ApiSuccess,
  HttpRequestOptions,
  InternalRequestConfig,
  RequestAuthMode,
  RequestConfig,
} from "@/api/http";
