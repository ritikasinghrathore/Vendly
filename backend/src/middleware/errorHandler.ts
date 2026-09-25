import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err }, 'request failed');
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  const pg = err as { code?: string };
  if (pg?.code === '23505') return res.status(409).json({ error: { code: 'CONFLICT', message: 'That already exists.' } });
  if (pg?.code === '23514' || pg?.code === '23503' || pg?.code === '22P02') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'One of the values is not valid.' } });
  }
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
}
export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown endpoint.' } });
}
