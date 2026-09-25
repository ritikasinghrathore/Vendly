import { asyncHandler } from '../utils/asyncHandler';
import * as listService from '../services/listService';
import { forbidden } from '../utils/errors';

export const myLists = asyncHandler(async (req, res) => res.json({ lists: await listService.myLists(req.auth!.userId) }));
export const myDraft = asyncHandler(async (req, res) => res.json({ draft: await listService.myDraft(req.params.shopId, req.auth!.userId) }));
export const setItem = asyncHandler(async (req, res) => {
  const list = await listService.setItemQuantity(req.params.shopId, req.auth!.userId, req.body.productId, req.body.quantity);
  res.json({ list });
});
export const getOne = asyncHandler(async (req, res) => {
  if (!req.auth) throw forbidden();
  res.json(await listService.getList(req.params.listId, req.auth.userId, req.auth.role));
});
export const setNotes = asyncHandler(async (req, res) => res.json({ list: await listService.setNotes(req.params.listId, req.auth!.userId, req.body.notes) }));
export const discard = asyncHandler(async (req, res) => { await listService.discardDraft(req.params.listId, req.auth!.userId); res.status(204).end(); });
export const submit = asyncHandler(async (req, res) => res.json({ list: await listService.submit(req.params.listId, req.auth!.userId) }));

export const incoming = asyncHandler(async (req, res) => res.json({ lists: await listService.incomingLists(req.shop!.id) }));
export const markViewed = asyncHandler(async (req, res) => res.json({ list: await listService.markViewed(req.params.listId, req.shop!.id) }));
