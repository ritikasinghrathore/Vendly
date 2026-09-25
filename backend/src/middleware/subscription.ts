import type { NextFunction, Request, Response } from 'express';
import { one } from '../db/pool';
import { subscriptionRequired } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * The single source of truth for "does this shop's management access work right now":
 * access_until is set only from verified payment-provider webhooks (see subscriptionService),
 * never by the mobile app. A lapsed shop keeps every row in the database; it just cannot
 * call the management endpoints behind this gate until it renews.
 */
export const requireActiveSubscription = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const sub = await one<{ status: string; access_until: string | null }>(
    'select status, access_until from subscriptions where shop_id = $1', [req.shop!.id],
  );
  const hasAccess = !!sub?.access_until && new Date(sub.access_until) > new Date();
  if (!hasAccess) throw subscriptionRequired({ status: sub?.status ?? 'incomplete', accessUntil: sub?.access_until ?? null });
  next();
});
