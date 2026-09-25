import { Router } from 'express';
import crypto from 'node:crypto';
import { env } from '../config/env';

/**
 * Only mounted when PAYMENT_PROVIDER=mock. Serves a tiny hosted-looking checkout page (what a real
 * Razorpay "short_url" mandate page would be) with Simulate Success / Simulate Failure buttons. Both
 * buttons sign and POST a Razorpay-shaped webhook body to /api/v1/webhooks/mock, going through the
 * exact same verify -> applyWebhookEvent path production traffic will use.
 */
export const mockCheckoutRouter = Router();

function sign(body: string): string {
  return crypto.createHmac('sha256', env.MOCK_WEBHOOK_SECRET).update(body).digest('hex');
}

mockCheckoutRouter.get('/mock-checkout', (req, res) => {
  const sub = String(req.query.sub ?? '');
  const shop = String(req.query.shop ?? '');
  const amount = (env.PLAN_AMOUNT_PAISE / 100).toFixed(0);
  const now = Math.floor(Date.now() / 1000);
  const periodEnd = now + 30 * 86400;

  const eventBody = (type: 'success' | 'failure') => {
    const payEntity = { id: `mock_pay_${crypto.randomUUID()}`, amount: env.PLAN_AMOUNT_PAISE, status: type === 'success' ? 'captured' : 'failed', method: 'upi' };
    const subEntity = { id: sub, status: type === 'success' ? 'active' : 'pending', current_start: now, current_end: periodEnd };
    const body = {
      event: type === 'success' ? 'subscription.activated' : 'subscription.pending',
      event_id: `mock_evt_${crypto.randomUUID()}`,
      payload: { subscription: { entity: subEntity }, payment: { entity: payEntity } },
    };
    return JSON.stringify(body);
  };

  const successBody = eventBody('success');
  const failureBody = eventBody('failure');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Mock checkout - Vendly Shopkeeper Pro</title>
  <style>
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#FBF4F7;color:#33223F;padding:28px;max-width:420px;margin:0 auto}
    h1{font-size:20px} p{color:#6E5C7B;font-size:14px;line-height:1.5}
    .amt{font-size:34px;font-weight:800;margin:18px 0}
    button{display:block;width:100%;padding:16px;border-radius:14px;border:none;font-size:16px;font-weight:700;margin-top:12px;cursor:pointer}
    .ok{background:#5E3C7A;color:#fff} .bad{background:#F5D0DC;color:#B4425A}
    .note{font-size:12px;color:#8A6A12;background:#F7E9B0;padding:10px 12px;border-radius:10px;margin-top:20px}
    #msg{margin-top:16px;font-weight:700}
  </style></head><body>
  <h1>Vendly Shopkeeper Pro</h1>
  <p>Shop: ${shop}</p>
  <div class="amt">₹${amount}<span style="font-size:16px;color:#6E5C7B">/month</span></div>
  <p>This is a <strong>test</strong> checkout page - PAYMENT_PROVIDER is set to "mock", so no real bank, card or UPI app is involved.</p>
  <button class="ok" id="okBtn">Simulate successful payment</button>
  <button class="bad" id="badBtn">Simulate failed payment</button>
  <div id="msg"></div>
  <div class="note">Switch PAYMENT_PROVIDER to "razorpay" in the backend .env to use a real hosted checkout page here instead.</div>
  <script>
    async function fire(body, sig) {
      document.getElementById('msg').textContent = 'Sending...';
      try {
        const r = await fetch('/api/v1/webhooks/mock', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vendly-Mock-Signature': sig }, body });
        document.getElementById('msg').textContent = r.ok ? 'Done! Go back to the app and pull to refresh.' : 'Something went wrong (' + r.status + ').';
      } catch (e) { document.getElementById('msg').textContent = 'Network error.'; }
    }
    document.getElementById('okBtn').onclick = () => fire(${JSON.stringify(successBody)}, ${JSON.stringify(sign(successBody))});
    document.getElementById('badBtn').onclick = () => fire(${JSON.stringify(failureBody)}, ${JSON.stringify(sign(failureBody))});
  </script></body></html>`);
});
