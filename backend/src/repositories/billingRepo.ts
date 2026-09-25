import { one, query, type Db } from '../db/pool';

export const nextBillNumber = (shopId: string, db?: Db) =>
  one<{ next_bill_number: number; name: string }>(
    'update shops set next_bill_number = next_bill_number + 1 where id = $1 returning next_bill_number - 1 as next_bill_number, name', [shopId], db);
export const findBillByRequestId = (shopId: string, requestId: string, createdBy: string, db?: Db) =>
  one<{ id: string }>('select id from bills where shop_id = $1 and request_id = $2 and created_by = $3', [shopId, requestId, createdBy], db);
export const insertBill = (b: any, db?: Db) => one(
  `insert into bills (shop_id, bill_number, shop_customer_id, created_by, shopping_list_id, request_id, subtotal, discount, total_amount, amount_paid, amount_due, payment_status, notes)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
  [b.shopId, b.billNumber, b.shopCustomerId, b.createdBy, b.shoppingListId ?? null, b.requestId ?? null,
   b.subtotal, b.discount, b.total, b.amountPaid, b.amountDue, b.status, b.notes ?? null], db,
);
export const insertBillItem = (i: any, db?: Db) => query(
  `insert into bill_items (bill_id, product_id, product_name_snapshot, quantity, unit, unit_price, line_total) values ($1,$2,$3,$4,$5,$6,$7)`,
  [i.billId, i.productId, i.name, i.quantity, i.unit, i.unitPrice, i.lineTotal], db,
);
export const findBillById = (id: string, db?: Db) => one('select * from bills where id = $1', [id], db);
export const billItemsForBill = (billId: string, db?: Db) => query('select * from bill_items where bill_id = $1 order by product_name_snapshot', [billId], db);
export const applyPaymentToBill = (billId: string, paidDelta: number | string, dueAfter: number | string, status: string, db?: Db) =>
  query('update bills set amount_paid = amount_paid + $2, amount_due = $3, payment_status = $4 where id = $1', [billId, paidDelta, dueAfter, status], db);
export const openBillsForCustomerOldestFirst = (shopCustomerId: string, onlyBillId: string | null, db?: Db) =>
  query(`select id, amount_due from bills where shop_customer_id = $1 and amount_due > 0 and ($2::uuid is null or id = $2)
         order by created_at, bill_number for update`, [shopCustomerId, onlyBillId], db);

export const findCustomerPaymentByRequestId = (requestId: string, createdBy: string, db?: Db) =>
  one<{ id: string }>('select id from customer_payments where request_id = $1 and created_by = $2', [requestId, createdBy], db);
export const insertCustomerPayment = (p: any, db?: Db) => one(
  `insert into customer_payments (shop_id, shop_customer_id, request_id, amount, method, notes, created_by) values ($1,$2,$3,$4,$5,$6,$7) returning *`,
  [p.shopId, p.shopCustomerId, p.requestId ?? null, p.amount, p.method, p.notes ?? null, p.createdBy], db,
);
export const insertPaymentAllocation = (paymentId: string, billId: string, amount: number | string, db?: Db) =>
  query('insert into customer_payment_allocations (payment_id, bill_id, amount) values ($1,$2,$3)', [paymentId, billId, amount], db);
