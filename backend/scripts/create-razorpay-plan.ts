/**
 * One-off setup: creates the "Vendly Shopkeeper Pro" plan on Razorpay and prints its id.
 * Paste the id into .env as RAZORPAY_PLAN_ID. Run again only if you need a second/updated plan
 * (Razorpay plans are immutable once created).
 *
 * Requires RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET already set. Run with: npm run razorpay:create-plan
 */
import { env } from '../src/config/env';
import { createMonthlyPlan } from '../src/payments/razorpay/provider';
import { PLAN } from '../src/config/constants';

async function main() {
  if (env.PAYMENT_PROVIDER !== 'razorpay' && !env.RAZORPAY_KEY_ID) {
    console.error('Set PAYMENT_PROVIDER=razorpay and your RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env first.');
    process.exit(1);
  }
  const id = await createMonthlyPlan(PLAN.name, env.PLAN_AMOUNT_PAISE);
  console.log(`\nCreated plan "${PLAN.name}" at ₹${env.PLAN_AMOUNT_PAISE / 100}/month.`);
  console.log(`Plan id: ${id}`);
  console.log(`\nAdd this to backend/.env:\n  RAZORPAY_PLAN_ID=${id}\n`);
}
main().catch((err) => { console.error(err.message ?? err); process.exit(1); });
