import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

import { REFRESH_SESSION_IDLE_TTL_SECONDS } from './refresh-sessions';

const REFRESH_COOKIE_NAME = 'admin_backend_refresh';
const REFRESH_COOKIE_PATH = '/admin/api/auth';

function usesHttps(c: Context) {
  return new URL(c.req.url).protocol === 'https:';
}

function getCookieOptions(c: Context, maxAge = REFRESH_SESSION_IDLE_TTL_SECONDS) {
  return {
    httpOnly: true,
    maxAge,
    path: REFRESH_COOKIE_PATH,
    priority: 'High' as const,
    sameSite: 'Strict' as const,
    secure: usesHttps(c)
  };
}

export function getRefreshCookie(c: Context) {
  return getCookie(c, REFRESH_COOKIE_NAME);
}

export function setRefreshCookie(c: Context, credential: string, expiresAt: number) {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = Math.max(0, expiresAt - now);
  setCookie(c, REFRESH_COOKIE_NAME, credential, getCookieOptions(c, maxAge));
}

export function clearRefreshCookie(c: Context) {
  setCookie(c, REFRESH_COOKIE_NAME, '', {
    ...getCookieOptions(c),
    expires: new Date(0),
    maxAge: 0
  });
}
