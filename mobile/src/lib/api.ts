// Every call to the backend goes through this file. Field names below match what the Vendly API
// returns (mostly snake_case, straight from PostgreSQL) so screens can read them directly.
import * as Crypto from 'expo-crypto';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, ApiError, friendly, isNetworkError, qs } from './apiClient';
import { imageUrl } from '../config';
import { toPaise } from './money';
import type {
  AccountType, AppNotification, Bill, BillItem, Category, KhataTxn, ListItem, PayMethod, Product,
  Shop, ShopCustomer, ShoppingList, UnitType,
} from './types';

export { friendly, isNetworkError, ApiError };
export const newRequestId = (): string => Crypto.randomUUID();

// ---------------------------------------------------------------- account
export const updateProfile = (patch: { name?: string; phone?: string | null }) => apiPatch('/api/v1/auth/me', patch);
export const deleteMyAccount = () => apiDelete('/api/v1/auth/me');
export const changePassword = (currentPassword: string, newPassword: string) =>
  apiPost('/api/v1/auth/change-password', { currentPassword, newPassword });

// ---------------------------------------------------------------- shops
function withLogoUrl<T extends { logo_image_id?: string | null }>(s: T): T & { logo_url: string | null } {
  return { ...s, logo_url: imageUrl(s.logo_image_id) };
}
export async function listShops(): Promise<Shop[]> {
  const { shops } = await apiGet<{ shops: any[] }>('/api/v1/shops');
  return shops.map(withLogoUrl);
}
export async function searchShopsByText(q: string): Promise<Shop[]> {
  const { shops } = await apiGet<{ shops: any[] }>(`/api/v1/shops${qs({ q })}`);
  return shops.map(withLogoUrl);
}
export async function getShop(id: string): Promise<Shop> {
  const { shop } = await apiGet<{ shop: any }>(`/api/v1/shops/${id}`);
  return withLogoUrl(shop);
}
export interface ShopInput {
  name: string; ownerName: string; tagline?: string | null; description?: string | null; shopType: string;
  phone: string; addressLine: string; area?: string | null; city: string; state: string; pincode: string;
  logoImageId?: string | null;
}
export async function createShop(input: ShopInput): Promise<Shop> {
  const { shop } = await apiPost<{ shop: any }>('/api/v1/shops', input);
  return withLogoUrl(shop);
}
export async function updateShop(id: string, patch: Partial<ShopInput> & { isOpen?: boolean }): Promise<Shop> {
  const { shop } = await apiPatch<{ shop: any }>(`/api/v1/shops/${id}`, patch);
  return withLogoUrl(shop);
}

// ---------------------------------------------------------------- subscription
export interface SubscriptionStatus { status: string; hasAccess: boolean; accessUntil: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; checkoutUrl: string | null }
export const getSubscription = (shopId: string) => apiGet<SubscriptionStatus>(`/api/v1/shops/${shopId}/subscription`);
export const startSubscriptionCheckout = (shopId: string) => apiPost<{ checkoutUrl: string }>(`/api/v1/shops/${shopId}/subscription/checkout`);
export const cancelSubscription = (shopId: string) => apiPost<{ message: string }>(`/api/v1/shops/${shopId}/subscription/cancel`);

