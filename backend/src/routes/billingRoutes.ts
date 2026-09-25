import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { loadShopMembership } from '../middleware/shop';
import { requireActiveSubscription } from '../middleware/subscription';
import { validate } from '../middleware/validate';
import { createBillSchema, createCustomerSchema, recordAdjustmentSchema, recordPaymentSchema } from '../validators/billing';
import * as ctrl from '../controllers/billingController';

/** Mounted at /api/v1/shops/:shopId - owner-side billing/khata management, all subscription-gated. */
export const shopBillingRoutes = Router({ mergeParams: true });
shopBillingRoutes.use(requireAuth, requireRole('shopkeeper'), loadShopMembership, requireActiveSubscription);
shopBillingRoutes.get('/customers', ctrl.listCustomers);
shopBillingRoutes.get('/customers/search', ctrl.searchCustomers);
shopBillingRoutes.post('/customers', validate(createCustomerSchema), ctrl.addCustomer);
shopBillingRoutes.post('/bills', validate(createBillSchema), ctrl.createBill);
shopBillingRoutes.post('/customers/:shopCustomerId/payments', validate(recordPaymentSchema), ctrl.recordPayment);
shopBillingRoutes.post('/customers/:shopCustomerId/adjustments', validate(recordAdjustmentSchema), ctrl.recordAdjustment);

/** Mounted at /api/v1 - cross-shop reads; the service checks whether THIS caller (owner or the customer themself) may see it. */
export const billingReadRoutes = Router();
billingReadRoutes.use(requireAuth);
billingReadRoutes.get('/bills/:billId', ctrl.getBill);
billingReadRoutes.get('/shop-customers/:shopCustomerId/ledger', ctrl.ledger);
billingReadRoutes.get('/khata/mine', requireRole('customer'), ctrl.myKhata);
