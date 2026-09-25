export const PLAN = {
  code: 'vendly_shopkeeper_pro',
  name: 'Vendly Shopkeeper Pro',
  interval: 'month' as const,
  currency: 'INR' as const,
};
export const MAX_SHOPS_PER_USER = 5;
export const MAX_IMAGES_PER_USER = 300;
export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 15;
export const SHOP_TYPES = ['grocery', 'puja', 'stationery', 'medical', 'dairy', 'vegetables', 'other'] as const;
export const UNITS = ['piece', 'packet', 'kg', 'gram', 'litre', 'ml', 'box', 'dozen'] as const;
export const PAY_METHODS = ['cash', 'upi', 'card', 'other'] as const;
