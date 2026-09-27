import express from 'express';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { corsMiddleware, securityHeaders } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiV1 } from './routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true, name: 'vendly-api', env: env.NODE_ENV }));

  app.use('/api/v1', apiV1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
