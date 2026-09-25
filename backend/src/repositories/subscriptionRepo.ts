import { one, query, type Db } from '../db/pool';

export interface SubscriptionRow {
  id: string; user_id: string; shop_id: string; plan_code: string; status: string; provider: string;
  provider_customer_id: string | null; provider_subscription_id: string | null; checkout_url: string | null;
  started_at: string | null; current_period_start: string | null; current_period_end: string | null;
  trial_ends_at: string | null; access_until: string | null; cancel_at_period_end: boolean;
  cancelled_at: string | null; last_event_at: string | null;
}

export const findSubscriptionByShop = (shopId: string, db?: Db) => one<SubscriptionRow>('select * from subscriptions where shop_id = $1', [shopId], db);
export const findSubscriptionByShopForUpdate = (shopId: string, db?: Db) =>
  one<SubscriptionRow>('select * from subscriptions where shop_id = $1 for update', [shopId], db);
export const findSubscriptionByIdForUpdate = (id: string, db?: Db) =>
  one<SubscriptionRow>('select * from subscriptions where id = $1 for update', [id], db);
export const findSubscriptionByProviderIdForUpdate = (provider: string, providerSubscriptionId: string, db?: Db) =>
  one<SubscriptionRow>('select * from subscriptions where provider = $1 and provider_subscription_id = $2 for update', [provider, providerSubscriptionId], db);
export const insertSubscription = (s: { userId: string; shopId: string; provider: string }, db?: Db) =>
  one<SubscriptionRow>(`insert into subscriptions (user_id, shop_id, provider, status) values ($1,$2,$3,'incomplete') returning *`,
    [s.userId, s.shopId, s.provider], db);

export function updateSubscription(id: string, patch: Record<string, unknown>, db?: Db) {
  const cols = Object.keys(patch);
  if (cols.length === 0) return one<SubscriptionRow>('select * from subscriptions where id = $1', [id], db);
  const set = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
  return one<SubscriptionRow>(`update subscriptions set ${set} where id = $1 returning *`, [id, ...cols.map((c) => patch[c])], db);
}
export const subscriptionIdsPastAccessUntil = (db?: Db) =>
  query<{ id: string }>(
    `select id from subscriptions where status in ('active','past_due','cancelled','trial') and access_until is not null and access_until < now()`, [], db);
