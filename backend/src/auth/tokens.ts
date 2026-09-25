import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AccessTokenClaims { sub: string; role: 'customer' | 'shopkeeper'; sid: string }

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE });
  return payload as unknown as AccessTokenClaims;
}

/** A refresh token is a random 384-bit string. Only its SHA-256 hash is ever stored, so a stolen database backup cannot be used to log in. */
export function newRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString('base64url');
  return { token, hash: hashToken(token) };
}
export const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');
