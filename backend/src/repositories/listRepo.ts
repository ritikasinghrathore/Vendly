import { one, query, type Db } from '../db/pool';

export const findDraftList = (shopId: string, userId: string, db?: Db) =>
  one('select * from shopping_lists where shop_id = $1 and customer_user_id = $2 and status = $3', [shopId, userId, 'draft'], db);
export const createDraftList = (shopId: string, userId: string, db?: Db) =>
  one('insert into shopping_lists (shop_id, customer_user_id) values ($1,$2) returning *', [shopId, userId], db);
export const findListById = (id: string, db?: Db) => one('select * from shopping_lists where id = $1', [id], db);
export const findListForUpdate = (id: string, db?: Db) => one('select * from shopping_lists where id = $1 for update', [id], db);
export const listItemsForList = (listId: string, db?: Db) =>
  query(`select li.*, p.price, p.is_available, i.quantity as stock_quantity
         from shopping_list_items li left join products p on p.id = li.product_id left join inventory i on i.product_id = p.id
         where li.shopping_list_id = $1 order by li.created_at`, [listId], db);
export const upsertListItem = (listId: string, productId: string, quantity: number, unit: string, name: string, db?: Db) =>
  query(`insert into shopping_list_items (shopping_list_id, product_id, quantity, unit, product_name_snapshot) values ($1,$2,$3,$4,$5)
         on conflict (shopping_list_id, product_id) do update set quantity = excluded.quantity`, [listId, productId, quantity, unit, name], db);
export const removeListItem = (listId: string, productId: string, db?: Db) =>
  query('delete from shopping_list_items where shopping_list_id = $1 and product_id = $2', [listId, productId], db);
export const countListItems = (listId: string, db?: Db) =>
  one<{ count: number }>('select count(*)::int as count from shopping_list_items where shopping_list_id = $1', [listId], db);
export const setListSubmitted = (id: string, shopCustomerId: string, db?: Db) =>
  one('update shopping_lists set status = $2, submitted_at = now(), shop_customer_id = $3 where id = $1 returning *', [id, 'submitted', shopCustomerId], db);
export const setListViewed = (id: string, db?: Db) =>
  one("update shopping_lists set status = 'viewed', viewed_at = now() where id = $1 and status = 'submitted' returning *", [id], db);
export const setListCompleted = (id: string, shopId: string, db?: Db) =>
  query("update shopping_lists set status = 'completed' where id = $1 and shop_id = $2 and status in ('submitted','viewed')", [id, shopId], db);
export const setListNotesRow = (id: string, notes: string | null, db?: Db) => one('update shopping_lists set notes = $2 where id = $1 returning *', [id, notes], db);
export const deleteDraftList = (id: string, userId: string, db?: Db) =>
  query<{ id: string }>("delete from shopping_lists where id = $1 and customer_user_id = $2 and status = 'draft' returning id", [id, userId], db);
export const myListsForUser = (userId: string, db?: Db) =>
  query(`select l.*, s.name as shop_name, (select count(*) from shopping_list_items li where li.shopping_list_id = l.id)::int as item_count
         from shopping_lists l join shops s on s.id = l.shop_id
         where l.customer_user_id = $1 and l.status <> 'cancelled' order by l.created_at desc limit 60`, [userId], db);
export const incomingListsForShop = (shopId: string, db?: Db) =>
  query(`select l.*, sc.name as customer_name, sc.phone as customer_phone
         from shopping_lists l left join shop_customers sc on sc.id = l.shop_customer_id
         where l.shop_id = $1 and l.status in ('submitted','viewed') order by l.submitted_at desc limit 100`, [shopId], db);
export const itemsForLists = (listIds: string[], db?: Db) =>
  query('select * from shopping_list_items where shopping_list_id = any($1::uuid[]) order by created_at', [listIds], db);
