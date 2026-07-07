import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

import {
  clearAuthSession,
  getAccessToken,
  getPreferredLocale,
  getRefreshToken,
  saveAuthTokens,
} from "@/api/session";
import type { ApiFailure, ApiResponse, TokenRefreshResult } from "@/api/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/admin";
const REQUEST_TIMEOUT = 15_000;
const REFRESH_TOKEN_URL = "/api/auth/refresh";

interface AuthRetryConfig extends AxiosRequestConfig {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
}

let refreshSessionPromise: null | Promise<TokenRefreshResult> = null;

export class ApiError extends Error {
  public readonly data?: unknown;
  public readonly isApiError = true;
  public readonly status?: number;

  constructor(message: string, options: { data?: unknown; status?: number } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.data = options.data;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readApiMessage(data: unknown, fallback: string) {
  if (!isRecord(data)) {
    return fallback;
  }

  const { error, message } = data;

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return fallback;
}

function getHttpErrorMessage(status: number) {
  const messages: Record<number, string> = {
    400: "请求参数错误",
    401: "登录状态已失效",
    403: "没有操作权限",
    404: "接口不存在",
    408: "请求超时",
    429: "请求过于频繁",
    500: "服务器内部错误",
    502: "网关错误",
    503: "服务暂不可用",
  };

  return messages[status] ?? "请求失败";
}

function normalizeAxiosError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new ApiError("请求失败");
  }

  if (error.response) {
    const { data, status } = error.response;

    return new ApiError(readApiMessage(data, getHttpErrorMessage(status)), {
      data,
      status,
    });
  }

  if (error.code === AxiosError.ERR_CANCELED) {
    return error;
  }

  if (error.code === AxiosError.ECONNABORTED) {
    return new ApiError("请求超时，请稍后重试");
  }

  return new ApiError(error.message || "网络连接失败");
}

async function refreshAuthSession(client: AxiosInstance) {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new ApiError("登录状态已失效", { status: 401 });
  }

  refreshSessionPromise ??= client
    .post<ApiResponse<TokenRefreshResult>>(REFRESH_TOKEN_URL, { refreshToken }, {
      skipAuthRefresh: true,
    } as AuthRetryConfig)
    .then((response) => {
      const tokens = unwrapApiResponse<TokenRefreshResult>(response);
      saveAuthTokens(tokens);
      return tokens;
    })
    .finally(() => {
      refreshSessionPromise = null;
    });

  return refreshSessionPromise;
}

function setupRequestInterceptor(client: AxiosInstance) {
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    config.headers["Accept-Language"] = getPreferredLocale();
    return config;
  });
}

function setupResponseInterceptor(client: AxiosInstance) {
  client.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      if (axios.isAxiosError(error)) {
        const originalConfig = error.config as AuthRetryConfig | undefined;
        const status = error.response?.status;

        if (
          status === 401 &&
          originalConfig &&
          !originalConfig._retry &&
          !originalConfig.skipAuthRefresh &&
          !originalConfig.url?.includes(REFRESH_TOKEN_URL)
        ) {
          try {
            originalConfig._retry = true;
            const tokens = await refreshAuthSession(client);
            originalConfig.headers = {
              ...originalConfig.headers,
              Authorization: `Bearer ${tokens.accessToken}`,
            };
            return client.request(originalConfig);
          } catch (refreshError) {
            clearAuthSession();
            return Promise.reject(normalizeAxiosError(refreshError));
          }
        }

        if (status === 401) {
          clearAuthSession();
        }
      }

      return Promise.reject(normalizeAxiosError(error));
    },
  );
}

export function unwrapApiResponse<T>(response: AxiosResponse<ApiResponse<T>>): T {
  const body = response.data;

  if (!isRecord(body)) {
    return body as T;
  }

  if ("success" in body && body.success === true && "data" in body) {
    return body.data as T;
  }

  if ("success" in body && body.success === false) {
    throw new ApiError(readApiMessage(body as ApiFailure, "请求失败"), {
      data: body,
      status: response.status,
    });
  }

  if ("error" in body || "message" in body) {
    throw new ApiError(readApiMessage(body, "请求失败"), {
      data: body,
      status: response.status,
    });
  }

  return body as T;
}

export function getApiErrorMessage(error: unknown) {
  if (isApiError(error)) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "请求失败";
}

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json;charset=utf-8",
  },
  timeout: REQUEST_TIMEOUT,
});

setupRequestInterceptor(httpClient);
setupResponseInterceptor(httpClient);

export async function request<T>(config: AxiosRequestConfig) {
  const response = await httpClient.request<ApiResponse<T>>(config);
  return unwrapApiResponse<T>(response);
}

export const requestClient = {
  delete<T>(url: string, config?: AxiosRequestConfig) {
    return request<T>({ ...config, method: "DELETE", url });
  },
  get<T>(url: string, config?: AxiosRequestConfig) {
    return request<T>({ ...config, method: "GET", url });
  },
  patch<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) {
    return request<T>({ ...config, data, method: "PATCH", url });
  },
  post<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) {
    return request<T>({ ...config, data, method: "POST", url });
  },
  put<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig) {
    return request<T>({ ...config, data, method: "PUT", url });
  },
};
