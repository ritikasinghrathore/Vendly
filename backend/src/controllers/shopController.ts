import { asyncHandler } from '../utils/asyncHandler';
import * as shopService from '../services/shopService';
import * as subscriptionService from '../services/subscriptionService';
import { query as dbq } from '../db/pool';

export const create = asyncHandler(async (req, res) => {
  const shop = await shopService.createShop(req.auth!.userId, req.body);
  res.status(201).json({ shop });
});
export const myShops = asyncHandler(async (req, res) => {
  res.json({ shops: await shopService.myShops(req.auth!.userId) });
});
export const browse = asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  res.json({ shops: q.trim() ? await shopService.searchShops(q) : await shopService.listBrowsableShops() });
});
export const getOne = asyncHandler(async (req, res) => {
  const shop = await shopService.getShop(req.params.shopId);
  if (!shop) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shop not found.' } });
  res.json({ shop });
});
export const update = asyncHandler(async (req, res) => {
  const shop = await shopService.updateShop(req.shop!.id, req.body);
  res.json({ shop });
});
export const dashboard = asyncHandler(async (req, res) => {
  const shopId = req.shop!.id;
  const [today] = await dbq<{ total: number; count: number }>(
    "select coalesce(sum(total_amount),0) as total, count(*)::int as count from bills where shop_id = $1 and created_at >= date_trunc('day', now())", [shopId]);
  const [pending] = await dbq<{ count: number }>('select count(*)::int as count from bills where shop_id = $1 and amount_due > 0', [shopId]);
  const outstandingRows = await dbq<{ balance: number }>(
    `select sum(b) as balance from (select sum(amount) as b from khata_transactions where shop_id = $1 group by shop_customer_id having sum(amount) > 0) x`, [shopId]);
  const [lowStock] = await dbq<{ count: number }>('select count(*)::int as count from products p join inventory i on i.product_id = p.id where p.shop_id = $1 and p.is_active and i.quantity <= i.low_stock_threshold', [shopId]);
  const [newLists] = await dbq<{ count: number }>("select count(*)::int as count from shopping_lists where shop_id = $1 and status = 'submitted'", [shopId]);
  res.json({
    todaySales: today?.total ?? 0, todayBills: today?.count ?? 0, pendingBills: pending?.count ?? 0,
    outstanding: outstandingRows[0]?.balance ?? 0, lowStock: lowStock?.count ?? 0, newLists: newLists?.count ?? 0,
  });
});
export const salesSummary = asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
  const rows = await dbq(
    `select d::date as sale_day,
            (select count(*) from bills b where b.shop_id = $1 and b.created_at::date = d::date)::int as bill_count,
            coalesce((select sum(b.total_amount) from bills b where b.shop_id = $1 and b.created_at::date = d::date), 0) as sales,
            coalesce((select sum(p.amount) from customer_payments p where p.shop_id = $1 and p.created_at::date = d::date), 0) as collected
     from generate_series((current_date - ($2::int - 1))::timestamp, current_date::timestamp, interval '1 day') d order by d`,
    [req.shop!.id, days],
  );
  res.json({ days: rows });
});
export const subscriptionStatus = asyncHandler(async (req, res) => res.json(await subscriptionService.getStatus(req.shop!.id)));
export const startCheckout = asyncHandler(async (req, res) => res.json(await subscriptionService.startCheckout(req.shop!.id, req.auth!.userId)));
export const cancelSubscription = asyncHandler(async (req, res) => res.json(await subscriptionService.cancel(req.shop!.id)));