// ---------------------------------------------------------------- products
export const listCategories = () => apiGet<{ categories: Category[] }>('/api/v1/categories').then((r) => r.categories);
function withProductImage<T extends { image_id?: string | null }>(p: T): T & { image_url: string | null } {
  return { ...p, image_url: imageUrl(p.image_id) };
}
export async function listProducts(shopId: string): Promise<Product[]> {
  const { products } = await apiGet<{ products: any[] }>(`/api/v1/shops/${shopId}/products`);
  return products.map(withProductImage);
}
export async function getProduct(shopId: string, productId: string): Promise<Product> {
  const { product } = await apiGet<{ product: any }>(`/api/v1/shops/${shopId}/products/${productId}`);
  return withProductImage(product);
}
export interface ProductHit extends Product { shop_id: string; shop_name: string; shop_area: string | null; shop_city: string; shop_is_open: boolean }
export async function searchProducts(q: string): Promise<ProductHit[]> {
  if (q.trim().length < 2) return [];
  const { products } = await apiGet<{ products: any[] }>(`/api/v1/products/search${qs({ q })}`);
  return products.map(withProductImage);
}
export interface NewProduct {
  shopId: string; name: string; nameHi?: string; unit: UnitType; price: number; categoryId?: string | null;
  openingStock: number; lowStockThreshold: number; imageId?: string | null;
}
export async function createProduct(p: NewProduct): Promise<Product> {
  const { product } = await apiPost<{ product: any }>(`/api/v1/shops/${p.shopId}/products`, p);
  return withProductImage(product);
}
export interface ProductPatch {
  name?: string; name_hi?: string | null; price?: number; category_id?: string | null; description?: string | null;
  low_stock_threshold?: number; is_available?: boolean; is_active?: boolean; image_id?: string | null;
}
export async function updateProduct(shopId: string, productId: string, patch: ProductPatch) {
  const body = {
    name: patch.name, nameHi: patch.name_hi, price: patch.price, categoryId: patch.category_id, description: patch.description,
    lowStockThreshold: patch.low_stock_threshold, isAvailable: patch.is_available, isActive: patch.is_active, imageId: patch.image_id,
  };
  const { product } = await apiPatch<{ product: any }>(`/api/v1/shops/${shopId}/products/${productId}`, body);
  return withProductImage(product);
}
export const adjustStock = (shopId: string, productId: string, mode: 'add' | 'reduce' | 'set', quantity: number, notes?: string) =>
  apiPost<{ quantity: number }>(`/api/v1/shops/${shopId}/products/${productId}/stock`, { mode, quantity, notes }).then((r) => r.quantity);

// ---------------------------------------------------------------- shopping lists (customer side)
export async function getDraft(shopId: string): Promise<ShoppingList | null> {
  const { draft } = await apiGet<{ draft: any | null }>(`/api/v1/shops/${shopId}/lists/draft`);
  if (!draft) return null;
  return getList(draft.id);
}
export const setItemQty = (shopId: string, productId: string, quantity: number) =>
  apiPut<{ list: any }>(`/api/v1/shops/${shopId}/lists/draft/items`, { productId, quantity });
export const myLists = () => apiGet<{ lists: any[] }>('/api/v1/lists/mine').then((r) => r.lists);
export async function getList(id: string): Promise<ShoppingList> {
  const { list, items, shop } = await apiGet<{ list: any; items: any[]; shop: any }>(`/api/v1/lists/${id}`);
  return { ...list, shops: shop ? withLogoUrl(shop) : null, shopping_list_items: items } as ShoppingList;
}
export const discardDraft = (id: string) => apiDelete(`/api/v1/lists/${id}`);
export const setListNotes = (id: string, notes: string) => apiPatch(`/api/v1/lists/${id}/notes`, { notes: notes.trim() });
export const submitList = (id: string) => apiPost(`/api/v1/lists/${id}/submit`);

// ---------------------------------------------------------------- shopping lists (shop side)
export const incomingLists = (shopId: string) => apiGet<{ lists: any[] }>(`/api/v1/shops/${shopId}/lists/incoming`).then((r) => r.lists);
export const markViewed = (shopId: string, listId: string) => apiPost(`/api/v1/shops/${shopId}/lists/${listId}/view`);

// ---------------------------------------------------------------- customers & khata
export const listShopCustomers = (shopId: string) => apiGet<{ customers: ShopCustomer[] }>(`/api/v1/shops/${shopId}/customers`).then((r) => r.customers);
export const searchShopCustomers = (shopId: string, q: string) =>
  apiGet<{ customers: ShopCustomer[] }>(`/api/v1/shops/${shopId}/customers/search${qs({ q })}`).then((r) => r.customers);
export const addShopCustomer = (shopId: string, name: string, phone: string) =>
  apiPost<{ customer: ShopCustomer }>(`/api/v1/shops/${shopId}/customers`, { name, phone: phone || undefined }).then((r) => r.customer);

