/**
 * Sends a test webhook event to your OWN running backend, signed exactly like the real provider
 * would sign it - useful for testing renewals, failures and cancellations from the terminal instead
 * of clicking through the mock checkout page each time.
 *
 * Usage:
 *   npm run webhook:simulate -- --sub mock_sub_xxx --event subscription.charged
 *   npm run webhook:simulate -- --sub mock_sub_xxx --event subscription.pending
 *   npm run webhook:simulate -- --sub mock_sub_xxx --event subscription.cancelled
 *
 * Find --sub from the "provider_subscription_id" column of the shop's row in the subscriptions
 * table (or from the URL of the checkout link the app opened).
 */
import crypto from 'node:crypto';
import { env } from '../src/config/env';

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v && fallback === undefined) { console.error(`Missing --${name}`); process.exit(1); }
  return v ?? fallback!;
}

async function main() {
  const subId = arg('sub');
  const eventType = arg('event', 'subscription.charged');
  const now = Math.floor(Date.now() / 1000);

  const body = JSON.stringify({
    event: eventType,
    event_id: `sim_evt_${crypto.randomUUID()}`,
    payload: {
      subscription: { entity: { id: subId, status: 'active', current_start: now, current_end: now + 30 * 86400 } },
      payment: { entity: { id: `sim_pay_${crypto.randomUUID()}`, amount: env.PLAN_AMOUNT_PAISE, status: eventType.includes('pending') || eventType.includes('halted') ? 'failed' : 'captured', method: 'upi' } },
    },
  });

  const provider = env.PAYMENT_PROVIDER;
  const secret = provider === 'razorpay' ? env.RAZORPAY_WEBHOOK_SECRET! : env.MOCK_WEBHOOK_SECRET;
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const headerName = provider === 'razorpay' ? 'X-Razorpay-Signature' : 'X-Vendly-Mock-Signature';

  const url = `${env.PUBLIC_BASE_URL}/api/v1/webhooks/${provider}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', [headerName]: signature }, body });
  console.log(`${res.status} ${res.statusText}`);
  console.log(await res.text());
}
main().catch((err) => { console.error(err); process.exit(1); });
