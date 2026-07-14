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

  if ("success" in body && body.success === true && "data" in body) {
    return body.data as T;
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
