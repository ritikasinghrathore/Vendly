import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { loadShopMembership } from '../middleware/shop';
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

// ---- exact :shopId paths ----
shopRoutes.get('/:shopId', ctrl.getOne);
shopRoutes.patch('/:shopId', requireRole('shopkeeper'), loadShopMembership, validate(updateShopSchema), ctrl.update);
shopRoutes.get('/:shopId/dashboard', requireRole('shopkeeper'), loadShopMembership, ctrl.dashboard);
shopRoutes.get('/:shopId/sales-summary', requireRole('shopkeeper'), loadShopMembership, ctrl.salesSummary);

// ---- nested sub-resources (each does its own auth/role/membership checks) ----
shopRoutes.use('/:shopId/products', shopProductRoutes);
shopRoutes.use('/:shopId/lists', shopListRoutes);
// Broadest prefix last: only requests that matched nothing more specific above reach shopBillingRoutes.
shopRoutes.use('/:shopId', shopBillingRoutes); // /customers, /bills, /customers/:id/payments, /adjustments
