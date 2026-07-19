import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_ERROR_CODES } from "@admin-backend-3/admin-api-contract/auth";
import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

import {
  clearAuthSession,
  getAccessToken,
  getAuthSessionSnapshot,
  saveAuthSession,
} from "@/api/session";
import {
  ApiError,
  createAdminHttpContext,
  getApiErrorMessage,
  unwrapApiResponse,
} from "@/api/request";
import type { AuthSessionResult } from "@/api/types";
import type { CreateAxiosDefaults } from "axios";

function createHttpClient(axiosDefaults: CreateAxiosDefaults) {
  return createAdminHttpContext(axiosDefaults).requestClient;
}

function makeResponse<T>(data: T, status = 200) {
  return {
    config: {},
    data,
    headers: {},
    status,
    statusText: "OK",
  } as AxiosResponse<T>;
}

function makeAdapterResponse<T>(config: InternalAxiosRequestConfig, data: T, status = 200) {
  return {
    config,
    data,
    headers: new AxiosHeaders(),
    status,
    statusText: status === 200 ? "OK" : "Error",
  } as AxiosResponse<T>;
}

function makeHttpError(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  return new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_REQUEST,
    config,
    undefined,
    makeAdapterResponse(config, data, status),
  );
}

function makeSession(accessToken: string, expiresInMs = 60 * 60_000): AuthSessionResult {
  const now = Date.now();
  return {
    accessToken,
    expires: new Date(now + expiresInMs).toISOString(),
    sessionExpires: new Date(now + 30 * 24 * 60 * 60_000).toISOString(),
    tokenType: "Bearer",
    user: {
      id: 1,
      roles: ["admin"],
      username: "vben",
    },
  };
}

