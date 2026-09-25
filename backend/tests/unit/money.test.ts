import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBill, lineTotalPaise, paiseToNumeric, payStatusFor, toPaise } from '../../src/utils/money';

test('2 x Rs60 = Rs120', () => {
  assert.equal(lineTotalPaise(2, 60), 12000);
});

test('2 kg x Rs60/kg + 1 kg x Rs50/kg = Rs170', () => {
  const lines = [{ productId: 'a', name: 'Rice', unit: 'kg', quantity: 2, unitPrice: 60, lineTotalPaise: lineTotalPaise(2, 60) },
                 { productId: 'b', name: 'Sugar', unit: 'kg', quantity: 1, unitPrice: 50, lineTotalPaise: lineTotalPaise(1, 50) }];
  const calc = computeBill(lines, 0, 0);
  assert.equal(calc.totalPaise, 17000);
  assert.equal(calc.amountDuePaise, 17000);
  assert.equal(calc.status, 'unpaid');
});

test('brief example: Rice 2kg x 60, Sugar 1kg x 50, Agarbatti 2 x 30 = Rs230', () => {
  const lines = [
    { productId: 'a', name: 'Rice', unit: 'kg', quantity: 2, unitPrice: 60, lineTotalPaise: lineTotalPaise(2, 60) },
    { productId: 'b', name: 'Sugar', unit: 'kg', quantity: 1, unitPrice: 50, lineTotalPaise: lineTotalPaise(1, 50) },
    { productId: 'c', name: 'Agarbatti', unit: 'packet', quantity: 2, unitPrice: 30, lineTotalPaise: lineTotalPaise(2, 30) },
  ];
  assert.equal(computeBill(lines, 0, 0).totalPaise, 23000);
});

test('bill 1000, pay 600 -> due 400, partially_paid', () => {
  const lines = [{ productId: 'a', name: 'x', unit: 'piece', quantity: 1, unitPrice: 1000, lineTotalPaise: lineTotalPaise(1, 1000) }];
  const calc = computeBill(lines, 0, 600);
  assert.equal(calc.amountPaidPaise, 60000);
  assert.equal(calc.amountDuePaise, 40000);
  assert.equal(calc.status, 'partially_paid');
});

test('bill 1000, pay 1000 -> due 0, paid', () => {
  const lines = [{ productId: 'a', name: 'x', unit: 'piece', quantity: 1, unitPrice: 1000, lineTotalPaise: lineTotalPaise(1, 1000) }];
  const calc = computeBill(lines, 0, 1000);
  assert.equal(calc.amountDuePaise, 0);
  assert.equal(calc.status, 'paid');
});

test('payStatusFor matches the database CHECK constraint logic', () => {
  assert.equal(payStatusFor(0, 100), 'unpaid');
  assert.equal(payStatusFor(50, 50), 'partially_paid');
  assert.equal(payStatusFor(100, 0), 'paid');
});

test('no floating point drift', () => {
  assert.equal(lineTotalPaise(3, 0.1), 30);
  assert.equal(lineTotalPaise(0.1 + 0.2, 10), 300); // 0.30000000000000004 x 10
  assert.equal(lineTotalPaise(1.005, 1), 101);       // 100.5 paise -> rounds half up
  assert.equal(toPaise('19.99'), 1999);
  assert.equal(paiseToNumeric(12050), '120.50');
});

test('a discount larger than the subtotal is flagged (mirrors the "discount <= subtotal" DB constraint)', () => {
  const lines = [{ productId: 'a', name: 'x', unit: 'piece', quantity: 1, unitPrice: 10, lineTotalPaise: lineTotalPaise(1, 10) }];
  const calc = computeBill(lines, 20, 0);
  assert.ok(calc.discountPaise > calc.subtotalPaise); // the service layer rejects this before saving
});
