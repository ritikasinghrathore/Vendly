import { one, query, type Db } from '../db/pool';
import { likePattern } from '../utils/like';

// Only these column names ever reach the dynamic UPDATE below; patch objects are always built by our
// own service code from a validated request, never forwarded from raw req.body.
const ALLOWED = new Set([
  'name', 'owner_name', 'tagline', 'description', 'shop_type', 'phone', 'address_line', 'area', 'city',
  'state', 'pincode', 'is_open', 'logo_image_id',
]);

export const insertShop = (s: any, db?: Db) => one(
  `insert into shops (owner_user_id, name, owner_name, tagline, description, shop_type, phone, address_line, area, city, state, pincode)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
  [s.ownerUserId, s.name, s.ownerName, s.tagline ?? null, s.description ?? null, s.shopType, s.phone, s.addressLine, s.area ?? null, s.city, s.state, s.pincode], db,
);
export const addShopMember = (shopId: string, userId: string, role: 'owner' | 'manager', db?: Db) =>
  query('insert into shop_members (shop_id, user_id, member_role) values ($1,$2,$3)', [shopId, userId, role], db);
export const countShopsOwnedBy = (userId: string, db?: Db) =>
  one<{ count: number }>('select count(*)::int as count from shops where owner_user_id = $1', [userId], db);
export const findShopById = (id: string, db?: Db) => one('select * from shops where id = $1', [id], db);
export const listShopsForMember = (userId: string, db?: Db) =>
  query('select s.* from shops s join shop_members m on m.shop_id = s.id where m.user_id = $1 order by s.created_at', [userId], db);
export const listActiveShops = (db?: Db) => query('select * from shops where is_active = true order by is_open desc, name', [], db);
export const searchShops = (q: string, db?: Db) =>
  query(`select * from shops where is_active = true and (name ilike $1 escape '\\' or city ilike $1 escape '\\' or area ilike $1 escape '\\')
         order by name limit 40`, [likePattern(q)], db);

export function updateShop(id: string, patch: Record<string, unknown>, db?: Db) {
  const cols = Object.keys(patch);
  for (const c of cols) if (!ALLOWED.has(c)) throw new Error(`updateShop: column not allowed: ${c}`);
  if (cols.length === 0) return findShopById(id, db);
  const set = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
  return one(`update shops set ${set} where id = $1 returning *`, [id, ...cols.map((c) => patch[c])], db);
}
