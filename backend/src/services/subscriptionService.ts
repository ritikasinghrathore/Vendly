import { withTx } from '../db/pool';
import { logger } from '../utils/logger';
import { badRequest, notFound } from '../utils/errors';
import { env } from '../config/env';
import { paymentProvider } from '../payments';
import * as subscriptionRepo from '../repositories/subscriptionRepo';
import * as paymentRepo from '../repositories/paymentRepo';
import * as shopRepo from '../repositories/shopRepo';
import * as userRepo from '../repositories/userRepo';
import * as notificationRepo from '../repositories/notificationRepo';
import { applyEvent, eventTypeToSubEvent, hasAccess, type SubState } from '../subscriptions/stateMachine';
import type { SubscriptionRow } from '../repositories/subscriptionRepo';

const asDate = (v: string | null) => (v ? new Date(v) : null);
const toState = (row: SubscriptionRow): SubState => ({
  status: row.status as SubState['status'],
  currentPeriodStart: asDate(row.current_period_start),
  currentPeriodEnd: asDate(row.current_period_end),
  accessUntil: asDate(row.access_until),
  cancelAtPeriodEnd: row.cancel_at_period_end,
  cancelledAt: asDate(row.cancelled_at),
  trialEndsAt: asDate(row.trial_ends_at),
});
const patchFromState = (s: SubState) => ({
  status: s.status,
  current_period_start: s.currentPeriodStart?.toISOString() ?? null,
  current_period_end: s.currentPeriodEnd?.toISOString() ?? null,
  access_until: s.accessUntil?.toISOString() ?? null,
  cancel_at_period_end: s.cancelAtPeriodEnd,
  cancelled_at: s.cancelledAt?.toISOString() ?? null,
  trial_ends_at: s.trialEndsAt?.toISOString() ?? null,
});

export async function getStatus(shopId: string) {
  const sub = await subscriptionRepo.findSubscriptionByShop(shopId);
  if (!sub) throw notFound('No subscription found for this shop.');
  return {
    status: sub.status,
    hasAccess: hasAccess({ accessUntil: asDate(sub.access_until) }, new Date()),
    accessUntil: sub.access_until,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    checkoutUrl: sub.status === 'incomplete' ? sub.checkout_url : null,
  };
}

/** Starts (or re-opens) checkout for a shop's Rs 1,000/month plan. Never marks anything active by itself. */
export async function startCheckout(shopId: string, userId: string) {
  return withTx(async (tx) => {
    const sub = await subscriptionRepo.findSubscriptionByShopForUpdate(shopId, tx);
    if (!sub) throw notFound('No subscription record for this shop.');
    if (hasAccess({ accessUntil: asDate(sub.access_until) }, new Date()) && sub.status !== 'incomplete') {
      throw badRequest('This shop already has an active subscription.');
    }
    const shop = await shopRepo.findShopById(shopId, tx);
    const user = await userRepo.findById(userId, tx);
    if (!shop || !user) throw notFound('Shop or account not found.');

    // Reuse an existing pending Razorpay subscription rather than creating a new mandate on every tap of "Subscribe".
    if (sub.provider_subscription_id && sub.checkout_url && sub.status === 'incomplete') {
      return { checkoutUrl: sub.checkout_url };
    }
    const result = await paymentProvider.createSubscriptionCheckout({
      shopId, userId, userEmail: user.email, userName: user.name, userPhone: user.phone,
    });
    await subscriptionRepo.updateSubscription(sub.id, {
      provider: paymentProvider.name,
      provider_customer_id: result.providerCustomerId,
      provider_subscription_id: result.providerSubscriptionId,
      checkout_url: result.checkoutUrl,
      checkout_created_at: new Date().toISOString(),
    }, tx);
    return { checkoutUrl: result.checkoutUrl };
  });
}

export async function cancel(shopId: string) {
  const sub = await subscriptionRepo.findSubscriptionByShop(shopId);
  if (!sub?.provider_subscription_id) throw badRequest('There is no active subscription to cancel.');
  await paymentProvider.cancelSubscription(sub.provider_subscription_id);
  // We do not flip the status here: the provider's subscription.cancelled webhook is the one source of truth,
  // exactly as it is for every other state change (see requirement: never trust the app, always verify server-side).
  return { message: 'Cancellation requested. It will be confirmed shortly and your access continues until the paid period ends.' };
}

