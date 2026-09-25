import pino from 'pino';
import { env, isProd } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie', 'req.headers["x-razorpay-signature"]',
      'password', '*.password', '*.refreshToken', '*.accessToken',
    ],
    remove: true,
  },
  ...(isProd ? {} : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
});
