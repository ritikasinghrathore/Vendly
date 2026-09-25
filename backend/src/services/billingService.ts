import { withTx } from '../db/pool';
import * as billingRepo from '../repositories/billingRepo';
import * as productRepo from '../repositories/productRepo';
import * as customerRepo from '../repositories/customerRepo';
import * as listRepo from '../repositories/listRepo';
import * as notificationRepo from '../repositories/notificationRepo';
import * as shopRepo from '../repositories/shopRepo';
import { badRequest, forbidden, notFound } from '../utils/errors';
import { computeBill, lineTotalPaise, paiseToNumeric, toPaise } from '../utils/money';

export const listShopCustomers = (shopId: string) => customerRepo.listShopCustomers(shopId);
export const searchShopCustomers = (shopId: string, q: string) => customerRepo.searchShopCustomers(shopId, q);
export const addWalkInCustomer = (shopId: string, userId: string, name: string, phone?: string) =>
  customerRepo.createWalkInCustomer(shopId, name, phone ?? null, userId);

async function ownedCustomer(shopId: string, shopCustomerId: string, tx?: any, forUpdate = false) {
  const c = forUpdate ? await customerRepo.findShopCustomerForUpdate(shopCustomerId, tx) : await customerRepo.findShopCustomerById(shopCustomerId, tx);
  if (!c || (c as any).shop_id !== shopId) throw notFound('Customer not found.');
  return c as any;
}

/**
 * Creates a bill for a shop's customer. Every price is re-read from the products table here - the
 * app can influence WHICH products and HOW MANY, never the price. Stock is locked and checked, the
 * bill, its line items, the stock change and the khata entry are all written in one transaction:
 * either all of it is saved, or none of it is.
 */
