import { AUTH_ERROR_CODES } from '@admin-backend-3/admin-api-contract/auth';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { rateLimitMiddleware } from './security';

describe('rateLimitMiddleware', () => {
  it('returns a stable error code and retry delay after the limit is reached', async () => {
    const app = new Hono();
    app.use('*', rateLimitMiddleware({ maxRequests: 1, windowMs: 60_000 }));
    app.get('/api/test', c => c.json({ success: true }));
    const headers = { 'X-Forwarded-For': `test-${crypto.randomUUID()}` };

    const first = await app.request('/api/test', { headers });
    const second = await app.request('/api/test', { headers });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(Number(second.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await second.json()).toMatchObject({
      code: AUTH_ERROR_CODES.tooManyRequests,
      success: false
    });
  });
});
