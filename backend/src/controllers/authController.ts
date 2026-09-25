import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as authService from '../services/authService';
import { one } from '../db/pool';
import { unauthorized } from '../utils/errors';

const meta = (req: Request) => ({ userAgent: req.headers['user-agent'], ip: req.ip });

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, meta(req));
  res.status(201).json(result);
});
export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, meta(req));
  res.json(result);
});
export const refresh = asyncHandler(async (req, res) => {
  const tokens = await authService.refresh(req.body.refreshToken, meta(req));
  res.json({ tokens });
});
export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.auth!.sessionId, req.auth!.userId);
  res.status(204).end();
});
export const logoutAllOthers = asyncHandler(async (req, res) => {
  await authService.logoutAllOtherSessions(req.auth!.userId, req.auth!.sessionId);
  res.status(204).end();
});
export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await one('select id, email, name, phone, role from users where id = $1', [req.auth!.userId]);
  if (!user) throw unauthorized();
  res.json({ user });
});
export const updateMe = asyncHandler(async (req, res) => {
  const user = await authService.updateMe(req.auth!.userId, req.body);
  res.json({ user });
});
export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.auth!.userId, req.body.currentPassword, req.body.newPassword);
  res.status(204).end();
});
export const deleteMe = asyncHandler(async (req, res) => {
  await authService.deleteMe(req.auth!.userId);
  res.status(204).end();
});
