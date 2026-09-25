import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { loadShopMembership } from '../middleware/shop';
import { requireActiveSubscription } from '../middleware/subscription';
import { validate } from '../middleware/validate';
import { adjustStockSchema, createProductSchema, updateProductSchema } from '../validators/products';
import * as ctrl from '../controllers/productController';

export const categoryRoutes = Router();
categoryRoutes.get('/', requireAuth, ctrl.categories);

export const productSearchRoutes = Router();
productSearchRoutes.get('/', requireAuth, ctrl.search);

/** Mounted at /api/v1/shops/:shopId/products */
export const shopProductRoutes = Router({ mergeParams: true });
shopProductRoutes.use(requireAuth);
shopProductRoutes.get('/', ctrl.list);                    // any signed-in user can browse a shop's products
shopProductRoutes.get('/:productId', ctrl.getOne);
shopProductRoutes.post('/', requireRole('shopkeeper'), loadShopMembership, requireActiveSubscription, validate(createProductSchema), ctrl.create);
shopProductRoutes.patch('/:productId', requireRole('shopkeeper'), loadShopMembership, requireActiveSubscription, validate(updateProductSchema), ctrl.update);
shopProductRoutes.post('/:productId/stock', requireRole('shopkeeper'), loadShopMembership, requireActiveSubscription, validate(adjustStockSchema), ctrl.adjustStock);
