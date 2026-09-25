import * as shopRepo from '../repositories/shopRepo';
import { withTx } from '../db/pool';
import { hashPassword, verifyPassword } from '../auth/password';
import { hashToken, newRefreshToken, signAccessToken } from '../auth/tokens';
import * as userRepo from '../repositories/userRepo';
import * as sessionRepo from '../repositories/sessionRepo';
import { env } from '../config/env';
import { conflict, unauthorized } from '../utils/errors';
import { MAX_LOGIN_FAILURES, LOGIN_LOCK_MINUTES } from '../config/constants';

export interface AuthedUser { id: string; email: string; name: string; phone: string | null; role: 'customer' | 'shopkeeper' }
export interface TokenPair { accessToken: string; refreshToken: string }

const toPublic = (u: userRepo.UserRow): AuthedUser => ({ id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role });

async function issueTokens(userId: string, role: 'customer' | 'shopkeeper', meta: { userAgent?: string; ip?: string }): Promise<TokenPair> {
  return withTx(async (tx) => {
    const session = await sessionRepo.createSession(
      { userId, expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000), userAgent: meta.userAgent, ip: meta.ip }, tx,
    );
    const { token, hash } = newRefreshToken();
    await sessionRepo.insertRefreshToken({ sessionId: session!.id, tokenHash: hash, expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000) }, tx);
    const accessToken = signAccessToken({ sub: userId, role, sid: session!.id });
    return { accessToken, refreshToken: token };
  });
}

export async function register(input: { name: string; email: string; password: string; role: 'customer' | 'shopkeeper'; phone?: string }, meta: { userAgent?: string; ip?: string }) {
  const existing = await userRepo.findByEmail(input.email);
  if (existing) throw conflict('An account with this email already exists.');
  const passwordHash = await hashPassword(input.password);
  const user = await userRepo.createUser({ email: input.email, passwordHash, name: input.name, phone: input.phone, role: input.role });
  const tokens = await issueTokens(user!.id, user!.role, meta);
  return { user: toPublic(user!), tokens };
}

export async function login(input: { email: string; password: string }, meta: { userAgent?: string; ip?: string }) {
  const user = await userRepo.findByEmail(input.email);
  // Same generic message whether the email is unknown or the password is wrong - never confirm which emails are registered.
  const fail = () => unauthorized('Incorrect email or password.');
  if (!user || !user.is_active) throw fail();
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    throw unauthorized(`Too many attempts. Please try again after ${new Date(user.locked_until).toLocaleTimeString()}.`);
  }
  const ok = await verifyPassword(user.password_hash, input.password);
  if (!ok) {
    const failures = user.failed_logins + 1;
    const lockUntil = failures >= MAX_LOGIN_FAILURES ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000).toISOString() : null;
    await userRepo.recordLoginFailure(user.id, lockUntil);
    throw fail();
  }
  await userRepo.recordLoginSuccess(user.id);
  const tokens = await issueTokens(user.id, user.role, meta);
  return { user: toPublic(user), tokens };
}

export async function refresh(refreshToken: string, meta: { userAgent?: string; ip?: string }): Promise<TokenPair> {
  const hash = hashToken(refreshToken);
  return withTx(async (tx) => {
    const row = await sessionRepo.findRefreshToken(hash, tx);
    if (!row || new Date(row.expires_at) < new Date()) throw unauthorized('Your session has expired. Please sign in again.');
    if (row.used_at) {
      // A used (already-rotated) token was presented again: possible theft/replay. Log the whole session out.
      await sessionRepo.revokeSessionById(row.session_id, tx);
      throw unauthorized('This session was ended for your security. Please sign in again.');
    }
    const s = await sessionRepo.findSessionById(row.session_id, tx);
    if (!s || s.revoked_at) throw unauthorized('Your session has expired. Please sign in again.');
    const user = await userRepo.findById(s.user_id, tx);
    if (!user || !user.is_active) throw unauthorized('This account is no longer active.');

    await sessionRepo.markRefreshTokenUsed(row.id, tx);
    const next = newRefreshToken();
    await sessionRepo.insertRefreshToken({ sessionId: row.session_id, tokenHash: next.hash, expiresAt: new Date(row.expires_at) }, tx);
    await sessionRepo.touchSession(row.session_id, tx);
    const accessToken = signAccessToken({ sub: user.id, role: user.role, sid: row.session_id });
    return { accessToken, refreshToken: next.token };
  });
}

export const logout = (sessionId: string, userId: string) => sessionRepo.revokeSession(sessionId, userId);
export const logoutAllOtherSessions = (userId: string, currentSessionId: string) => sessionRepo.revokeAllOtherSessions(userId, currentSessionId);

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await userRepo.findById(userId);
  if (!user) throw unauthorized();
  const ok = await verifyPassword(user.password_hash, currentPassword);
  if (!ok) throw unauthorized('Your current password is incorrect.');
  await userRepo.updatePasswordHash(userId, await hashPassword(newPassword));
}
export async function updateMe(userId: string, patch: { name?: string; phone?: string | null }) {
  const user = await userRepo.updateProfile(userId, patch);
  return toPublic(user!);
}

/** Customers can remove themselves. A shopkeeper must contact support first: their shop holds bills
    and khata records for their customers that must be kept, so the account cannot simply vanish. */
export async function deleteMe(userId: string) {
  const user = await userRepo.findById(userId);
  if (!user) throw unauthorized();
  if (user.role === 'shopkeeper') {
    const owns = await shopRepo.countShopsOwnedBy(userId);
    if ((owns?.count ?? 0) > 0) {
      throw conflict('Shop accounts hold billing records that must be kept. Please contact support to close your shop.');
    }
  }
  await userRepo.deactivateUser(userId);
  await sessionRepo.revokeAllOtherSessions(userId, '00000000-0000-0000-0000-000000000000');
}
export const toPublicUser = toPublic;
