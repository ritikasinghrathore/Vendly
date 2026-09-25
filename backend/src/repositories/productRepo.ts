import { one, query, type Db } from '../db/pool';
import { likePattern } from '../utils/like';

const ALLOWED = new Set(['name', 'name_hi', 'description', 'category_id', 'price', 'is_available', 'is_active', 'image_id']);
const SELECT = `select p.*, i.quantity as stock_quantity, i.low_stock_threshold
                from products p join inventory i on i.product_id = p.id`;

export const insertProduct = (p: any, db?: Db) => one(
  `insert into products (shop_id, category_id, name, name_hi, description, unit, price, image_id)
   values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
  [p.shopId, p.categoryId ?? null, p.name, p.nameHi ?? null, p.description ?? null, p.unit, p.price, p.imageId ?? null], db,
);
export const insertInventoryRow = (p: { productId: string; shopId: string; quantity: number | string; lowStockThreshold: number }, db?: Db) =>
  query('insert into inventory (product_id, shop_id, quantity, low_stock_threshold) values ($1,$2,$3,$4)',
    [p.productId, p.shopId, p.quantity, p.lowStockThreshold], db);
export const insertInventoryMovement = (m: any, db?: Db) => query(
  `insert into inventory_movements (shop_id, product_id, change_quantity, stock_after, reason, bill_id, notes, created_by)
   values ($1,$2,$3,$4,$5,$6,$7,$8)`,
  [m.shopId, m.productId, m.changeQuantity, m.stockAfter, m.reason, m.billId ?? null, m.notes ?? null, m.createdBy ?? null], db,
);
export const findProductById = (id: string, db?: Db) => one(`${SELECT} where p.id = $1`, [id], db);
export const findProductForUpdate = (id: string, db?: Db) => one(`${SELECT} where p.id = $1 for update of p, i`, [id], db);
export const listProductsForShop = (shopId: string, db?: Db) => query(`${SELECT} where p.shop_id = $1 order by p.name limit 2000`, [shopId], db);
export const searchAvailableProducts = (q: string, db?: Db) =>
  query(
    `select p.*, i.quantity as stock_quantity, s.id as shop_id, s.name as shop_name, s.area as shop_area, s.city as shop_city, s.is_open as shop_is_open
     from products p join inventory i on i.product_id = p.id join shops s on s.id = p.shop_id
     where p.is_active = true and s.is_active = true and (p.name ilike $1 escape '\\' or p.name_hi ilike $1 escape '\\')
     order by p.name limit 80`, [likePattern(q)], db,
  );
export function updateProductRow(id: string, patch: Record<string, unknown>, db?: Db) {
  const cols = Object.keys(patch);
  for (const c of cols) if (!ALLOWED.has(c)) throw new Error(`updateProductRow: column not allowed: ${c}`);
  if (cols.length === 0) return findProductById(id, db);
  const set = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
  return one(`update products set ${set} where id = $1 returning *`, [id, ...cols.map((c) => patch[c])], db);
}
export const updateInventoryQuantity = (productId: string, quantity: number, db?: Db) =>
  one<{ quantity: number }>('update inventory set quantity = $2, updated_at = now() where product_id = $1 returning quantity', [productId, quantity], db);
export const insertPriceHistory = (h: any, db?: Db) => query(
  'insert into product_price_history (product_id, shop_id, old_price, new_price, changed_by) values ($1,$2,$3,$4,$5)',
  [h.productId, h.shopId, h.oldPrice, h.newPrice, h.changedBy ?? null], db,
);
export const listCategories = (db?: Db) => query('select * from categories order by sort_order', [], db);
