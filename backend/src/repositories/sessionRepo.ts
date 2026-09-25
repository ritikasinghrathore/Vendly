import { one, query, type Db } from '../db/pool';

export const createSession = (p: { userId: string; expiresAt: Date; userAgent?: string; ip?: string }, db?: Db) =>
  one<{ id: string }>('insert into sessions (user_id, expires_at, user_agent, ip) values ($1,$2,$3,$4) returning id',
    [p.userId, p.expiresAt.toISOString(), p.userAgent ?? null, p.ip ?? null], db);
export const touchSession = (id: string, db?: Db) => query('update sessions set last_used_at = now() where id = $1', [id], db);
export const revokeSession = (id: string, userId: string, db?: Db) =>
  query('update sessions set revoked_at = now() where id = $1 and user_id = $2 and revoked_at is null', [id, userId], db);
/** Used only when the server itself detects a problem (e.g. a reused refresh token) before any user identity is trusted. */
export const revokeSessionById = (id: string, db?: Db) =>
  query('update sessions set revoked_at = now() where id = $1 and revoked_at is null', [id], db);
export const findSessionById = (id: string, db?: Db) =>
  one<{ user_id: string; revoked_at: string | null }>('select user_id, revoked_at from sessions where id = $1', [id], db);
export const revokeAllOtherSessions = (userId: string, exceptSessionId: string, db?: Db) =>
  query('update sessions set revoked_at = now() where user_id = $1 and revoked_at is null and id is distinct from $2', [userId, exceptSessionId], db);

export const insertRefreshToken = (p: { sessionId: string; tokenHash: string; expiresAt: Date }, db?: Db) =>
  query('insert into refresh_tokens (session_id, token_hash, expires_at) values ($1,$2,$3)', [p.sessionId, p.tokenHash, p.expiresAt.toISOString()], db);
export const findRefreshToken = (tokenHash: string, db?: Db) =>
  one<{ id: string; session_id: string; expires_at: string; used_at: string | null }>('select * from refresh_tokens where token_hash = $1', [tokenHash], db);
export const markRefreshTokenUsed = (id: string, db?: Db) => query('update refresh_tokens set used_at = now() where id = $1', [id], db);
