import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { badRequest } from '../utils/errors';

type Target = 'body' | 'params' | 'query';
/** Parses and replaces req[target] with the validated (and coerced/trimmed) data, or rejects with a 400. */
export const validate = (schema: ZodSchema, target: Target = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) return next(badRequest('Please check the highlighted fields.', result.error.flatten().fieldErrors));
    (req as any)[target] = result.data;
    next();
  };
