import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const corsMiddleware = cors({
  origin: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((s) => s.trim()) : false,
  credentials: false,
});
export const securityHeaders = helmet();

const rateMessage = { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a bit and try again.' } };
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: rateMessage });
export const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: rateMessage });
export const webhookLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: rateMessage });
