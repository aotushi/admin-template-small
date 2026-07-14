import type { Context } from 'hono';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5176',
  'http://localhost:8848',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:8848',
  'https://admin.9shi.cc'
];

function getConfiguredOrigins(c: Context) {
  const configured = c.env?.ALLOWED_ORIGINS;

  if (typeof configured !== 'string' || !configured.trim()) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  return configured
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

export function resolveAllowedOrigin(origin: string, c: Context) {
  return getConfiguredOrigins(c).includes(origin) ? origin : undefined;
}

export function isTrustedBrowserOrigin(c: Context) {
  const origin = c.req.header('Origin');

  // Non-browser clients do not send Origin. They still need valid credentials.
  return !origin || Boolean(resolveAllowedOrigin(origin, c));
}
