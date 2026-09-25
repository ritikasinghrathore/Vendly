export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = 'AppError';
  }
}
export const badRequest = (msg: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', msg, details);
export const unauthorized = (msg = 'Please sign in to continue.') => new AppError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'You do not have permission to do that.') => new AppError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'We could not find that.') => new AppError(404, 'NOT_FOUND', msg);
export const conflict = (msg: string, details?: unknown) => new AppError(409, 'CONFLICT', msg, details);
export const subscriptionRequired = (details: unknown) =>
  new AppError(402, 'SUBSCRIPTION_REQUIRED', 'An active Vendly Shopkeeper Pro subscription is required for this.', details);
export const tooMany = (msg = 'Too many attempts. Please try again later.') => new AppError(429, 'RATE_LIMITED', msg);
