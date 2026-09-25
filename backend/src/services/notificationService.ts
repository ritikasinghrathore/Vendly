import * as notificationRepo from '../repositories/notificationRepo';

export const list = (userId: string) => notificationRepo.listNotificationsForUser(userId);
export const unreadCount = (userId: string) => notificationRepo.unreadCountForUser(userId);
export const markAllRead = (userId: string) => notificationRepo.markAllRead(userId);
