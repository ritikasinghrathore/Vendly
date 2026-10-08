/**
 * Creates demo accounts for local testing: a shopkeeper with one shop, a few products, and a
 * customer account. Vendly is free for both roles, so the shop is usable immediately.
 *
 * Run with: npm run seed
 */
import { pool, withTx } from '../src/db/pool';
import { hashPassword } from '../src/auth/password';
import { logger } from '../src/utils/logger';

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
  console.log('  Shopkeeper: owner@vendly.test    (shop: Ritika General Store, ready to manage immediately)');
  console.log('  Customer:   customer@vendly.test\n');
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
