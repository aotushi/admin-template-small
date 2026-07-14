const TOKEN_BYTES = 32;

export const REFRESH_SESSION_IDLE_TTL_SECONDS = 7 * 24 * 60 * 60;
export const REFRESH_SESSION_ABSOLUTE_TTL_SECONDS = 30 * 24 * 60 * 60;
// 轮换宽限期：旧凭证在被轮换后的这段时间内重放，视为“响应丢失重试”而非攻击。
export const REFRESH_ROTATION_GRACE_SECONDS = 60;

interface RefreshSessionRecord {
  absolute_expires_at: number;
  expires_at: number;
  family_id: string;
  id: string;
  replaced_by: null | string;
  revoke_reason: null | string;
  revoked_at: null | number;
  token_hash: string;
  user_id: number;
}

export interface RefreshSessionResult {
  absoluteExpiresAt: number;
  credential: string;
  expiresAt: number;
  familyId: string;
  id: string;
  userId: number;
}

export class RefreshSessionError extends Error {
  constructor(public readonly code: 'expired' | 'invalid' | 'replayed' | 'revoked') {
    super(code);
    this.name = 'RefreshSessionError';
  }
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function createCredential(id: string) {
  const secret = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return `${id}.${bytesToHex(secret)}`;
}

function readCredentialId(credential: string) {
  const [id, secret, extra] = credential.split('.');

  if (!id || !secret || extra || !/^[a-f0-9]{64}$/i.test(secret)) {
    throw new RefreshSessionError('invalid');
  }

  return id;
}

async function hashCredential(credential: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credential));
  return bytesToHex(new Uint8Array(digest));
}

function buildRefreshSession(
  userId: number,
  options: {
    absoluteExpiresAt?: number;
    familyId?: string;
    parentId?: string;
  } = {}
) {
  const id = crypto.randomUUID();
  const now = nowInSeconds();
  const absoluteExpiresAt =
    options.absoluteExpiresAt ?? now + REFRESH_SESSION_ABSOLUTE_TTL_SECONDS;

  return {
    absoluteExpiresAt,
    credential: createCredential(id),
    expiresAt: Math.min(now + REFRESH_SESSION_IDLE_TTL_SECONDS, absoluteExpiresAt),
    familyId: options.familyId ?? id,
    id,
    parentId: options.parentId ?? null,
    userId,
    createdAt: now
  };
}

async function insertRefreshSession(
  db: D1Database,
  session: ReturnType<typeof buildRefreshSession>
) {
  const tokenHash = await hashCredential(session.credential);

  await db
    .prepare(
      `INSERT INTO refresh_sessions (
        id, family_id, parent_id, user_id, token_hash,
        expires_at, absolute_expires_at, created_at, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      session.id,
      session.familyId,
      session.parentId,
      session.userId,
      tokenHash,
      session.expiresAt,
      session.absoluteExpiresAt,
      session.createdAt,
      session.createdAt
    )
    .run();
}

function toRefreshSessionResult(
  session: ReturnType<typeof buildRefreshSession>
): RefreshSessionResult {
  return {
    absoluteExpiresAt: session.absoluteExpiresAt,
    credential: session.credential,
    expiresAt: session.expiresAt,
    familyId: session.familyId,
    id: session.id,
    userId: session.userId
  };
}

export async function createRefreshSession(db: D1Database, userId: number) {
  const session = buildRefreshSession(userId);
  await insertRefreshSession(db, session);
  return toRefreshSessionResult(session);
}

async function findRefreshSession(db: D1Database, credential: string) {
  const id = readCredentialId(credential);
  const tokenHash = await hashCredential(credential);

  return db
    .prepare(
      `SELECT id, family_id, user_id, token_hash, expires_at, absolute_expires_at,
              revoked_at, revoke_reason, replaced_by
       FROM refresh_sessions
       WHERE id = ? AND token_hash = ?`
    )
    .bind(id, tokenHash)
    .first<RefreshSessionRecord>();
}

function findSessionById(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT id, family_id, user_id, token_hash, expires_at, absolute_expires_at,
              revoked_at, revoke_reason, replaced_by
       FROM refresh_sessions
       WHERE id = ?`
    )
    .bind(id)
    .first<RefreshSessionRecord>();
}

export async function revokeRefreshFamily(
  db: D1Database,
  familyId: string,
  reason: string
) {
  const now = nowInSeconds();

  await db
    .prepare(
      `UPDATE refresh_sessions
       SET revoked_at = COALESCE(revoked_at, ?), revoke_reason = COALESCE(revoke_reason, ?)
       WHERE family_id = ? AND revoked_at IS NULL`
    )
    .bind(now, reason, familyId)
    .run();
}

