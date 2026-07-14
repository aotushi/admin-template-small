import { AUTH_ERROR_CODES } from '@admin-backend-3/admin-api-contract/auth';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authMiddleware } from './auth';
import { createAccessToken } from '../services/tokens';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

function createDatabase(
  user: null | Record<string, unknown>,
  onRun?: (parameters: unknown[], statement: string) => void
) {
  return {
    prepare(statement: string) {
      return {
        bind(...parameters: unknown[]) {
          return {
            async first() {
              return user;
            },
            async run() {
              onRun?.(parameters, statement);
              return { success: true };
            }
          };
        }
      };
    }
  } as unknown as D1Database;
}

function createApp(
  user: null | Record<string, unknown> = null,
  onRun?: (parameters: unknown[], statement: string) => void
) {
  const app = new Hono();
  app.use('*', authMiddleware);
  app.get('/', c => c.json({ success: true }));

  return {
    request(headers: HeadersInit = {}) {
      return app.request(
        'http://localhost/',
        { headers },
        {
          DB: createDatabase(user, onRun),
          JWT_SECRET
        }
      );
    }
  };
}

async function createToken() {
  return (
    await createAccessToken(
      {
        id: 1,
        role: 'admin',
        username: 'vben'
      },
      JWT_SECRET
    )
  ).accessToken;
}

describe('authMiddleware', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an explicit challenge when the access token is missing', async () => {
    const response = await createApp().request();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer realm="admin-api"');
    expect(await response.json()).toMatchObject({
      code: AUTH_ERROR_CODES.authRequired,
      success: false
    });
  });

  it('distinguishes an expired access token from an invalid token', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T00:00:00.000Z'));
    const token = await createToken();
    vi.setSystemTime(new Date('2026-07-14T00:16:00.000Z'));

    const response = await createApp().request({ Authorization: `Bearer ${token}` });

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain('error="invalid_token"');
    expect(await response.json()).toMatchObject({
      code: AUTH_ERROR_CODES.accessTokenExpired,
      success: false
    });
  });

  it('issues unique access tokens even when they are created in the same second', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T00:00:00.000Z'));

    const first = await createToken();
    const second = await createToken();

    expect(second).not.toBe(first);
  });

  it('rejects malformed access tokens without marking them as expired', async () => {
    const response = await createApp().request({ Authorization: 'Bearer invalid-token' });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: AUTH_ERROR_CODES.accessTokenInvalid,
      success: false
    });
  });

  it('rejects disabled accounts after validating the access token', async () => {
    const token = await createToken();
    const onRun = vi.fn();
    const response = await createApp({
      admin_level: 'super',
      created_by: null,
      id: 1,
      is_active: 0,
      role: 'admin',
      username: 'vben'
    }, onRun).request({ Authorization: `Bearer ${token}` });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      code: AUTH_ERROR_CODES.accountUnavailable,
      success: false
    });
    expect(onRun).toHaveBeenCalledWith(
      expect.arrayContaining([1, 'account-unavailable']),
      expect.stringContaining('UPDATE refresh_sessions')
    );
  });

  it('accepts an active user', async () => {
    const token = await createToken();
    const response = await createApp({
      admin_level: 'super',
      created_by: null,
      id: 1,
      is_active: 1,
      role: 'admin',
      username: 'vben'
    }).request({ Authorization: `Bearer ${token}` });

    expect(response.status).toBe(200);
  });
});
