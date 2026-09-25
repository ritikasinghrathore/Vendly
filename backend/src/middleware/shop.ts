import type { NextFunction, Request, Response } from 'express';
import { one } from '../db/pool';
import { forbidden, notFound } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';

/** Confirms the signed-in shopkeeper actually manages :shopId — never trusts the URL alone. */
export const loadShopMembership = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const shopId = req.params.shopId;
  const membership = await one<{ member_role: 'owner' | 'manager' }>(
    'select member_role from shop_members where shop_id = $1 and user_id = $2', [shopId, req.auth!.userId],
  );
  if (!membership) throw forbidden('You do not manage this shop.');
  const shop = await one<{ is_active: boolean }>('select is_active from shops where id = $1', [shopId]);
  if (!shop) throw notFound('Shop not found.');
  if (!shop.is_active) throw forbidden('This shop has been suspended. Please contact support.');
  req.shop = { id: shopId, memberRole: membership.member_role };
  next();
});
