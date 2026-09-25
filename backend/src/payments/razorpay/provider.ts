import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import type { PaymentProvider } from '../types';
import { parseRazorpayLikeBody } from '../mock/provider';

let client: InstanceType<typeof Razorpay> | null = null;
const rz = () => (client ??= new Razorpay({ key_id: env.RAZORPAY_KEY_ID!, key_secret: env.RAZORPAY_KEY_SECRET! }));

// ~8 years of monthly cycles. Razorpay requires a bound (no true "forever" subscription); this is
// effectively indefinite for a shop, and renewing past it just means re-running the checkout once.
const TOTAL_MONTHLY_CYCLES = 100;

export const razorpayProvider: PaymentProvider = {
  name: 'razorpay',

  async createSubscriptionCheckout({ userId, userEmail, userName, userPhone }) {
    // One Razorpay customer per Vendly user. fail_existing: '0' means a matching email/phone returns
    // the existing customer instead of erroring, so retrying checkout creation is always safe.
    const customer = await rz().customers.create({
      name: userName,
      email: userEmail,
      contact: userPhone ?? undefined,
      fail_existing: '0',
      notes: { vendly_user_id: userId },
    } as any);

    const subscription = await rz().subscriptions.create({
      plan_id: env.RAZORPAY_PLAN_ID!,
      total_count: TOTAL_MONTHLY_CYCLES,
      customer_notify: 1,
      notes: { vendly_user_id: userId },
    } as any);

    const checkoutUrl = (subscription as any).short_url as string | undefined;
    if (!checkoutUrl) throw new Error('Razorpay did not return a checkout link for this subscription.');
    return { checkoutUrl, providerCustomerId: (customer as any).id, providerSubscriptionId: (subscription as any).id };
  },

  async cancelSubscription(providerSubscriptionId) {
    try {
      await rz().subscriptions.cancel(providerSubscriptionId, { cancel_at_cycle_end: true } as any);
    } catch (err) {
      // Already cancelled/expired on Razorpay's side is fine - our own state will catch up from the webhook.
      logger.warn({ err, providerSubscriptionId }, 'razorpay: cancel subscription call failed');
    }
  },

  verifyAndParseWebhook(rawBody, headers) {
    const signature = headers['x-razorpay-signature'];
    const sig = Array.isArray(signature) ? signature[0] : signature;
    if (!sig) return null;
    let valid: boolean;
    try {
      valid = Razorpay.validateWebhookSignature(rawBody.toString('utf8'), sig, env.RAZORPAY_WEBHOOK_SECRET!);
    } catch {
      valid = false;
    }
    if (!valid) return null;
    return parseRazorpayLikeBody(rawBody, headers, 'razorpay');
  },
};

/** One-off setup helper (see scripts/create-razorpay-plan.ts) - not used on the request path. */
export async function createMonthlyPlan(name: string, amountPaise: number): Promise<string> {
  const plan = await rz().plans.create({
    period: 'monthly',
    interval: 1,
    item: { name, amount: amountPaise, currency: 'INR' },
  } as any);
  return (plan as any).id;
}

export const rawWebhookHmacHex = (rawBody: Buffer, secret: string): string =>
  crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
