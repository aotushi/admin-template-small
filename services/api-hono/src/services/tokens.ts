import { sign, verify } from 'hono/jwt';
import type { UserPayload } from '../middlewares/permissions';

export type AuthTokenType = 'access' | 'refresh';

export interface AuthTokenPayload extends UserPayload {
  exp: number;
  iat: number;
  tokenType: AuthTokenType;
}

export interface AuthTokenPair {
  accessToken: string;
  expires: string;
  refreshExpires: string;
  refreshToken: string;
  tokenType: 'Bearer';
}

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const JWT_ALGORITHM = 'HS256';

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

function toIsoExpiration(exp: number) {
  return new Date(exp * 1000).toISOString();
}

export function createUserPayload(user: {
  admin_level?: null | string;
  created_by?: null | number;
  id: number;
  role: string;
  username: string;
}): UserPayload {
  return {
    admin_level: user.admin_level,
    created_by: user.created_by,
    id: user.id,
    role: user.role,
    username: user.username
  };
}

function createTokenPayload(
  user: UserPayload,
  tokenType: AuthTokenType,
  ttlSeconds: number
): AuthTokenPayload {
  const iat = nowInSeconds();

  return {
    ...user,
    exp: iat + ttlSeconds,
    iat,
    tokenType
  };
}

export async function createAuthTokenPair(
  user: UserPayload,
  secret: string
): Promise<AuthTokenPair> {
  const accessPayload = createTokenPayload(
    user,
    'access',
    ACCESS_TOKEN_TTL_SECONDS
  );
  const refreshPayload = createTokenPayload(
    user,
    'refresh',
    REFRESH_TOKEN_TTL_SECONDS
  );

  const [accessToken, refreshToken] = await Promise.all([
    sign(accessPayload, secret, JWT_ALGORITHM),
    sign(refreshPayload, secret, JWT_ALGORITHM)
  ]);

  return {
    accessToken,
    expires: toIsoExpiration(accessPayload.exp),
    refreshExpires: toIsoExpiration(refreshPayload.exp),
    refreshToken,
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

  if (!tokenPayload.id || !tokenPayload.username || !tokenPayload.role) {
    throw new Error('Invalid token subject');
  }
}

export async function verifyAuthToken(
  token: string,
  secret: string,
  expectedType: AuthTokenType
) {
  const payload = await verify(token, secret, JWT_ALGORITHM);
  assertTokenPayload(payload, expectedType);
  return payload;
}
