import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../auth/tokens';
import { one } from '../db/pool';
import { unauthorized, forbidden } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';

/** Verifies the access token AND that its session has not been logged out or expired, so revocation is immediate. */
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();
  let claims;
  try { claims = verifyAccessToken(header.slice(7)); }
  catch { throw unauthorized('Your session has expired. Please sign in again.'); }

  const session = await one<{ id: string; revoked_at: string | null; expires_at: string }>(
    'select id, revoked_at, expires_at from sessions where id = $1 and user_id = $2', [claims.sid, claims.sub],
  );
  if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
    throw unauthorized('Your session has expired. Please sign in again.');
  }
  const user = await one<{ is_active: boolean }>('select is_active from users where id = $1', [claims.sub]);
  if (!user?.is_active) throw unauthorized('This account is no longer active.');

  req.auth = { userId: claims.sub, role: claims.role, sessionId: claims.sid };
  next();
});

export const requireRole = (...roles: Array<'customer' | 'shopkeeper'>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) return next(forbidden(`This action needs a ${roles.join(' or ')} account.`));
    next();
  };
