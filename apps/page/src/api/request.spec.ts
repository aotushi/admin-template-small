import { beforeEach, describe, expect, it } from "vitest";
import type { AxiosResponse } from "axios";

import { getAccessToken, getRefreshToken, saveAuthTokens } from "@/api/session";
import { ApiError, getApiErrorMessage, unwrapApiResponse } from "@/api/request";

function makeResponse<T>(data: T, status = 200) {
  return {
    config: {},
    data,
    headers: {},
    status,
    statusText: "OK",
  } as AxiosResponse<T>;
}

describe("api request helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("unwraps hono success envelopes", () => {
    const result = unwrapApiResponse(makeResponse({ data: { id: 1 }, success: true }));

    expect(result).toEqual({ id: 1 });
  });

  it("turns hono error envelopes into api errors", () => {
    expect(() => unwrapApiResponse(makeResponse({ error: "用户名或密码错误" }, 401))).toThrow(
      ApiError,
    );
  });

  it("returns a readable api error message", () => {
    expect(getApiErrorMessage(new ApiError("登录状态已失效"))).toBe("登录状态已失效");
  });

  it("stores refreshed dual-token pairs", () => {
    saveAuthTokens({
      accessToken: "new-access-token",
      expires: "2026-07-06T03:15:00.000Z",
      refreshExpires: "2026-07-13T03:00:00.000Z",
      refreshToken: "new-refresh-token",
      tokenType: "Bearer",
    });

    expect(getAccessToken()).toBe("new-access-token");
    expect(getRefreshToken()).toBe("new-refresh-token");
  });
});
