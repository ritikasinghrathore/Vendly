// All money maths is done in whole paise (integers) and quantities in thousandths, so floating point
// errors cannot happen. The database also re-checks every bill total with CHECK constraints.

export const toPaise = (rupees: number | string): number => Math.round(Number(rupees) * 100);
export const toMilli = (qty: number | string): number => Math.round(Number(qty) * 1000);

/** quantity x unit price, rounded to the nearest paisa (half up) - matches round(qty * price, 2) in PostgreSQL. */
export function lineTotalPaise(qty: number | string, priceRupees: number | string): number {
  return Math.floor((toMilli(qty) * toPaise(priceRupees) + 500) / 1000);
}
/** Paise (integer) -> exact string for a NUMERIC(12,2) column, e.g. 12050 -> "120.50". */
export const paiseToNumeric = (paise: number): string => (paise / 100).toFixed(2);
/** Milli-units (integer) -> exact string for a NUMERIC(12,3) column. */
export const milliToNumeric = (milli: number): string => (milli / 1000).toFixed(3);

export type PayStatus = 'paid' | 'unpaid' | 'partially_paid';
export function payStatusFor(paidPaise: number, duePaise: number): PayStatus {
  if (duePaise === 0) return 'paid';
  if (paidPaise === 0) return 'unpaid';
  return 'partially_paid';
}

export interface BillLineInput { productId: string; quantity: number }
export interface PricedLine { productId: string; name: string; unit: string; quantity: number; unitPrice: number; lineTotalPaise: number }
export interface BillCalc { subtotalPaise: number; discountPaise: number; totalPaise: number; amountPaidPaise: number; amountDuePaise: number; status: PayStatus }

export function computeBill(lines: PricedLine[], discountRupees: number, paidRupees: number): BillCalc {
  const subtotalPaise = lines.reduce((s, l) => s + l.lineTotalPaise, 0);
  const discountPaise = toPaise(discountRupees || 0);
  const totalPaise = subtotalPaise - discountPaise;
  const amountPaidPaise = toPaise(paidRupees || 0);
  const amountDuePaise = totalPaise - amountPaidPaise;
  return { subtotalPaise, discountPaise, totalPaise, amountPaidPaise, amountDuePaise, status: payStatusFor(amountPaidPaise, amountDuePaise) };
}
