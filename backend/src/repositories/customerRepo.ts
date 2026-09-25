import { one, query, type Db } from '../db/pool';
import { likePattern } from '../utils/like';

export const findShopCustomerByUser = (shopId: string, userId: string, db?: Db) =>
  one('select * from shop_customers where shop_id = $1 and user_id = $2', [shopId, userId], db);
export const findShopCustomerById = (id: string, db?: Db) => one('select * from shop_customers where id = $1', [id], db);
export const findShopCustomerForUpdate = (id: string, db?: Db) => one('select * from shop_customers where id = $1 for update', [id], db);
export const linkOrCreateShopCustomer = (shopId: string, userId: string, name: string, phone: string | null, db?: Db) =>
  one(`insert into shop_customers (shop_id, user_id, name, phone, created_by) values ($1,$2,$3,$4,$2)
       on conflict (shop_id, user_id) do update set phone = coalesce(shop_customers.phone, excluded.phone) returning *`,
    [shopId, userId, name, phone], db);
export const createWalkInCustomer = (shopId: string, name: string, phone: string | null, createdBy: string, db?: Db) =>
  one('insert into shop_customers (shop_id, name, phone, created_by) values ($1,$2,$3,$4) returning *', [shopId, name, phone, createdBy], db);
export const listShopCustomers = (shopId: string, db?: Db) =>
  query(`select c.*, coalesce((select sum(amount) from khata_transactions k where k.shop_customer_id = c.id), 0) as balance
         from shop_customers c where c.shop_id = $1 order by c.name limit 5000`, [shopId], db);
export const searchShopCustomers = (shopId: string, q: string, db?: Db) =>
  query(`select * from shop_customers where shop_id = $1 and (name ilike $2 escape '\\' or phone ilike $2 escape '\\') order by name limit 20`,
    [shopId, likePattern(q)], db);
export const myShopCustomerRows = (userId: string, db?: Db) =>
  query(`select c.id, c.shop_id, s.name as shop_name, s.phone as shop_phone, s.area as shop_area,
         coalesce((select sum(amount) from khata_transactions k where k.shop_customer_id = c.id), 0) as balance
         from shop_customers c join shops s on s.id = c.shop_id where c.user_id = $1`, [userId], db);
export const khataTxnsForCustomer = (shopCustomerId: string, db?: Db) =>
  query('select * from khata_transactions where shop_customer_id = $1 order by created_at asc', [shopCustomerId], db);
export const billsForCustomer = (shopCustomerId: string, db?: Db) =>
  query('select id, bill_number, total_amount, amount_due, payment_status, created_at from bills where shop_customer_id = $1 order by created_at desc limit 100', [shopCustomerId], db);
export const insertKhataTxn = (t: any, db?: Db) => one(
  `insert into khata_transactions (shop_id, shop_customer_id, txn_type, amount, bill_id, payment_id, notes, created_by)
   values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
  [t.shopId, t.shopCustomerId, t.txnType, t.amount, t.billId ?? null, t.paymentId ?? null, t.notes ?? null, t.createdBy], db,
);
export const balanceForCustomer = (shopCustomerId: string, db?: Db) =>
  one<{ balance: number }>('select coalesce(sum(amount),0) as balance from khata_transactions where shop_customer_id = $1', [shopCustomerId], db);
