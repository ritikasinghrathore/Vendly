import { Linking, Share } from 'react-native';
import { rupees } from './money';
import { formatDate, qtyLabel } from './format';
import type { Bill } from './types';

const digits = (s: string) => s.replace(/\D/g, '');
export function indianNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = digits(phone);
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith('91')) return d;
  return d.length >= 10 ? d : null;
}

/** Only ever called from a button the person taps (never automatic). */
export async function openWhatsApp(text: string, phone?: string | null) {
  const num = indianNumber(phone);
  const url = `https://wa.me/${num ?? ''}?text=${encodeURIComponent(text)}`;
  try { await Linking.openURL(url); } catch { await Share.share({ message: text }); }
}
export const callPhone = (phone: string) => Linking.openURL(`tel:${digits(phone)}`);

export function billText(bill: Bill): string {
  const shop = bill.shops;
  const lines = (bill.bill_items ?? [])
    .map((i) => `${i.product_name_snapshot}  ${qtyLabel(i.quantity, i.unit)} × ${rupees(i.unit_price)} = ${rupees(i.line_total)}`)
    .join('\n');
  const where = [shop?.area, shop?.city].filter(Boolean).join(', ');
  return [
    `*${shop?.name ?? 'Bill'}*${where ? `\n${where}` : ''}`,
    `Bill #${bill.bill_number} • ${formatDate(bill.created_at)}`,
    `Customer: ${bill.shop_customers?.name ?? ''}`,
    '',
    lines,
    '',
    bill.discount > 0 ? `Discount: ${rupees(bill.discount)}` : '',
    `Total: ${rupees(bill.total_amount)}`,
    `Paid: ${rupees(bill.amount_paid)}`,
    `Due: ${rupees(bill.amount_due)}`,
    shop?.phone ? `\nShop: ${shop.phone}` : '',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim();
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
export function billHtml(bill: Bill): string {
  const shop = bill.shops;
  const rows = (bill.bill_items ?? []).map((i) => `
    <tr><td>${esc(i.product_name_snapshot)}</td><td>${esc(qtyLabel(i.quantity, i.unit))}</td>
    <td class="r">${esc(rupees(i.unit_price))}</td><td class="r">${esc(rupees(i.line_total))}</td></tr>`).join('');
  return `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>
    body{font-family:Helvetica,Arial,sans-serif;color:#33223F;padding:24px;max-width:520px;margin:auto}
    h1{font-size:22px;margin:0} .m{color:#6E5C7B;font-size:13px;margin:2px 0}
    table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px} td,th{padding:6px 4px;border-bottom:1px solid #EADDEC;text-align:left}
    .r{text-align:right} .t td{border:none;font-weight:bold} </style></head><body>
    <h1>${esc(shop?.name ?? '')}</h1>
    <p class="m">${esc([shop?.address_line, shop?.area, shop?.city].filter(Boolean).join(', '))}</p>
    <p class="m">${esc(shop?.phone ?? '')}</p>
    <p class="m">Bill #${bill.bill_number} · ${esc(formatDate(bill.created_at))}</p>
    <p class="m">Customer: ${esc(bill.shop_customers?.name ?? '')}</p>
    <table><tr><th>Item</th><th>Qty</th><th class="r">Price</th><th class="r">Amount</th></tr>${rows}
    ${bill.discount > 0 ? `<tr class="t"><td colspan="3">Discount</td><td class="r">- ${esc(rupees(bill.discount))}</td></tr>` : ''}
    <tr class="t"><td colspan="3">Total</td><td class="r">${esc(rupees(bill.total_amount))}</td></tr>
    <tr class="t"><td colspan="3">Paid</td><td class="r">${esc(rupees(bill.amount_paid))}</td></tr>
    <tr class="t"><td colspan="3">Due</td><td class="r">${esc(rupees(bill.amount_due))}</td></tr></table>
    <p class="m" style="margin-top:24px">Thank you for shopping with us.</p></body></html>`;
}
