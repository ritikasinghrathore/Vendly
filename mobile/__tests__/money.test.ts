import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBill, lineTotalPaise, applyPayment, formatRupees, parseAmount, parseQty, toPaise } from '../src/lib/money';

// Test 1
test('2 x Rs60 = Rs120', () => {
  assert.equal(lineTotalPaise(2, 60), 12000);
});

// Test 2
test('2 kg x Rs60/kg + 1 kg x Rs50/kg = Rs170', () => {
  const b = computeBill([{ qty: 2, price: 60 }, { qty: 1, price: 50 }], 0, 0);
  assert.equal(b.total, 17000);
  assert.equal(b.due, 17000);
  assert.equal(b.status, 'unpaid');
  assert.deepEqual(b.errors, []);
});

// The example from the brief: Rice 2kg x 60, Sugar 1kg x 50, Agarbatti 2 x 30 = 230
test('brief example totals Rs230', () => {
  const b = computeBill([{ qty: 2, price: 60 }, { qty: 1, price: 50 }, { qty: 2, price: 30 }], 0, 0);
  assert.equal(b.total, 23000);
});

// Test 3
test('bill 1000, pay 600 -> due 400, partially paid', () => {
  const b = computeBill([{ qty: 1, price: 1000 }], 0, 600);
  assert.equal(b.paid, 60000);
  assert.equal(b.due, 40000);
  assert.equal(b.status, 'partially_paid');
});

// Test 4
test('bill 1000, pay 1000 -> due 0, paid', () => {
  const b = computeBill([{ qty: 1, price: 1000 }], 0, 1000);
  assert.equal(b.due, 0);
  assert.equal(b.status, 'paid');
});

test('later payments: 600 then 400 settles the bill, and cannot overpay', () => {
  const first = applyPayment(100000, 0, 60000);
  assert.deepEqual(first, { paid: 60000, due: 40000, status: 'partially_paid' });
  const second = applyPayment(100000, first.paid, 40000);
  assert.deepEqual(second, { paid: 100000, due: 0, status: 'paid' });
  assert.throws(() => applyPayment(100000, 100000, 1));
  assert.throws(() => applyPayment(100000, 0, 0));
});

// Test 5 (the database copies the price onto the bill; here we prove the maths uses the price it is given)
test('an old bill keeps its own price after the shop changes the price', () => {
  const oldBillLine = { qty: 2, price: 60 };      // saved on the bill in the past
  const currentShopPrice = 65;                     // rice is Rs65 today
  assert.equal(lineTotalPaise(oldBillLine.qty, oldBillLine.price), 12000);
  assert.equal(lineTotalPaise(oldBillLine.qty, currentShopPrice), 13000);
  assert.notEqual(lineTotalPaise(oldBillLine.qty, oldBillLine.price), lineTotalPaise(oldBillLine.qty, currentShopPrice));
});

test('no floating point drift', () => {
  assert.equal(lineTotalPaise(3, 0.1), 30);
  assert.equal(lineTotalPaise(0.1 + 0.2, 10), 300);          // 0.30000000000000004 x 10
  assert.equal(lineTotalPaise(1.005, 1), 101);               // 1.005 x 100 paise = 100.5 -> rounds half up
  assert.equal(lineTotalPaise(0.25, 41.99), 1050);           // 10.4975 -> 10.50
  assert.equal(toPaise('19.99'), 1999);
  assert.equal(toPaise(1.15), 115);
});

test('validation mirrors the database', () => {
  assert.ok(computeBill([{ qty: 0, price: 10 }], 0, 0).errors.length > 0);
  assert.ok(computeBill([{ qty: 1, price: 10 }], 20, 0).errors.length > 0);      // discount > subtotal
  assert.ok(computeBill([{ qty: 1, price: 10 }], 0, 11).errors.length > 0);      // paid > total
  assert.ok(computeBill([{ qty: 1, price: 10 }], 10, 0).errors.length > 0);      // total 0
  assert.deepEqual(computeBill([{ qty: 1, price: 100 }], 10, 40).errors, []);
  const b = computeBill([{ qty: 1, price: 100 }], 10, 40);
  assert.equal(b.total, 9000); assert.equal(b.due, 5000);
});

test('rupee formatting uses Indian grouping', () => {
  assert.equal(formatRupees(23000), '₹230');
  assert.equal(formatRupees(12345678), '₹1,23,456.78');
  assert.equal(formatRupees(100000000), '₹10,00,000');
  assert.equal(formatRupees(50), '₹0.50');
  assert.equal(formatRupees(-27000), '-₹270');
  assert.equal(formatRupees(27000, { sign: true }), '+₹270');
});

test('typed amounts and quantities are parsed strictly', () => {
  assert.equal(parseAmount('1,250.5'), 1250.5);
  assert.equal(parseAmount(''), 0);
  assert.equal(parseAmount('12.345'), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseQty('0.250'), 0.25);
  assert.equal(parseQty('2,5'), 2.5);
  assert.equal(parseQty(''), null);
  assert.equal(parseQty('1.2345'), null);
});
