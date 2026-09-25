// All money maths is done in whole paise (integers) and quantities in thousandths, so 0.1 + 0.2 style
// errors cannot happen. The database re-does every calculation with NUMERIC before saving.

export type PayStatus = 'paid' | 'unpaid' | 'partially_paid';

export const toPaise = (rupees: number | string): number => Math.round(Number(rupees) * 100);
export const toRupees = (paise: number): number => paise / 100;
const toMilli = (qty: number | string): number => Math.round(Number(qty) * 1000);

/** quantity x unit price, rounded to the nearest paise (half up), like the database does. */
export function lineTotalPaise(qty: number | string, priceRupees: number | string): number {
  const product = toMilli(qty) * toPaise(priceRupees); // paise x 1000
  return Math.floor((product + 500) / 1000);
}

export interface BillLineInput { qty: number; price: number }
export interface BillCalc {
  subtotal: number; discount: number; total: number; paid: number; due: number;
  status: PayStatus; errors: string[];
}

export function computeBill(lines: BillLineInput[], discountRupees: number, paidRupees: number): BillCalc {
  const errors: string[] = [];
  let subtotal = 0;
  for (const l of lines) {
    if (!(l.qty > 0)) errors.push('Every quantity must be more than zero.');
    if (l.price < 0) errors.push('A price cannot be negative.');
    subtotal += lineTotalPaise(l.qty, l.price);
  }
  const discount = toPaise(discountRupees || 0);
  const paid = toPaise(paidRupees || 0);
  if (discount < 0) errors.push('Discount cannot be negative.');
  if (paid < 0) errors.push('Amount paid cannot be negative.');
  if (discount > subtotal) errors.push('Discount cannot be more than the bill subtotal.');
  const total = subtotal - discount;
  if (lines.length > 0 && total <= 0) errors.push('Bill total must be more than zero.');
  if (paid > total) errors.push('Amount paid cannot be more than the bill total.');
  const due = total - paid;
  return { subtotal, discount, total, paid, due, status: statusFor(paid, due), errors: Array.from(new Set(errors)) };
}

export function statusFor(paidPaise: number, duePaise: number): PayStatus {
  if (duePaise === 0) return 'paid';
  if (paidPaise === 0) return 'unpaid';
  return 'partially_paid';
}

/** Adds a payment to a bill and returns the new paid / due / status. Never lets it go over the bill. */
export function applyPayment(totalPaise: number, paidPaise: number, paymentPaise: number) {
  if (paymentPaise <= 0) throw new Error('Payment must be more than zero.');
  const due = totalPaise - paidPaise;
  if (paymentPaise > due) throw new Error('Payment is more than the amount due.');
  const paid = paidPaise + paymentPaise;
  return { paid, due: totalPaise - paid, status: statusFor(paid, totalPaise - paid) };
}

/** 123456.5 paise-precise -> "1,23,456.50" (Indian digit grouping). */
export function groupIndian(intPart: string): string {
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

export function formatRupees(paise: number, opts: { sign?: boolean } = {}): string {
  const neg = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const p = abs % 100;
  const body = groupIndian(String(rupees)) + (p ? `.${String(p).padStart(2, '0')}` : '');
  const sign = neg ? '-' : opts.sign && abs > 0 ? '+' : '';
  return `${sign}₹${body}`;
}

/** For values that arrive from the database as rupee numbers. */
export const rupees = (n: number | string, opts: { sign?: boolean } = {}) => formatRupees(toPaise(n), opts);

/** Parses what a person typed into an amount box. Returns null if it is not a valid amount. */
export function parseAmount(text: string): number | null {
  const t = text.replace(/[,\s₹]/g, '');
  if (t === '') return 0;
  if (!/^\d*\.?\d{0,2}$/.test(t) || t === '.') return null;
  return Number(t);
}

/** Quantities may have up to 3 decimals (0.250 kg). Returns null when invalid or empty. */
export function parseQty(text: string): number | null {
  const t = text.replace(/,/g, '.').trim();
  if (!/^\d*\.?\d{0,3}$/.test(t) || t === '' || t === '.') return null;
  return Number(t);
}
