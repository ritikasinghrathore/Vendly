import { Router } from 'express';
import { apiLimiter } from '../middleware/security';
import { authRoutes } from './authRoutes';
import { shopRoutes } from './shopRoutes';
import { categoryRoutes, productSearchRoutes } from './productRoutes';
import { listRoutes } from './listRoutes';
import { billingReadRoutes } from './billingRoutes';
import { notificationRoutes } from './notificationRoutes';
import { imageRoutes } from './imageRoutes';

export const apiV1 = Router();

apiV1.use(apiLimiter);
apiV1.use('/auth', authRoutes);
apiV1.use('/categories', categoryRoutes);
apiV1.use('/products/search', productSearchRoutes);
apiV1.use('/notifications', notificationRoutes);
apiV1.use('/images', imageRoutes);
apiV1.use('/lists', listRoutes);      // /mine, /:listId, /:listId/notes, /:listId/submit
apiV1.use('/', billingReadRoutes);    // /bills/:id, /shop-customers/:id/ledger, /khata/mine
apiV1.use('/shops', shopRoutes);      // /, /mine, /:shopId, /:shopId/products, /:shopId/lists, /:shopId/customers, /:shopId/bills
