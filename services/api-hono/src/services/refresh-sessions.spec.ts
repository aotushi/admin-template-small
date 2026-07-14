import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createRefreshSession,
  REFRESH_ROTATION_GRACE_SECONDS,
  RefreshSessionError,
  revokeRefreshSession,
  rotateRefreshSession
} from './refresh-sessions';

interface FakeRow {
  absolute_expires_at: number;
  created_at: number;
  expires_at: number;
  family_id: string;
  id: string;
  last_used_at: number;
  parent_id: null | string;
  replaced_by: null | string;
  revoke_reason: null | string;
  revoked_at: null | number;
  token_hash: string;
  user_id: number;
}

// 内存版 refresh_sessions：按语句特征模拟 D1 行为，
// 包含 017 迁移的轮换校验触发器和 batch 失败整体回滚。
function createFakeDb() {
  let rows: FakeRow[] = [];

  function applyInsert(parameters: unknown[]) {
    const [id, familyId, parentId, userId, tokenHash, expiresAt, absoluteExpiresAt, createdAt] =
      parameters as [string, string, null | string, number, string, number, number, number];

    if (parentId !== null) {
      const parent = rows.find(
        row => row.id === parentId && row.replaced_by === id && row.revoked_at !== null
      );
      if (!parent) {
        throw new Error('invalid refresh session rotation');
      }
    }

    rows.push({
      absolute_expires_at: absoluteExpiresAt,
      created_at: createdAt,
      expires_at: expiresAt,
      family_id: familyId,
      id,
      last_used_at: createdAt,
      parent_id: parentId,
      replaced_by: null,
      revoke_reason: null,
      revoked_at: null,
      token_hash: tokenHash,
      user_id: userId
    });
  }

  function execute(statement: string, parameters: unknown[]) {
    if (statement.includes('INSERT INTO refresh_sessions')) {
      applyInsert(parameters);
      return null;
    }

    if (statement.includes('WHERE id = ? AND token_hash = ?')) {
      const [id, tokenHash] = parameters as [string, string];

      if (statement.includes('SET revoked_at = ?, replaced_by = ?')) {
        const [revokedAt, replacedBy, lastUsedAt] = parameters as [number, string, number];
        const [targetId, targetHash] = parameters.slice(3) as [string, string];
        const row = rows.find(
          candidate =>
            candidate.id === targetId &&
            candidate.token_hash === targetHash &&
            candidate.revoked_at === null &&
            candidate.replaced_by === null
        );
        if (row) {
          row.revoked_at = revokedAt;
          row.replaced_by = replacedBy;
          row.revoke_reason = 'rotated';
          row.last_used_at = lastUsedAt;
        }
        return null;
      }

      return rows.find(row => row.id === id && row.token_hash === tokenHash) ?? null;
    }

    if (statement.includes('WHERE family_id = ? AND revoked_at IS NULL')) {
      const [revokedAt, reason, familyId] = parameters as [number, string, string];
      for (const row of rows) {
        if (row.family_id === familyId && row.revoked_at === null) {
          row.revoked_at = revokedAt;
          row.revoke_reason = row.revoke_reason ?? reason;
        }
      }
      return null;
    }

    if (statement.includes('WHERE id = ?')) {
      const [id] = parameters as [string];
      return rows.find(row => row.id === id) ?? null;
    }

    throw new Error(`unrecognized statement: ${statement}`);
  }

  function prepare(statement: string) {
    return {
      bind(...parameters: unknown[]) {
        return {
          async first() {
            return execute(statement, parameters);
          },
          async run() {
            execute(statement, parameters);
            return { success: true };
          },
          // batch 内部按序执行使用
          __execute() {
            return execute(statement, parameters);
          }
        };
      }
    };
  }

  const db = {
    prepare,
    async batch(statements: Array<{ __execute(): unknown }>) {
      const snapshot = structuredClone(rows);
      try {
        for (const statement of statements) {
          statement.__execute();
        }
      } catch (error) {
        rows = snapshot;
        throw error;
      }
      return statements.map(() => ({ success: true }));
    }
  } as unknown as D1Database;

  return {
    db,
    getRows: () => rows
  };
}

describe('rotateRefreshSession', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rotates a live credential and marks the old session as rotated', async () => {
    const { db, getRows } = createFakeDb();
    const initial = await createRefreshSession(db, 1);

    const next = await rotateRefreshSession(db, initial.credential);

    expect(next.familyId).toBe(initial.familyId);
    expect(next.credential).not.toBe(initial.credential);
    const oldRow = getRows().find(row => row.id === initial.id);
    expect(oldRow?.revoke_reason).toBe('rotated');
    expect(oldRow?.replaced_by).toBe(next.id);
  });

  it('reissues a sibling session when a rotated credential replays within the grace window', async () => {
    const { db, getRows } = createFakeDb();
    const initial = await createRefreshSession(db, 1);
    const rotated = await rotateRefreshSession(db, initial.credential);

    // 宽限期内旧凭证重放：视为响应丢失重试，补发新会话而不撤销家族。
    const reissued = await rotateRefreshSession(db, initial.credential);

    expect(reissued.familyId).toBe(initial.familyId);
    expect(reissued.credential).not.toBe(rotated.credential);
    const successorRow = getRows().find(row => row.id === rotated.id);
    expect(successorRow?.revoked_at).toBeNull();
    expect(getRows().every(row => row.revoke_reason !== 'refresh-token-replay')).toBe(true);
  });

  it('revokes the whole family when a rotated credential replays after the grace window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T00:00:00Z'));
    const { db, getRows } = createFakeDb();
    const initial = await createRefreshSession(db, 1);
    await rotateRefreshSession(db, initial.credential);

    vi.setSystemTime(new Date((REFRESH_ROTATION_GRACE_SECONDS + 1) * 1000 + Date.now()));

    await expect(rotateRefreshSession(db, initial.credential)).rejects.toMatchObject({
      code: 'replayed'
    });
    expect(getRows().every(row => row.revoked_at !== null)).toBe(true);
  });

  it('does not resurrect an old credential after logout even within the grace window', async () => {
    const { db } = createFakeDb();
    const initial = await createRefreshSession(db, 1);
    const rotated = await rotateRefreshSession(db, initial.credential);

    // 用户退出：整个家族撤销，旧凭证的直接后继不再存活。
    await revokeRefreshSession(db, rotated.credential, 'logout');

    await expect(rotateRefreshSession(db, initial.credential)).rejects.toMatchObject({
      code: 'replayed'
    });
  });

  it('lets both concurrent rotations succeed within the same family', async () => {
    const { db, getRows } = createFakeDb();
    const initial = await createRefreshSession(db, 1);

    // 两个标签页同时轮换同一凭证：竞争失败方触发器回滚后走宽限补发。
    const [first, second] = await Promise.all([
      rotateRefreshSession(db, initial.credential),
      rotateRefreshSession(db, initial.credential)
    ]);

    expect(first.familyId).toBe(initial.familyId);
    expect(second.familyId).toBe(initial.familyId);
    expect(first.credential).not.toBe(second.credential);
    expect(getRows().every(row => row.revoke_reason !== 'refresh-token-replay')).toBe(true);
  });

  it('rejects an expired credential', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T00:00:00Z'));
    const { db } = createFakeDb();
    const initial = await createRefreshSession(db, 1);

    vi.setSystemTime(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));

    await expect(rotateRefreshSession(db, initial.credential)).rejects.toBeInstanceOf(
      RefreshSessionError
    );
  });
});
