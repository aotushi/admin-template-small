import { sign, verify } from 'hono/jwt';
import type { UserPayload } from '../middlewares/permissions';

export type AuthTokenType = 'access';

/**
 * JWT 只装身份字段：角色/权限每请求由 authMiddleware 从 D1 实时解析，
 * 放进 token 也只是签发瞬间的快照，改角色后会变成误导性的死数据。
 */
export interface TokenSubject {
  id: number;
  username: string;
}

export interface AuthTokenPayload extends TokenSubject {
  [key: string]: unknown;
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  sub: string;
  tokenType: AuthTokenType;
}

export interface AccessTokenResult {
  accessToken: string;
  expires: string;
  tokenType: 'Bearer';
}

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const JWT_ALGORITHM = 'HS256';
const JWT_AUDIENCE = 'admin-backend-3-api';
const JWT_ISSUER = 'admin-backend-3';

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

function toIsoExpiration(exp: number) {
  return new Date(exp * 1000).toISOString();
}

export function createUserPayload(
  user: {
    created_by?: null | number;
    id: number;
    username: string;
  },
  roleCodes: readonly string[]
): UserPayload {
  return {
    created_by: user.created_by,
    id: user.id,
    role_codes: [...roleCodes],
    username: user.username
  };
}

function createTokenPayload(
  subject: TokenSubject,
  tokenType: AuthTokenType,
  ttlSeconds: number
): AuthTokenPayload {
  const iat = nowInSeconds();

  return {
    id: subject.id,
    username: subject.username,
    aud: JWT_AUDIENCE,
    exp: iat + ttlSeconds,
    iat,
    iss: JWT_ISSUER,
    jti: crypto.randomUUID(),
    sub: String(subject.id),
    tokenType
  };
}

export async function createAccessToken(
  subject: TokenSubject,
  secret: string
): Promise<AccessTokenResult> {
  const accessPayload = createTokenPayload(
    subject,
    'access',
    ACCESS_TOKEN_TTL_SECONDS
  );
  const accessToken = await sign(accessPayload, secret, JWT_ALGORITHM);

  return {
    accessToken,
    expires: toIsoExpiration(accessPayload.exp),
    tokenType: 'Bearer'
  };
}

function assertTokenPayload(
  payload: unknown,
  expectedType: AuthTokenType
): asserts payload is AuthTokenPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid token payload');
  }

  const tokenPayload = payload as Partial<AuthTokenPayload>;

  if (tokenPayload.tokenType !== expectedType) {
    throw new Error('Invalid token type');
  }

  if (!tokenPayload.id || !tokenPayload.username) {
    throw new Error('Invalid token subject');
  }
}

export async function verifyAuthToken(
  token: string,
  secret: string,
  expectedType: AuthTokenType
) {
  const payload = await verify(token, secret, {
    alg: JWT_ALGORITHM,
    aud: JWT_AUDIENCE,
    iss: JWT_ISSUER
  });
  assertTokenPayload(payload, expectedType);
  return payload;
}
