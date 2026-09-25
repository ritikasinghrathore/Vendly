import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as ctrl from '../controllers/notificationController';

export const notificationRoutes = Router();
notificationRoutes.use(requireAuth);
notificationRoutes.get('/', ctrl.list);
notificationRoutes.get('/unread-count', ctrl.unreadCount);
notificationRoutes.post('/mark-all-read', ctrl.markAllRead);
