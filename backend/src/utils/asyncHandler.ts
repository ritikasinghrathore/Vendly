import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Lets a route handler be `async`; any rejected promise or thrown error is forwarded to the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
