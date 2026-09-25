import { Router } from 'express';
import { webhookLimiter } from '../middleware/security';
import * as ctrl from '../controllers/webhookController';

export const webhookRoutes = Router();
webhookRoutes.post('/mock', webhookLimiter, ctrl.handle);
webhookRoutes.post('/razorpay', webhookLimiter, ctrl.handle);
