/**
 * Creates demo accounts for local testing: a shopkeeper with one shop (subscription already marked
 * active - ONLY this script is allowed to do that directly; every other code path requires a real
 * verified webhook), a few products, and a customer account.
 *
 * Run with: npm run seed
 */
import { pool, withTx } from '../src/db/pool';
import { hashPassword } from '../src/auth/password';
import { logger } from '../src/utils/logger';
import { env } from '../src/config/env';

const DEMO_PASSWORD = 'Password123!';

async function main() {
  await withTx(async (tx) => {
    const shopkeeper = await tx.query(
      `insert into users (email, password_hash, name, phone, role) values ($1,$2,$3,$4,'shopkeeper')
       on conflict (email) do update set name = excluded.name returning id`,
      ['owner@vendly.test', await hashPassword(DEMO_PASSWORD), 'Subhod Kumar Singh', '8581806228'],
    );
    const ownerId = shopkeeper.rows[0].id;

    const customer = await tx.query(
      `insert into users (email, password_hash, name, phone, role) values ($1,$2,$3,$4,'customer')
       on conflict (email) do update set name = excluded.name returning id`,
      ['customer@vendly.test', await hashPassword(DEMO_PASSWORD), 'Ramesh Kumar', '9999900000'],
    );

    let shop = (await tx.query('select id from shops where owner_user_id = $1 limit 1', [ownerId])).rows[0];
    if (!shop) {
      shop = (await tx.query(
        `insert into shops (owner_user_id, name, owner_name, tagline, shop_type, phone, address_line, area, city, state, pincode)
         values ($1,'Ritika General Store','Subhod Kumar Singh','Groceries and puja items, near the temple','grocery',
                 '8581806228','Near Sai Mandir','Pundag','Ranchi','Jharkhand','834005') returning id`,
        [ownerId],
      )).rows[0];
      await tx.query('insert into shop_members (shop_id, user_id, member_role) values ($1,$2,\'owner\')', [shop.id, ownerId]);
    }
    const shopId = shop.id;

    const sub = (await tx.query('select id from subscriptions where shop_id = $1', [shopId])).rows[0];
    const periodEnd = new Date(Date.now() + 30 * 86_400_000);
    const accessUntil = new Date(periodEnd.getTime() + env.SUBSCRIPTION_GRACE_DAYS * 86_400_000);
    if (sub) {
      await tx.query(
        `update subscriptions set status = 'active', started_at = coalesce(started_at, now()), current_period_start = now(),
         current_period_end = $2, access_until = $3 where id = $1`,
        [sub.id, periodEnd.toISOString(), accessUntil.toISOString()],
      );
    } else {
      await tx.query(
        `insert into subscriptions (user_id, shop_id, provider, status, started_at, current_period_start, current_period_end, access_until)
         values ($1,$2,$3,'active', now(), now(), $4, $5)`,
        [ownerId, shopId, env.PAYMENT_PROVIDER, periodEnd.toISOString(), accessUntil.toISOString()],
      );
    }

    const cat = (await tx.query("select id from categories where name = 'Rice & Grains'")).rows[0];
    const catOil = (await tx.query("select id from categories where name = 'Oil & Ghee'")).rows[0];
    const catPuja = (await tx.query("select id from categories where name = 'Puja Items'")).rows[0];
    const demoProducts: [string, string | null, string, number, string | null, number][] = [
      ['Rice', 'चावल', 'kg', 60, cat?.id ?? null, 35],
      ['Sugar', 'चीनी', 'kg', 50, null, 12],
      ['Sunflower Oil', 'तेल', 'litre', 145, catOil?.id ?? null, 8],
      ['Agarbatti', 'अगरबत्ती', 'packet', 30, catPuja?.id ?? null, 4],
    ];
    for (const [name, nameHi, unit, price, categoryId, stock] of demoProducts) {
      const existing = await tx.query('select id from products where shop_id = $1 and name = $2', [shopId, name]);
      if (existing.rows[0]) continue;
      const p = await tx.query(
        `insert into products (shop_id, category_id, name, name_hi, unit, price) values ($1,$2,$3,$4,$5,$6) returning id`,
        [shopId, categoryId, name, nameHi, unit, price.toFixed(2)],
      );
      await tx.query('insert into inventory (product_id, shop_id, quantity, low_stock_threshold) values ($1,$2,$3,5)', [p.rows[0].id, shopId, stock]);
      if (stock > 0) {
        await tx.query(
          `insert into inventory_movements (shop_id, product_id, change_quantity, stock_after, reason) values ($1,$2,$3,$3,'opening')`,
          [shopId, p.rows[0].id, stock],
        );
      }
    }

    logger.info({ shopId, ownerId, customerId: customer.rows[0].id }, 'seed complete');
  });

  console.log('\nDemo accounts (password for both): ' + DEMO_PASSWORD);
  console.log('  Shopkeeper: owner@vendly.test    (shop: Ritika General Store, subscription already active)');
  console.log('  Customer:   customer@vendly.test\n');
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