export interface Ledger { customer: ShopCustomer & { shops: { id: string; name: string; phone: string | null; owner_id: string } }; txns: KhataTxn[]; bills: any[]; balancePaise: number }
export async function getLedger(shopCustomerId: string): Promise<Ledger> {
  const data = await apiGet<{ customer: any; shop: any; txns: KhataTxn[]; bills: any[]; balance: number }>(`/api/v1/shop-customers/${shopCustomerId}/ledger`);
  return {
    customer: { ...data.customer, shops: { id: data.shop?.id, name: data.shop?.name, phone: data.shop?.phone, owner_id: data.shop?.owner_user_id } },
    txns: data.txns, bills: data.bills, balancePaise: toPaise(data.balance),
  };
}
export interface MyKhataRow { customerId: string; shop: { id: string; name: string; phone: string | null; area: string | null }; balancePaise: number }
export async function myKhata(): Promise<MyKhataRow[]> {
  const { shops } = await apiGet<{ shops: any[] }>('/api/v1/khata/mine');
  return shops.map((r) => ({ customerId: r.id, shop: { id: r.shop_id, name: r.shop_name, phone: r.shop_phone, area: r.shop_area }, balancePaise: toPaise(r.balance) }));
}

// ---------------------------------------------------------------- billing (server recalculates every total)
export interface CreateBillArgs {
  shopId: string; shopCustomerId: string; items: { product_id: string; quantity: number }[]; discount: number; paid: number;
  method: PayMethod; notes?: string; listId?: string | null; requestId: string;
}
export async function createBill(a: CreateBillArgs): Promise<Bill> {
  const body = { shopCustomerId: a.shopCustomerId, items: a.items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
    discount: a.discount, amountPaid: a.paid, method: a.method, notes: a.notes, shoppingListId: a.listId ?? undefined, requestId: a.requestId };
  try {
    const { bill, items } = await apiPost<{ bill: any; items: BillItem[] }>(`/api/v1/shops/${a.shopId}/bills`, body);
    return { ...bill, bill_items: items };
  } catch (e) {
    if (isNetworkError(e)) {
      // The request carries a requestId, so calling createBill again with the SAME id is always safe:
      // if the first attempt actually reached the server, the backend returns that same bill instead
      // of creating a second one. Re-throw so the screen can offer "Try again" rather than guessing here.
      throw new ApiError(0, 'NETWORK', 'Connection lost. We could not confirm if the bill was saved. Check the customer\'s khata, or try again - it is safe to retry.');
    }
    throw e;
  }
}
export async function getBill(id: string): Promise<Bill> {
  const { bill, items } = await apiGet<{ bill: any; items: BillItem[] }>(`/api/v1/bills/${id}`);
  return { ...bill, bill_items: [...items].sort((a, b) => a.product_name_snapshot.localeCompare(b.product_name_snapshot)) };
}

export interface PaymentArgs { shopId: string; shopCustomerId: string; amount: number; method: PayMethod; notes?: string; billId?: string | null; requestId: string }
export async function recordPayment(a: PaymentArgs): Promise<void> {
  const body = { amount: a.amount, method: a.method, notes: a.notes, billId: a.billId ?? undefined, requestId: a.requestId };
  try { await apiPost(`/api/v1/shops/${a.shopId}/customers/${a.shopCustomerId}/payments`, body); }
  catch (e) {
    if (isNetworkError(e)) throw new ApiError(0, 'NETWORK', 'Connection lost. We could not confirm if the payment was saved. Check the khata before trying again.');
    throw e;
  }
}
export const recordAdjustment = (shopId: string, shopCustomerId: string, amount: number, direction: 'owes_more' | 'owes_less', reason: string) =>
  apiPost(`/api/v1/shops/${shopId}/customers/${shopCustomerId}/adjustments`, { amount, direction, reason });

// ---------------------------------------------------------------- dashboard
export interface Dashboard { todaySales: number; todayBills: number; pendingBills: number; outstanding: number; lowStock: number; newLists: number }
export const dashboard = (shopId: string) => apiGet<Dashboard>(`/api/v1/shops/${shopId}/dashboard`);
export interface SalesDay { sale_day: string; bill_count: number; sales: number; collected: number }
export const salesSummary = (shopId: string, days = 7) => apiGet<{ days: SalesDay[] }>(`/api/v1/shops/${shopId}/sales-summary${qs({ days })}`).then((r) => r.days);

// ---------------------------------------------------------------- notifications
export const listNotifications = () => apiGet<{ notifications: AppNotification[] }>('/api/v1/notifications').then((r) => r.notifications);
export const markAllRead = () => apiPost('/api/v1/notifications/mark-all-read');

// ---------------------------------------------------------------- images
export async function uploadImage(mime: string, base64: string): Promise<string> {
  const { id } = await apiPost<{ id: string; url: string }>('/api/v1/images', { mime, base64 });
  return id;
}
export type { AccountType };
