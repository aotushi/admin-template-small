export const AUTH_ERROR_CODES = {
  accessTokenExpired: "ACCESS_TOKEN_EXPIRED",
  accessTokenInvalid: "ACCESS_TOKEN_INVALID",
  accountUnavailable: "ACCOUNT_UNAVAILABLE",
  authRequired: "AUTH_REQUIRED",
  authServiceUnavailable: "AUTH_SERVICE_UNAVAILABLE",
  forbidden: "FORBIDDEN",
  invalidCredentials: "INVALID_CREDENTIALS",
  originNotAllowed: "ORIGIN_NOT_ALLOWED",
  refreshExpired: "REFRESH_EXPIRED",
  refreshMissing: "REFRESH_MISSING",
  refreshReplayed: "REFRESH_REPLAYED",
  refreshRevoked: "REFRESH_REVOKED",
  tooManyRequests: "TOO_MANY_REQUESTS",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export const TERMINAL_AUTH_ERROR_CODES: readonly AuthErrorCode[] = [
  AUTH_ERROR_CODES.accessTokenInvalid,
  AUTH_ERROR_CODES.accountUnavailable,
  AUTH_ERROR_CODES.originNotAllowed,
  AUTH_ERROR_CODES.refreshExpired,
  AUTH_ERROR_CODES.refreshMissing,
  AUTH_ERROR_CODES.refreshReplayed,
  AUTH_ERROR_CODES.refreshRevoked,
] as const;

export function isTerminalAuthErrorCode(value: unknown): value is AuthErrorCode {
  return TERMINAL_AUTH_ERROR_CODES.some((code) => code === value);
}

export interface AuthErrorResponse {
  code: AuthErrorCode;
  error: string;
  success: false;
}