export async function createBill(shopId: string, userId: string, input: {
  shopCustomerId: string; items: { productId: string; quantity: number }[]; discount: number; amountPaid: number;
  method: string; notes?: string; shoppingListId?: string; requestId: string;
}) {
  return withTx(async (tx) => {
    const existing = await billingRepo.findBillByRequestId(shopId, input.requestId, userId, tx);
    if (existing) return getBill(existing.id); // retried request: return what was already saved, never double-bill

    const customer = await ownedCustomer(shopId, input.shopCustomerId, tx, true);

    // Merge duplicate product rows the app might send, then lock every product in a FIXED order (by id)
    // so two simultaneous bills for the same shop can never deadlock each other.
    const merged = new Map<string, number>();
    for (const item of input.items) merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
    const productIds = [...merged.keys()].sort();
    if (productIds.length === 0) throw badRequest('Add at least one item to the bill.');

    const lines: { productId: string; name: string; unit: string; quantity: number; unitPrice: number; lineTotalPaise: number; stockBefore: number; lowStockThreshold: number }[] = [];
    for (const productId of productIds) {
      const qty = merged.get(productId)!;
      if (!(qty > 0)) throw badRequest('Every quantity must be more than zero.');
      const p = await productRepo.findProductForUpdate(productId, tx); // locked for the rest of this transaction
      if (!p || (p as any).shop_id !== shopId || !(p as any).is_active) throw badRequest('One of the products is not available in this shop.');
      if (Number((p as any).stock_quantity) < qty) {
        throw badRequest(`Not enough stock for ${(p as any).name}: ${(p as any).stock_quantity} in stock, ${qty} requested. Update stock first.`);
      }
      lines.push({
        productId, name: (p as any).name, unit: (p as any).unit, quantity: qty, unitPrice: Number((p as any).price),
        lineTotalPaise: lineTotalPaise(qty, (p as any).price), stockBefore: Number((p as any).stock_quantity), lowStockThreshold: Number((p as any).low_stock_threshold),
      });
    }

    const calc = computeBill(lines, input.discount, input.amountPaid);
    if (calc.discountPaise > calc.subtotalPaise) throw badRequest('Discount cannot be more than the bill subtotal.');
    if (calc.totalPaise <= 0) throw badRequest('Bill total must be more than zero.');
    if (calc.amountPaidPaise > calc.totalPaise) throw badRequest('Amount paid cannot be more than the bill total.');

    if (input.shoppingListId) {
      const list = await listRepo.findListById(input.shoppingListId, tx);
      if (!list || list.shop_id !== shopId) throw badRequest('That shopping list does not belong to this shop.');
    }

    const seq = await billingRepo.nextBillNumber(shopId, tx);
    const bill = await billingRepo.insertBill({
      shopId, billNumber: seq!.next_bill_number, shopCustomerId: customer.id, createdBy: userId,
      shoppingListId: input.shoppingListId, requestId: input.requestId,
      subtotal: paiseToNumeric(calc.subtotalPaise), discount: paiseToNumeric(calc.discountPaise), total: paiseToNumeric(calc.totalPaise),
      amountPaid: paiseToNumeric(calc.amountPaidPaise), amountDue: paiseToNumeric(calc.amountDuePaise), status: calc.status, notes: input.notes,
    }, tx);

    for (const line of lines) {
      await billingRepo.insertBillItem({ billId: bill!.id, productId: line.productId, name: line.name, unit: line.unit, quantity: line.quantity, unitPrice: line.unitPrice.toFixed(2), lineTotal: paiseToNumeric(line.lineTotalPaise) }, tx);
      const newStock = line.stockBefore - line.quantity;
      await productRepo.updateInventoryQuantity(line.productId, newStock, tx);
      await productRepo.insertInventoryMovement({ shopId, productId: line.productId, changeQuantity: (-line.quantity).toFixed(3), stockAfter: newStock.toFixed(3), reason: 'sale', billId: bill!.id, createdBy: userId }, tx);
      if (newStock <= line.lowStockThreshold && line.stockBefore > line.lowStockThreshold) {
        const shopRow = await tx.query('select owner_user_id from shops where id = $1', [shopId]);
        await notificationRepo.insertNotification({ userId: shopRow.rows[0]?.owner_user_id, type: 'low_stock', title: 'Low stock', body: `${line.name} is running low (${newStock} left).`, data: { productId: line.productId } }, tx);
      }
    }

    await customerRepo.insertKhataTxn({ shopId, shopCustomerId: customer.id, txnType: 'bill', amount: paiseToNumeric(calc.totalPaise), billId: bill!.id, notes: `Bill #${seq!.next_bill_number}`, createdBy: userId }, tx);
    if (calc.amountPaidPaise > 0) {
      const payment = await billingRepo.insertCustomerPayment({ shopId, shopCustomerId: customer.id, amount: paiseToNumeric(calc.amountPaidPaise), method: input.method, notes: `Paid with bill #${seq!.next_bill_number}`, createdBy: userId }, tx);
      await billingRepo.insertPaymentAllocation(payment!.id, bill!.id, paiseToNumeric(calc.amountPaidPaise), tx);
      await customerRepo.insertKhataTxn({ shopId, shopCustomerId: customer.id, txnType: 'payment', amount: paiseToNumeric(-calc.amountPaidPaise), billId: bill!.id, paymentId: payment!.id, notes: `Paid with bill #${seq!.next_bill_number}`, createdBy: userId }, tx);
    }
    if (input.shoppingListId) await listRepo.setListCompleted(input.shoppingListId, shopId, tx);

    await notificationRepo.insertNotification({
      userId: customer.user_id, type: 'bill', title: `New bill from ${seq!.name}`,
      body: `Bill #${seq!.next_bill_number} - total ${paiseToNumeric(calc.totalPaise)}, due ${paiseToNumeric(calc.amountDuePaise)}`, data: { billId: bill!.id },
    }, tx);
    return getBill(bill!.id, tx);
  });
}

export async function getBill(billId: string, tx?: any) {
  const bill = await billingRepo.findBillById(billId, tx);
  if (!bill) throw notFound('Bill not found.');
  const [items, shop, customer] = await Promise.all([
    billingRepo.billItemsForBill(billId, tx),
    shopRepo.findShopById((bill as any).shop_id, tx),
    customerRepo.findShopCustomerById((bill as any).shop_customer_id, tx),
  ]);
  return {
    bill: {
      ...bill,
      shops: shop ? { name: (shop as any).name, phone: (shop as any).phone, address_line: (shop as any).address_line, area: (shop as any).area, city: (shop as any).city, owner_id: (shop as any).owner_user_id } : null,
      shop_customers: customer ? { name: (customer as any).name, phone: (customer as any).phone, user_id: (customer as any).user_id } : null,
    },
    items,
  };
}
export async function assertCanSeeBill(billId: string, userId: string, role: 'customer' | 'shopkeeper', shopMemberOf: (shopId: string) => Promise<boolean>) {
  const { bill } = await getBill(billId);
  if (role === 'shopkeeper') {
    if (!(await shopMemberOf((bill as any).shop_id))) throw forbidden();
  } else {
    const c = await customerRepo.findShopCustomerById((bill as any).shop_customer_id);
    if (!c || (c as any).user_id !== userId) throw forbidden();
  }
  return bill;
}

