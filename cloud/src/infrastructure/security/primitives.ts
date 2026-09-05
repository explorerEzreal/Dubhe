import crypto from 'node:crypto';
import argon2 from 'argon2';

const base64Url = (value: string) => Buffer.from(value).toString('base64url');

export async function hashPassword(value: string): Promise<string> {
  try {
    return await argon2.hash(value);
  } catch (error) {
    throw error;
  }
}

export async function verifyPassword(
  hash: string,
  value: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, value);
  } catch {
    return false;
  }
}

export function digest(value: string, pepper: string): string {
  return crypto.createHmac('sha256', pepper).update(value).digest('hex');
}

export function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  ttlSeconds = 3600,
): string {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const issuedAt = Math.floor(Date.now() / 1000);
  const body = base64Url(
    JSON.stringify({
      ...payload,
      jti: payload.jti ?? crypto.randomUUID(),
      iat: issuedAt,
      exp: issuedAt + ttlSeconds,
    }),
  );
  const data = `${header}.${body}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

export function verifyJwt(
  token: string,
  secret: string,
): Record<string, unknown> | null {
  try {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    const decodedHeader = JSON.parse(
      Buffer.from(header, 'base64url').toString(),
    ) as Record<string, unknown>;
    if (decodedHeader.alg !== 'HS256' || decodedHeader.typ !== 'JWT') {
      return null;
    }
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      return null;
    }
    const value = JSON.parse(
      Buffer.from(body, 'base64url').toString(),
    ) as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    return Number.isFinite(Number(value.exp)) && Number(value.exp) > now
      ? value
      : null;
  } catch {
    return null;
  }
}

export function randomToken(prefix: string): string {
  return `${prefix}${crypto.randomBytes(24).toString('base64url')}`;
}