describe("api request helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAuthSession();
  });

  it("unwraps hono success envelopes", () => {
    const result = unwrapApiResponse(makeResponse({ data: { id: 1 }, success: true }));

    expect(result).toEqual({ id: 1 });
  });

  it("turns hono error envelopes into api errors", () => {
    expect(() =>
      unwrapApiResponse(
        makeResponse({ code: AUTH_ERROR_CODES.invalidCredentials, error: "用户名或密码错误" }, 401),
      ),
    ).toThrow(ApiError);
  });

  it("returns a readable api error message", () => {
    expect(getApiErrorMessage(new ApiError("登录状态已失效"))).toBe("登录状态已失效");
  });

  it("keeps the access token in memory without exposing the refresh credential", () => {
    saveAuthSession(makeSession("new-access-token"));

    expect(getAccessToken()).toBe("new-access-token");
    expect(getAuthSessionSnapshot().currentUser?.username).toBe("vben");
    expect(window.localStorage.getItem("admin-backend-3-token")).toBeNull();
    expect(window.localStorage.getItem("admin-backend-3-refresh-token")).toBeNull();
  });

  it("adds the access token and locale in the request interceptor", async () => {
    saveAuthSession(makeSession("access-token"));
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
      makeAdapterResponse(config, { data: { id: 1 }, success: true }),
    );
    const client = createHttpClient({ adapter });

    await client.get<{ id: number }>("/api/users/1");

    const requestConfig = adapter.mock.calls[0]?.[0];
    expect(requestConfig?.headers.get("Authorization")).toBe("Bearer access-token");
    expect(requestConfig?.headers.get("Accept-Language")).toBeTruthy();
  });

  it("keeps public auth requests out of the access-token and refresh flow", async () => {
    saveAuthSession(makeSession("existing-access-token"));
    let refreshCount = 0;
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === "/api/auth/refresh") {
        refreshCount += 1;
      }

      throw makeHttpError(config, 401, { error: "用户名或密码错误" });
    });
    const client = createHttpClient({ adapter });

    await expect(
      client.post("/api/auth/login", { password: "wrong", username: "vben" }, { authMode: "none" }),
    ).rejects.toMatchObject({ kind: "http", status: 401 });

    expect(adapter.mock.calls[0]?.[0].headers.get("Authorization")).toBeUndefined();
    expect(refreshCount).toBe(0);
    expect(getAccessToken()).toBe("existing-access-token");
  });

  it("shares one refresh across concurrent 401 responses and replays each request once", async () => {
    saveAuthSession(makeSession("expired-access-token"));
    let refreshCount = 0;
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === "/api/auth/refresh") {
        refreshCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return makeAdapterResponse(config, {
          data: makeSession("renewed-access-token"),
          success: true,
        });
      }

      if (config.headers.get("Authorization") === "Bearer expired-access-token") {
        throw makeHttpError(config, 401, {
          code: AUTH_ERROR_CODES.accessTokenExpired,
          error: "登录凭证已过期",
        });
      }

      return makeAdapterResponse(config, {
        data: { url: config.url },
        success: true,
      });
    });
    const client = createHttpClient({ adapter });

    const results = await Promise.all([
      client.get<{ url: string }>("/api/first"),
      client.get<{ url: string }>("/api/second"),
    ]);

    expect(refreshCount).toBe(1);
    expect(adapter).toHaveBeenCalledTimes(5);
    expect(results).toEqual([{ url: "/api/first" }, { url: "/api/second" }]);
    expect(getAccessToken()).toBe("renewed-access-token");
  });

  it("does not refresh a 401 request that did not send an access token", async () => {
    let refreshCount = 0;
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === "/api/auth/refresh") {
        refreshCount += 1;
      }

      throw makeHttpError(config, 401, {
        code: AUTH_ERROR_CODES.authRequired,
        error: "请先登录",
      });
    });
    const client = createHttpClient({ adapter });

    await expect(client.get("/api/protected")).rejects.toMatchObject({
      code: AUTH_ERROR_CODES.authRequired,
      status: 401,
    });
    expect(refreshCount).toBe(0);
  });

  it("keeps the session when the authenticated user lacks permission", async () => {
    saveAuthSession(makeSession("access-token"));
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      throw makeHttpError(config, 403, {
        code: AUTH_ERROR_CODES.forbidden,
        error: "没有操作权限",
      });
    });
    const client = createHttpClient({ adapter });

    await expect(client.get("/api/admin-only")).rejects.toMatchObject({
      code: AUTH_ERROR_CODES.forbidden,
      status: 403,
    });
    expect(getAccessToken()).toBe("access-token");
  });

  it("ends the session for an explicitly invalid access token without refreshing", async () => {
    saveAuthSession(makeSession("invalid-access-token"));
    let refreshCount = 0;
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === "/api/auth/refresh") {
        refreshCount += 1;
      }

      throw makeHttpError(config, 401, {
        code: AUTH_ERROR_CODES.accessTokenInvalid,
        error: "登录凭证无效",
      });
    });
    const client = createHttpClient({ adapter });

    await expect(client.get("/api/protected")).rejects.toMatchObject({
      code: AUTH_ERROR_CODES.accessTokenInvalid,
      status: 401,
    });
    expect(refreshCount).toBe(0);
    expect(getAccessToken()).toBeNull();
  });

  it("refreshes proactively when the access token is close to expiry", async () => {
    saveAuthSession(makeSession("expiring-access-token", 5_000));
    let refreshCount = 0;
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === "/api/auth/refresh") {
        refreshCount += 1;
        return makeAdapterResponse(config, {
          data: makeSession("proactive-access-token"),
          success: true,
        });
      }

      return makeAdapterResponse(config, {
        data: { authorization: config.headers.get("Authorization") },
        success: true,
      });
    });
    const client = createHttpClient({ adapter });

    const result = await client.get<{ authorization: string }>("/api/proactive");

    expect(refreshCount).toBe(1);
    expect(result.authorization).toBe("Bearer proactive-access-token");
  });

  it("does not clear the session when refresh fails temporarily", async () => {
    saveAuthSession(makeSession("expired-access-token"));
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === "/api/auth/refresh") {
        throw makeHttpError(config, 503, {
          code: AUTH_ERROR_CODES.authServiceUnavailable,
          error: "刷新服务暂不可用",
        });
      }

      throw makeHttpError(config, 401, {
        code: AUTH_ERROR_CODES.accessTokenExpired,
        error: "登录凭证已过期",
      });
    });
    const client = createHttpClient({ adapter });

    await expect(client.get("/api/temporary-failure")).rejects.toMatchObject({
      code: AUTH_ERROR_CODES.authServiceUnavailable,
      status: 503,
    });
    expect(getAccessToken()).toBe("expired-access-token");
  });

  it("does not treat an undocumented refresh 401 as a terminal session error", async () => {
    saveAuthSession(makeSession("expired-access-token"));
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === "/api/auth/refresh") {
        throw makeHttpError(config, 401, { error: "认证服务返回了未知响应" });
      }

      throw makeHttpError(config, 401, {
        code: AUTH_ERROR_CODES.accessTokenExpired,
        error: "登录凭证已过期",
      });
    });
    const client = createHttpClient({ adapter });

    await expect(client.get("/api/unknown-refresh-error")).rejects.toMatchObject({
      code: undefined,
      status: 401,
    });
    expect(getAccessToken()).toBe("expired-access-token");
  });

  it("ends the session when the refresh session is expired", async () => {
    saveAuthSession(makeSession("expired-access-token"));
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === "/api/auth/refresh") {
        throw makeHttpError(config, 401, {
          code: AUTH_ERROR_CODES.refreshExpired,
          error: "刷新会话已过期",
        });
      }

      throw makeHttpError(config, 401, {
        code: AUTH_ERROR_CODES.accessTokenExpired,
        error: "登录凭证已过期",
      });
    });
    const client = createHttpClient({ adapter });

    await expect(client.get("/api/terminal-failure")).rejects.toMatchObject({
      code: AUTH_ERROR_CODES.refreshExpired,
      status: 401,
    });
    expect(getAccessToken()).toBeNull();
  });

  it("replays a delayed old-token 401 with the current token without refreshing again", async () => {
    saveAuthSession(makeSession("old-access-token"));
    let refreshCount = 0;
    let refreshStarted: (() => void) | undefined;
    const refreshStartedPromise = new Promise<void>((resolve) => {
      refreshStarted = resolve;
    });
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === "/api/auth/refresh") {
        refreshCount += 1;
        refreshStarted?.();
        return makeAdapterResponse(config, {
          data: makeSession("current-access-token"),
          success: true,
        });
      }

      const authorization = config.headers.get("Authorization");
      if (authorization === "Bearer old-access-token") {
        if (config.url === "/api/delayed") {
          await refreshStartedPromise;
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        throw makeHttpError(config, 401, {
          code: AUTH_ERROR_CODES.accessTokenExpired,
          error: "登录凭证已过期",
        });
      }

      return makeAdapterResponse(config, { data: { authorization }, success: true });
    });
    const client = createHttpClient({ adapter });

    const [first, delayed] = await Promise.all([
      client.get<{ authorization: string }>("/api/first"),
      client.get<{ authorization: string }>("/api/delayed"),
    ]);

    expect(refreshCount).toBe(1);
    expect(first.authorization).toBe("Bearer current-access-token");
    expect(delayed.authorization).toBe("Bearer current-access-token");
  });

  // 重放后仍过期只上抛错误，会话是否终结由终止型错误码决定，不再直接清空。
  it("does not retry again when the replayed request also reports an expired token", async () => {
    saveAuthSession(makeSession("old-access-token"));
    let refreshCount = 0;
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === "/api/auth/refresh") {
        refreshCount += 1;
        return makeAdapterResponse(config, {
          data: makeSession("new-access-token"),
          success: true,
        });
      }

      throw makeHttpError(config, 401, {
        code: AUTH_ERROR_CODES.accessTokenExpired,
        error: "登录凭证已过期",
      });
    });
    const client = createHttpClient({ adapter });

    await expect(client.get("/api/still-expired")).rejects.toMatchObject({
      code: AUTH_ERROR_CODES.accessTokenExpired,
      status: 401,
    });
    expect(refreshCount).toBe(1);
    expect(getAccessToken()).toBe("new-access-token");
  });
});
