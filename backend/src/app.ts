import express from 'express';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { corsMiddleware, securityHeaders } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiV1 } from './routes';
import { mockCheckoutRouter } from './routes/mockCheckout';

export function createApp() {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  // The `verify` hook captures the exact bytes received (before JSON parsing) as req.rawBody, which
  // the webhook controller signs against - Razorpay's signature covers the raw request body, and
  // parsing/re-serializing JSON is not guaranteed to reproduce those exact bytes.
  app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buf) => { (req as any).rawBody = Buffer.from(buf); },
  }));

  app.get('/health', (_req, res) => res.json({ ok: true, name: 'vendly-api', env: env.NODE_ENV }));

  if (env.PAYMENT_PROVIDER === 'mock') app.use(mockCheckoutRouter);

  app.use('/api/v1', apiV1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
