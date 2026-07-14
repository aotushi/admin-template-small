import {
  AUTH_ERROR_CODES,
  type AuthErrorCode,
  type AuthErrorResponse,
} from '@admin-backend-3/admin-api-contract/auth';
import type { Context } from 'hono';

type AuthErrorStatus = 400 | 401 | 403 | 429 | 500 | 503;

export function setAuthResponseNoStore(c: Context) {
  c.header('Cache-Control', 'no-store');
  c.header('Pragma', 'no-cache');
}

function setBearerChallenge(c: Context, code: AuthErrorCode) {
  if (code === AUTH_ERROR_CODES.authRequired) {
    c.header('WWW-Authenticate', 'Bearer realm="admin-api"');
    return;
  }

  if (
    code === AUTH_ERROR_CODES.accessTokenExpired ||
    code === AUTH_ERROR_CODES.accessTokenInvalid
  ) {
    c.header(
      'WWW-Authenticate',
      'Bearer realm="admin-api", error="invalid_token"'
    );
  }
}

export function authError(
  c: Context,
  status: AuthErrorStatus,
  code: AuthErrorCode,
  message: string
) {
  setAuthResponseNoStore(c);
  setBearerChallenge(c, code);

  return c.json<AuthErrorResponse>(
    {
      code,
      error: message,
      success: false
    },
    status
  );
}
