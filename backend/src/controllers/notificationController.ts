import { asyncHandler } from '../utils/asyncHandler';
import * as notificationService from '../services/notificationService';

export const list = asyncHandler(async (req, res) => res.json({ notifications: await notificationService.list(req.auth!.userId) }));
export const unreadCount = asyncHandler(async (req, res) => res.json({ count: (await notificationService.unreadCount(req.auth!.userId))?.count ?? 0 }));
export const markAllRead = asyncHandler(async (req, res) => { await notificationService.markAllRead(req.auth!.userId); res.status(204).end(); });