export async function recordPayment(shopId: string, userId: string, input: { shopCustomerId: string; amount: number; method: string; notes?: string; billId?: string; requestId: string }) {
  return withTx(async (tx) => {
    const existing = await billingRepo.findCustomerPaymentByRequestId(input.requestId, userId, tx);
    if (existing) return existing;

    const customer = await ownedCustomer(shopId, input.shopCustomerId, tx, true);
    const amountPaise = toPaise(input.amount);
    if (amountPaise <= 0) throw badRequest('Enter a payment above zero.');
    const balance = await customerRepo.balanceForCustomer(customer.id, tx);
    const balancePaise = toPaise(balance?.balance ?? 0);
    if (amountPaise > balancePaise) throw badRequest(`Payment (${paiseToNumeric(amountPaise)}) is more than the amount due (${paiseToNumeric(balancePaise)}).`);

    const payment = await billingRepo.insertCustomerPayment({ shopId, shopCustomerId: customer.id, requestId: input.requestId, amount: paiseToNumeric(amountPaise), method: input.method, notes: input.notes, createdBy: userId }, tx);

    let remaining = amountPaise;
    const openBills = await billingRepo.openBillsForCustomerOldestFirst(customer.id, input.billId ?? null, tx);
    for (const b of openBills as any[]) {
      if (remaining <= 0) break;
      const due = toPaise(b.amount_due);
      const alloc = Math.min(remaining, due);
      const newDue = due - alloc;
      await billingRepo.applyPaymentToBill(b.id, paiseToNumeric(alloc), paiseToNumeric(newDue), newDue === 0 ? 'paid' : 'partially_paid', tx);
      await billingRepo.insertPaymentAllocation(payment!.id, b.id, paiseToNumeric(alloc), tx);
      remaining -= alloc;
    }
    if (input.billId && remaining > 0) throw badRequest('That payment is more than the amount due on the selected bill.');

    await customerRepo.insertKhataTxn({ shopId, shopCustomerId: customer.id, txnType: 'payment', amount: paiseToNumeric(-amountPaise), billId: input.billId, paymentId: payment!.id, notes: input.notes || 'Payment received', createdBy: userId }, tx);
    await notificationRepo.insertNotification({ userId: customer.user_id, type: 'payment', title: 'Payment recorded', body: `Your payment of ${paiseToNumeric(amountPaise)} was recorded.`, data: { shopCustomerId: customer.id } }, tx);
    return payment;
  });
}

export async function recordAdjustment(shopId: string, userId: string, shopCustomerId: string, amount: number, direction: 'owes_more' | 'owes_less', reason: string) {
  const customer = await ownedCustomer(shopId, shopCustomerId);
  const signed = direction === 'owes_more' ? toPaise(amount) : -toPaise(amount);
  if (signed === 0) throw badRequest('Adjustment cannot be zero.');
  return customerRepo.insertKhataTxn({ shopId, shopCustomerId: customer.id, txnType: 'adjustment', amount: paiseToNumeric(signed), notes: reason, createdBy: userId });
}

export async function getLedger(shopCustomerId: string, userId: string, role: 'customer' | 'shopkeeper', shopMemberOf: (shopId: string) => Promise<boolean>) {
  const customer = await customerRepo.findShopCustomerById(shopCustomerId);
  if (!customer) throw notFound('Customer not found.');
  if (role === 'shopkeeper') { if (!(await shopMemberOf((customer as any).shop_id))) throw forbidden(); }
  else if ((customer as any).user_id !== userId) throw forbidden();
  const [txns, bills, balance, shop] = await Promise.all([
    customerRepo.khataTxnsForCustomer(shopCustomerId), customerRepo.billsForCustomer(shopCustomerId),
    customerRepo.balanceForCustomer(shopCustomerId), shopRepo.findShopById((customer as any).shop_id),
  ]);
  return { customer, shop, txns, bills, balance: balance?.balance ?? 0 };
}
export const myKhata = (userId: string) => customerRepo.myShopCustomerRows(userId);
