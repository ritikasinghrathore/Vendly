import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { loadShopMembership } from '../middleware/shop';
import { requireActiveSubscription } from '../middleware/subscription';
import { validate } from '../middleware/validate';
import { setListItemSchema, setListNotesSchema } from '../validators/lists';
import * as ctrl from '../controllers/listController';

/** Mounted at /api/v1/lists - cross-shop, keyed by the list's own id. */
export const listRoutes = Router();
listRoutes.use(requireAuth);
listRoutes.get('/mine', requireRole('customer'), ctrl.myLists);
listRoutes.get('/:listId', ctrl.getOne); // service checks the caller may see it
listRoutes.patch('/:listId/notes', requireRole('customer'), validate(setListNotesSchema), ctrl.setNotes);
listRoutes.delete('/:listId', requireRole('customer'), ctrl.discard);
listRoutes.post('/:listId/submit', requireRole('customer'), ctrl.submit);

/** Mounted at /api/v1/shops/:shopId/lists */
export const shopListRoutes = Router({ mergeParams: true });
shopListRoutes.use(requireAuth);
shopListRoutes.get('/draft', requireRole('customer'), ctrl.myDraft);
shopListRoutes.put('/draft/items', requireRole('customer'), validate(setListItemSchema), ctrl.setItem);
shopListRoutes.get('/incoming', requireRole('shopkeeper'), loadShopMembership, requireActiveSubscription, ctrl.incoming);
shopListRoutes.post('/:listId/view', requireRole('shopkeeper'), loadShopMembership, requireActiveSubscription, ctrl.markViewed);
