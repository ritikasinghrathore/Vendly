import type { UnitType } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
export function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `Today, ${formatTime(iso)}` : `${formatDate(iso)}, ${formatTime(iso)}`;
}

export const UNIT_LABEL: Record<UnitType, string> = {
  piece: 'pc', packet: 'packet', kg: 'kg', gram: 'g', litre: 'litre', ml: 'ml', box: 'box', dozen: 'dozen',
};
export const UNIT_STEP: Record<UnitType, number> = {
  piece: 1, packet: 1, kg: 0.5, gram: 100, litre: 0.5, ml: 100, box: 1, dozen: 1,
};
export const UNITS: UnitType[] = ['piece', 'packet', 'kg', 'gram', 'litre', 'ml', 'box', 'dozen'];

export const round3 = (n: number) => Math.round(n * 1000) / 1000;
export function formatQty(q: number | string): string {
  const n = round3(Number(q));
  return Number.isInteger(n) ? String(n) : String(n);
}
export const qtyLabel = (q: number | string, unit: UnitType) => `${formatQty(q)} ${UNIT_LABEL[unit]}`;

export const SHOP_TYPES: { key: string; label: string }[] = [
  { key: 'grocery', label: 'Grocery' },
  { key: 'puja', label: 'Puja items' },
  { key: 'vegetables', label: 'Vegetables' },
  { key: 'dairy', label: 'Dairy' },
  { key: 'stationery', label: 'Stationery' },
  { key: 'medical', label: 'Medical' },
  { key: 'other', label: 'Other' },
];
export const shopTypeLabel = (key: string) => SHOP_TYPES.find((t) => t.key === key)?.label ?? 'Shop';
export const firstName = (full?: string | null) => (full ?? '').trim().split(/\s+/)[0] || 'friend';

export const STATUS_LABEL: Record<string, { text: string; tone: 'plum' | 'green' | 'gold' | 'grey' }> = {
  draft: { text: 'Not sent yet', tone: 'gold' },
  submitted: { text: 'Sent to shop', tone: 'plum' },
  viewed: { text: 'Shop has seen it', tone: 'plum' },
  completed: { text: 'Billed', tone: 'green' },
  cancelled: { text: 'Cancelled', tone: 'grey' },
};
export const firstQty = (unit: UnitType) => (unit === 'gram' || unit === 'ml' ? 100 : 1);
