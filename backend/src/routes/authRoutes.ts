import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authLimiter } from '../middleware/security';
import { changePasswordSchema, loginSchema, refreshSchema, registerSchema, updateMeSchema } from '../validators/auth';
import * as ctrl from '../controllers/authController';

export const authRoutes = Router();
authRoutes.post('/register', authLimiter, validate(registerSchema), ctrl.register);
authRoutes.post('/login', authLimiter, validate(loginSchema), ctrl.login);
authRoutes.post('/refresh', authLimiter, validate(refreshSchema), ctrl.refresh);
authRoutes.post('/logout', requireAuth, ctrl.logout);
authRoutes.post('/logout-all-others', requireAuth, ctrl.logoutAllOthers);
authRoutes.get('/me', requireAuth, ctrl.me);
authRoutes.patch('/me', requireAuth, validate(updateMeSchema), ctrl.updateMe);
authRoutes.post('/change-password', requireAuth, authLimiter, validate(changePasswordSchema), ctrl.changePassword);
authRoutes.delete('/me', requireAuth, ctrl.deleteMe);
