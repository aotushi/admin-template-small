import axios, { AxiosError } from "axios";

export type ApiErrorKind = "business" | "cancel" | "http" | "network" | "timeout";

interface ApiErrorOptions {
  code?: number | string;
  data?: unknown;
  kind?: ApiErrorKind;
  status?: number;
}

export class ApiError extends Error {
  public readonly code?: number | string;
  public readonly data?: unknown;
  public readonly isApiError = true;
  public readonly kind: ApiErrorKind;
  public readonly status?: number;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.code = options.code;
    this.data = options.data;
    this.kind = options.kind ?? "business";
    this.status = options.status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readApiMessage(data: unknown, fallback: string) {
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

export function readApiErrorCode(data: unknown) {
  if (!isRecord(data)) {
    return undefined;
  }

  const { code } = data;
  return typeof code === "string" || typeof code === "number" ? code : undefined;
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

export function normalizeAxiosError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (
    axios.isCancel(error) ||
    (axios.isAxiosError(error) && error.code === AxiosError.ERR_CANCELED)
  ) {
    return new ApiError("请求已取消", { kind: "cancel" });
  }

  if (!axios.isAxiosError(error)) {
    return new ApiError(error instanceof Error ? error.message : "请求失败");
  }

  if (error.response) {
    const { data, status } = error.response;

    return new ApiError(readApiMessage(data, getHttpErrorMessage(status)), {
      code: readApiErrorCode(data),
      data,
      kind: "http",
      status,
    });
  }

  if (error.code === AxiosError.ECONNABORTED || error.code === "ETIMEDOUT") {
    return new ApiError("请求超时，请稍后重试", { kind: "timeout" });
  }

  return new ApiError("网络连接失败，请检查网络后重试", { kind: "network" });
}

export function getApiErrorMessage(error: unknown) {
  return normalizeAxiosError(error).message;
}
