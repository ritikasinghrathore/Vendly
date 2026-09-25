import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { loadShopMembership } from '../middleware/shop';
import { requireActiveSubscription } from '../middleware/subscription';
import { validate } from '../middleware/validate';
import { createShopSchema, updateShopSchema } from '../validators/shops';
import * as ctrl from '../controllers/shopController';
import { shopProductRoutes } from './productRoutes';
import { shopListRoutes } from './listRoutes';
import { shopBillingRoutes } from './billingRoutes';

// A single router mounted once at /shops. Express matches routes in the order they are registered
// WITHIN one router, so every literal and exact path below is registered before the broad ":shopId"
// prefix mounts at the bottom - otherwise ":shopId" would swallow "/mine" (matching it as a shop id)
// before Express ever got a chance to try the literal route.
export const shopRoutes = Router();
shopRoutes.use(requireAuth);

// ---- literal paths ----
shopRoutes.get('/', ctrl.browse);
shopRoutes.post('/', requireRole('shopkeeper'), validate(createShopSchema), ctrl.create);
shopRoutes.get('/mine', requireRole('shopkeeper'), ctrl.myShops);

// ---- exact :shopId paths (editing shop details is part of setup and never subscription-gated) ----
shopRoutes.get('/:shopId', ctrl.getOne);
shopRoutes.patch('/:shopId', requireRole('shopkeeper'), loadShopMembership, validate(updateShopSchema), ctrl.update);
shopRoutes.get('/:shopId/dashboard', requireRole('shopkeeper'), loadShopMembership, requireActiveSubscription, ctrl.dashboard);
shopRoutes.get('/:shopId/sales-summary', requireRole('shopkeeper'), loadShopMembership, requireActiveSubscription, ctrl.salesSummary);
// Subscription endpoints need membership alone - this is how a shop GETS access in the first place.
shopRoutes.get('/:shopId/subscription', requireRole('shopkeeper'), loadShopMembership, ctrl.subscriptionStatus);
shopRoutes.post('/:shopId/subscription/checkout', requireRole('shopkeeper'), loadShopMembership, ctrl.startCheckout);
shopRoutes.post('/:shopId/subscription/cancel', requireRole('shopkeeper'), loadShopMembership, ctrl.cancelSubscription);

// ---- nested sub-resources (each does its own auth/role/membership/subscription checks) ----
shopRoutes.use('/:shopId/products', shopProductRoutes);
shopRoutes.use('/:shopId/lists', shopListRoutes);
// Broadest prefix last: only requests that matched nothing more specific above reach shopBillingRoutes.
shopRoutes.use('/:shopId', shopBillingRoutes); // /customers, /bills, /customers/:id/payments, /adjustments
