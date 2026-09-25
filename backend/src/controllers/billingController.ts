import { asyncHandler } from '../utils/asyncHandler';
import * as billingService from '../services/billingService';
import { query } from '../db/pool';
import { forbidden } from '../utils/errors';

const isMember = (userId: string) => async (shopId: string) => {
  const rows = await query('select 1 from shop_members where shop_id = $1 and user_id = $2', [shopId, userId]);
  return rows.length > 0;
};

export const listCustomers = asyncHandler(async (req, res) => res.json({ customers: await billingService.listShopCustomers(req.shop!.id) }));
export const searchCustomers = asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  res.json({ customers: q.trim() ? await billingService.searchShopCustomers(req.shop!.id, q) : [] });
});
export const addCustomer = asyncHandler(async (req, res) => {
  const customer = await billingService.addWalkInCustomer(req.shop!.id, req.auth!.userId, req.body.name, req.body.phone);
  res.status(201).json({ customer });
});
export const createBill = asyncHandler(async (req, res) => {
  const result = await billingService.createBill(req.shop!.id, req.auth!.userId, req.body);
  res.status(201).json(result);
});
export const getBill = asyncHandler(async (req, res) => {
  if (!req.auth) throw forbidden();
  const bill = await billingService.assertCanSeeBill(req.params.billId, req.auth.userId, req.auth.role, isMember(req.auth.userId));
  const { items } = await billingService.getBill(req.params.billId);
  res.json({ bill, items });
});
export const recordPayment = asyncHandler(async (req, res) => {
  const payment = await billingService.recordPayment(req.shop!.id, req.auth!.userId, { ...req.body, shopCustomerId: req.params.shopCustomerId });
  res.status(201).json({ payment });
});
export const recordAdjustment = asyncHandler(async (req, res) => {
  const txn = await billingService.recordAdjustment(req.shop!.id, req.auth!.userId, req.params.shopCustomerId, req.body.amount, req.body.direction, req.body.reason);
  res.status(201).json({ transaction: txn });
});
export const ledger = asyncHandler(async (req, res) => {
  if (!req.auth) throw forbidden();
  res.json(await billingService.getLedger(req.params.shopCustomerId, req.auth.userId, req.auth.role, isMember(req.auth.userId)));
});
export const myKhata = asyncHandler(async (req, res) => res.json({ shops: await billingService.myKhata(req.auth!.userId) }));