export async function revokeRefreshSessionsForUser(
  db: D1Database,
  userId: number,
  reason: string
) {
  const now = nowInSeconds();

  await db
    .prepare(
      `UPDATE refresh_sessions
       SET revoked_at = COALESCE(revoked_at, ?), revoke_reason = COALESCE(revoke_reason, ?)
       WHERE user_id = ? AND revoked_at IS NULL`
    )
    .bind(now, reason, userId)
    .run();
}

// 宽限期重发：旧凭证刚被轮换（网络丢包重试、Web Locks 缺失的并发刷新）时，
// 为同家族补发一个新会话，而不是把整个家族当作被盗撤销。
async function reissueWithinRotationGrace(
  db: D1Database,
  current: RefreshSessionRecord,
  now: number
) {
  if (
    current.revoke_reason !== 'rotated' ||
    current.revoked_at === null ||
    !current.replaced_by ||
    now - current.revoked_at > REFRESH_ROTATION_GRACE_SECONDS ||
    current.absolute_expires_at <= now
  ) {
    return null;
  }

  // 直接后继必须仍然存活：家族已整体撤销（如 logout）后旧凭证不允许复活。
  const successor = await findSessionById(db, current.replaced_by);
  if (!successor || successor.revoked_at !== null) {
    return null;
  }

  // parentId 留空以绕过轮换校验触发器：宽限补发不是父子轮换，是同家族兄弟会话。
  const reissued = buildRefreshSession(current.user_id, {
    absoluteExpiresAt: current.absolute_expires_at,
    familyId: current.family_id
  });
  await insertRefreshSession(db, reissued);
  return toRefreshSessionResult(reissued);
}

export async function rotateRefreshSession(db: D1Database, credential: string) {
  const current = await findRefreshSession(db, credential);

  if (!current) {
    throw new RefreshSessionError('invalid');
  }

  if (current.replaced_by) {
    const reissued = await reissueWithinRotationGrace(db, current, nowInSeconds());
    if (reissued) {
      return reissued;
    }

    await revokeRefreshFamily(db, current.family_id, 'refresh-token-replay');
    throw new RefreshSessionError('replayed');
  }

  if (current.revoked_at !== null) {
    throw new RefreshSessionError('revoked');
  }

  const now = nowInSeconds();
  if (current.expires_at <= now || current.absolute_expires_at <= now) {
    await revokeRefreshFamily(db, current.family_id, 'expired');
    throw new RefreshSessionError('expired');
  }

  const next = buildRefreshSession(current.user_id, {
    absoluteExpiresAt: current.absolute_expires_at,
    familyId: current.family_id,
    parentId: current.id
  });
  const nextTokenHash = await hashCredential(next.credential);

  try {
    await db.batch([
      db
        .prepare(
          `UPDATE refresh_sessions
           SET revoked_at = ?, replaced_by = ?, revoke_reason = 'rotated', last_used_at = ?
           WHERE id = ? AND token_hash = ? AND revoked_at IS NULL AND replaced_by IS NULL`
        )
        .bind(now, next.id, now, current.id, current.token_hash),
      db
        .prepare(
          `INSERT INTO refresh_sessions (
            id, family_id, parent_id, user_id, token_hash,
            expires_at, absolute_expires_at, created_at, last_used_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          next.id,
          next.familyId,
          next.parentId,
          next.userId,
          nextTokenHash,
          next.expiresAt,
          next.absoluteExpiresAt,
          next.createdAt,
          next.createdAt
        )
    ]);
  } catch (error) {
    const latest = await findRefreshSession(db, credential);

    if (latest && (latest.revoked_at !== null || latest.replaced_by)) {
      // 并发轮换竞争失败的一方走同样的宽限判断，多标签页同时刷新不误杀家族。
      const reissued = await reissueWithinRotationGrace(db, latest, nowInSeconds());
      if (reissued) {
        return reissued;
      }

      await revokeRefreshFamily(db, current.family_id, 'refresh-token-replay');
      throw new RefreshSessionError('replayed');
    }

    throw error;
  }

  return toRefreshSessionResult(next);
}

export async function revokeRefreshSession(
  db: D1Database,
  credential: string,
  reason = 'logout'
) {
  let session: RefreshSessionRecord | null;

  try {
    session = await findRefreshSession(db, credential);
  } catch (error) {
    if (error instanceof RefreshSessionError) {
      return;
    }
    throw error;
  }

  if (session) {
    await revokeRefreshFamily(db, session.family_id, reason);
  }
}