/**
 * The ONLY function in the whole codebase allowed to move a subscription toward "active". Called
 * exclusively from a webhook whose signature has already been verified (see controllers/webhookController.ts).
 * Idempotent: replays of the same provider event id are recognized and skipped.
 */
export async function applyWebhookEvent(provider: string, eventId: string, eventType: string, payload: unknown, providerSubscriptionId: string | null, period: { start: Date; end: Date } | null, payment: { providerPaymentId: string; amountPaise: number; status: string; method: string | null } | null) {
  return withTx(async (tx) => {
    const inserted = await paymentRepo.insertEventIfNew(provider, eventId, eventType, payload, tx);
    if (!inserted) { logger.info({ provider, eventId }, 'webhook event already processed, skipping'); return; } // duplicate delivery

    if (!providerSubscriptionId) { await paymentRepo.markEventProcessed(inserted.id, tx); return; }
    const sub = await subscriptionRepo.findSubscriptionByProviderIdForUpdate(provider, providerSubscriptionId, tx);
    if (!sub) {
      logger.warn({ provider, providerSubscriptionId, eventType }, 'webhook for unknown subscription');
      await paymentRepo.markEventProcessed(inserted.id, tx);
      return;
    }

    const event = eventTypeToSubEvent(eventType, period, new Date());
    if (event) {
      const next = applyEvent(toState(sub), event, env.SUBSCRIPTION_GRACE_DAYS);
      await subscriptionRepo.updateSubscription(sub.id, {
        ...patchFromState(next),
        started_at: sub.started_at ?? (event.type === 'ACTIVATED' ? new Date().toISOString() : sub.started_at),
        last_event_at: new Date().toISOString(),
      }, tx);
      if (event.type === 'ACTIVATED' || event.type === 'CHARGED') {
        await notificationRepo.insertNotification({ userId: sub.user_id, type: 'subscription', title: 'Vendly Shopkeeper Pro is active',
          body: `Your subscription is confirmed. Renews ${next.currentPeriodEnd?.toDateString() ?? ''}.`, data: { shopId: sub.shop_id } }, tx);
      } else if (event.type === 'PAYMENT_FAILED') {
        await notificationRepo.insertNotification({ userId: sub.user_id, type: 'subscription', title: 'Payment issue with your subscription',
          body: 'We could not renew Vendly Shopkeeper Pro. Please update your payment method to avoid losing access.', data: { shopId: sub.shop_id } }, tx);
      } else if (event.type === 'CANCELLED') {
        await notificationRepo.insertNotification({ userId: sub.user_id, type: 'subscription', title: 'Subscription cancelled',
          body: 'Your Vendly Shopkeeper Pro subscription was cancelled. Shop management stays available until your paid period ends.', data: { shopId: sub.shop_id } }, tx);
      }
    }

    if (payment) {
      await paymentRepo.upsertPayment({
        subscriptionId: sub.id, userId: sub.user_id, shopId: sub.shop_id, provider, providerPaymentId: payment.providerPaymentId,
        amountPaise: payment.amountPaise, status: payment.status === 'captured' ? 'captured' : payment.status === 'failed' ? 'failed' : 'authorized',
        method: payment.method, paidAt: payment.status === 'captured' ? new Date().toISOString() : null,
      }, tx);
    }
    await paymentRepo.markEventProcessed(inserted.id, tx);
  });
}

/** Background job: flips lapsed subscriptions to "expired". Never deletes a shop or its data. */
export async function sweepExpired(): Promise<number> {
  const due = await subscriptionRepo.subscriptionIdsPastAccessUntil();
  for (const row of due) {
    await withTx(async (tx) => {
      const sub = await subscriptionRepo.findSubscriptionByIdForUpdate(row.id, tx);
      if (!sub) return;
      const next = applyEvent(toState(sub), { type: 'EXPIRE_SWEEP', now: new Date() }, env.SUBSCRIPTION_GRACE_DAYS);
      if (next.status !== sub.status) {
        await subscriptionRepo.updateSubscription(sub.id, patchFromState(next), tx);
        await notificationRepo.insertNotification({ userId: sub.user_id, type: 'subscription', title: 'Subscription expired',
          body: 'Your Vendly Shopkeeper Pro subscription has expired. Renew to manage your shop again - your data is safe.', data: { shopId: sub.shop_id } }, tx);
      }
    });
  }
  return due.length;
}
