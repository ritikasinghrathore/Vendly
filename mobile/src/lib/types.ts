export type UnitType = 'piece' | 'packet' | 'kg' | 'gram' | 'litre' | 'ml' | 'box' | 'dozen';
export type AccountType = 'customer' | 'shopkeeper';
export type ListStatus = 'draft' | 'submitted' | 'viewed' | 'completed' | 'cancelled';
export type PayMethod = 'cash' | 'upi' | 'card' | 'other';
export type TxnType = 'bill' | 'payment' | 'adjustment' | 'refund';

export interface Profile {
  id: string; email: string | null; full_name: string; phone: string | null;
  avatar_url: string | null; account_type: AccountType | null;
}
export interface Shop {
  id: string; owner_id: string; owner_name: string; name: string; tagline: string | null; description: string | null;
  shop_type: string; phone: string | null; address_line: string | null; area: string | null;
  city: string; state: string | null; pincode: string | null; logo_url: string | null;
  is_open: boolean; is_active: boolean; is_verified: boolean;
}
export interface Category { id: string; name: string; name_hi: string | null; sort_order: number }
export interface Product {
  id: string; shop_id: string; category_id: string | null; name: string; name_hi: string | null;
  description: string | null; image_url: string | null; image_id: string | null; unit: UnitType; price: number;
  stock_quantity: number; low_stock_threshold: number; is_available: boolean; is_active: boolean;
}
export interface ShopCustomer {
  id: string; shop_id: string; user_id: string | null; name: string; phone: string | null;
  notes: string | null; balance?: number;
}
export interface ListItem {
  id: string; product_id: string | null; quantity: number; unit: UnitType; product_name_snapshot: string;
  products?: { price: number; is_available: boolean; stock_quantity: number } | null;
}
export interface ShoppingList {
  id: string; shop_id: string; customer_id: string; shop_customer_id: string | null; status: ListStatus;
  notes: string | null; submitted_at: string | null; viewed_at: string | null; created_at: string;
  shops?: { id: string; name: string; phone: string | null; is_open: boolean } | null;
  shop_customers?: { id: string; name: string; phone: string | null } | null;
  shopping_list_items?: ListItem[];
}
export interface BillItem {
  id: string; product_name_snapshot: string; quantity: number; unit: UnitType; unit_price: number; line_total: number;
}
export interface Bill {
  id: string; shop_id: string; bill_number: number; shop_customer_id: string; subtotal: number; discount: number;
  total_amount: number; amount_paid: number; amount_due: number; payment_status: 'paid' | 'unpaid' | 'partially_paid';
  notes: string | null; created_at: string;
  bill_items?: BillItem[];
  shops?: { name: string; phone: string | null; address_line: string | null; area: string | null; city: string; owner_id?: string } | null;
  shop_customers?: { name: string; phone: string | null; user_id: string | null } | null;
}
export interface KhataTxn {
  id: string; shop_id: string; shop_customer_id: string; txn_type: TxnType; amount: number;
  bill_id: string | null; payment_id: string | null; notes: string | null; created_at: string;
}
export interface AppNotification {
  id: string; type: string; title: string; body: string | null; data: Record<string, any>;
  read_at: string | null; created_at: string;
}
