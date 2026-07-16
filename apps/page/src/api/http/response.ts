import type { AxiosResponse } from "axios";

import { ApiError, readApiErrorCode, readApiMessage } from "@/api/http/errors";
import type { ApiFailure, ApiResponse } from "@/api/http/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function unwrapApiResponse<T>(response: AxiosResponse<ApiResponse<T>>): T {
  const body = response.data;

  if (!isRecord(body)) {
    return body as T;
  }

  // success 为 true 即视为成功；写接口可能只带 message 不带 data
  if ("success" in body && body.success === true) {
    return ("data" in body ? body.data : null) as T;
  }

  if ("success" in body && body.success === false) {
    throw new ApiError(readApiMessage(body as ApiFailure, "请求失败"), {
      code: readApiErrorCode(body),
      data: body,
      status: response.status,
    });
  }

  if ("error" in body || "message" in body) {
    throw new ApiError(readApiMessage(body, "请求失败"), {
      code: readApiErrorCode(body),
      data: body,
      status: response.status,
    });
  }

  return body as T;
}
