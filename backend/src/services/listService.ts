import { withTx } from '../db/pool';
import * as listRepo from '../repositories/listRepo';
import * as productRepo from '../repositories/productRepo';
import * as customerRepo from '../repositories/customerRepo';
import * as notificationRepo from '../repositories/notificationRepo';
import * as shopRepo from '../repositories/shopRepo';
import { badRequest, forbidden, notFound } from '../utils/errors';

async function loadListVisibleTo(listId: string, userId: string, role: 'customer' | 'shopkeeper', tx?: any) {
  const list = await listRepo.findListById(listId, tx);
  if (!list) throw notFound('List not found.');
  if (role === 'customer') {
    if (list.customer_user_id !== userId) throw forbidden('This is not your list.');
  } else {
    const owns = await shopRepo.findShopById(list.shop_id, tx);
    if (list.status === 'draft') throw forbidden('This list has not been sent yet.');
    if (!owns) throw notFound('Shop not found.');
  }
  return list;
}

export const myDraft = (shopId: string, userId: string) => listRepo.findDraftList(shopId, userId);
export const myLists = (userId: string) => listRepo.myListsForUser(userId);
export const incomingLists = async (shopId: string) => {
  const lists = await listRepo.incomingListsForShop(shopId);
  if (lists.length === 0) return lists;
  const items = await listRepo.itemsForLists(lists.map((l: any) => l.id));
  const byList = new Map<string, any[]>();
  for (const it of items) {
    const arr = byList.get((it as any).shopping_list_id) ?? [];
    arr.push(it);
    byList.set((it as any).shopping_list_id, arr);
  }
  return lists.map((l: any) => ({ ...l, shopping_list_items: byList.get(l.id) ?? [] }));
};

export async function getList(listId: string, userId: string, role: 'customer' | 'shopkeeper') {
  const list = await loadListVisibleTo(listId, userId, role);
  const items = await listRepo.listItemsForList(listId);
  const shop = await shopRepo.findShopById(list.shop_id);
  return { list, items, shop };
}

export async function setItemQuantity(shopId: string, userId: string, productId: string, quantity: number) {
  return withTx(async (tx) => {
    let list = await listRepo.findDraftList(shopId, userId, tx);
    if (!list) list = await listRepo.createDraftList(shopId, userId, tx);
    if (quantity <= 0) { await listRepo.removeListItem(list!.id, productId, tx); return listRepo.findListForUpdate(list!.id, tx); }

    const product = await productRepo.findProductById(productId, tx);
    if (!product || (product as any).shop_id !== shopId || !(product as any).is_active) throw badRequest('That item is not sold by this shop.');
    await listRepo.upsertListItem(list!.id, productId, quantity, (product as any).unit, (product as any).name, tx);
    return listRepo.findListForUpdate(list!.id, tx);
  });
}

export const setNotes = (listId: string, userId: string, notes: string) =>
  withTx(async (tx) => {
    const list = await listRepo.findListForUpdate(listId, tx);
    if (!list || list.customer_user_id !== userId) throw notFound('List not found.');
    return listRepo.setListNotesRow(listId, notes || null, tx);
  });

export const discardDraft = async (listId: string, userId: string) => {
  const deleted = await listRepo.deleteDraftList(listId, userId);
  if (deleted.length === 0) throw notFound('Draft list not found.');
};

export async function submit(listId: string, userId: string) {
  return withTx(async (tx) => {
    const list = await listRepo.findListForUpdate(listId, tx);
    if (!list || list.customer_user_id !== userId) throw notFound('List not found.');
    if (list.status !== 'draft') throw badRequest('This list was already sent.');
    const count = await listRepo.countListItems(listId, tx);
    if (!count || count.count === 0) throw badRequest('Add at least one item before sending.');
    const shop = await shopRepo.findShopById(list.shop_id, tx);
    if (!shop || !(shop as any).is_active) throw badRequest('This shop is not taking lists right now.');

    const customerUser = await tx.query('select name from users where id = $1', [userId]);
    const name = customerUser.rows[0]?.name ?? 'A customer';
    const sc = await customerRepo.linkOrCreateShopCustomer(list.shop_id, userId, name, null, tx);
    const updated = await listRepo.setListSubmitted(listId, sc!.id, tx);
    await notificationRepo.insertNotification({
      userId: (shop as any).owner_user_id, type: 'list', title: 'New shopping list',
      body: `${name} sent a list of ${count.count} items.`, data: { listId },
    }, tx);
    return updated;
  });
}

export async function markViewed(listId: string, shopId: string) {
  const list = await listRepo.findListById(listId);
  if (!list || list.shop_id !== shopId) throw notFound('List not found.');
  if (list.status !== 'submitted') return list;
  const updated = await listRepo.setListViewed(listId);
  const shop = await shopRepo.findShopById(shopId);
  await notificationRepo.insertNotification({
    userId: list.customer_user_id, type: 'list', title: 'Your list was opened',
    body: `${(shop as any)?.name ?? 'The shop'} has seen your shopping list.`, data: { listId },
  });
  return updated;
}
