import { one, query, type Db } from '../db/pool';

export const findPaymentByProviderId = (provider: string, providerPaymentId: string, db?: Db) =>
  one('select * from payments where provider = $1 and provider_payment_id = $2', [provider, providerPaymentId], db);
export const upsertPayment = (p: any, db?: Db) => one(
  `insert into payments (subscription_id, user_id, shop_id, provider, provider_payment_id, amount_paise, currency, status, method, failure_code, failure_reason, paid_at)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
   on conflict (provider, provider_payment_id) do update set
     status = excluded.status, method = coalesce(excluded.method, payments.method),
     failure_code = excluded.failure_code, failure_reason = excluded.failure_reason,
     paid_at = coalesce(payments.paid_at, excluded.paid_at)
   returning *`,
  [p.subscriptionId ?? null, p.userId, p.shopId, p.provider, p.providerPaymentId, p.amountPaise, p.currency ?? 'INR',
   p.status, p.method ?? null, p.failureCode ?? null, p.failureReason ?? null, p.paidAt ?? null], db,
);
export const paymentsForShop = (shopId: string, db?: Db) => query('select * from payments where shop_id = $1 order by created_at desc limit 100', [shopId], db);

export const findEventByProviderEventId = (provider: string, eventId: string, db?: Db) =>
  one<{ id: string; processed_at: string | null }>('select id, processed_at from payment_events where provider = $1 and event_id = $2', [provider, eventId], db);
export const insertEventIfNew = (provider: string, eventId: string, eventType: string, payload: unknown, db?: Db) =>
  one<{ id: string }>(
    `insert into payment_events (provider, event_id, event_type, payload) values ($1,$2,$3,$4)
     on conflict (provider, event_id) do nothing returning id`,
    [provider, eventId, eventType, JSON.stringify(payload)], db,
  );
export const markEventProcessed = (id: string, db?: Db) => query('update payment_events set processed_at = now() where id = $1', [id], db);
