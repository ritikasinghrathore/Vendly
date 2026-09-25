import crypto from 'node:crypto';
import { env } from '../../config/env';
import type { NormalizedEvent, PaymentProvider } from '../types';

// A safe local stand-in for a real gateway - no bank, no card, no UPI, no real money moves.
// It deliberately mirrors Razorpay's webhook shape (event name, payload.subscription.entity,
// payload.payment.entity) so switching PAYMENT_PROVIDER to "razorpay" later needs no handler changes.
// The "checkout" is a tiny page this same server renders (see routes/mockCheckout.ts) with
// Simulate Success / Simulate Failure buttons that sign and POST a webhook exactly like a real
// provider would, through the very same /api/v1/webhooks/mock endpoint.

const sign = (rawBody: Buffer) => crypto.createHmac('sha256', env.MOCK_WEBHOOK_SECRET).update(rawBody).digest('hex');

export const mockProvider: PaymentProvider = {
  name: 'mock',
  async createSubscriptionCheckout({ shopId, userId }) {
    const providerSubscriptionId = `mock_sub_${crypto.randomUUID()}`;
    const providerCustomerId = `mock_cust_${userId}`;
    const checkoutUrl = `${env.PUBLIC_BASE_URL}/mock-checkout?sub=${providerSubscriptionId}&shop=${shopId}`;
    return { checkoutUrl, providerCustomerId, providerSubscriptionId };
  },
  async cancelSubscription() { /* nothing external to call in mock mode */ },

  verifyAndParseWebhook(rawBody, headers) {
    const signature = headers['x-vendly-mock-signature'];
    const sig = Array.isArray(signature) ? signature[0] : signature;
    if (!sig) return null;
    const expected = sign(rawBody);
    try {
      if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    } catch {
      return null; // different length -> definitely not equal
    }
    return parseRazorpayLikeBody(rawBody, headers, 'mock');
  },
};

/** Shared by the mock provider and the tests: reads a Razorpay-shaped payload into a NormalizedEvent. */
export function parseRazorpayLikeBody(rawBody: Buffer, headers: Record<string, any>, providerLabel: string): NormalizedEvent | null {
  let body: any;
  try { body = JSON.parse(rawBody.toString('utf8')); } catch { return null; }
  const eventId = headers['x-razorpay-event-id'] ?? headers['x-vendly-mock-event-id'] ?? body.event_id;
  if (!eventId || !body.event) return null;

  const subEntity = body.payload?.subscription?.entity;
  const payEntity = body.payload?.payment?.entity;
  const period = subEntity?.current_start && subEntity?.current_end
    ? { start: new Date(subEntity.current_start * 1000), end: new Date(subEntity.current_end * 1000) }
    : null;

  return {
    eventId: String(Array.isArray(eventId) ? eventId[0] : eventId),
    eventType: body.event,
    providerSubscriptionId: subEntity?.id ?? null,
    period,
    payment: payEntity
      ? { providerPaymentId: payEntity.id, amountPaise: payEntity.amount, status: payEntity.status, method: payEntity.method ?? null }
      : null,
    raw: body,
  };
}
