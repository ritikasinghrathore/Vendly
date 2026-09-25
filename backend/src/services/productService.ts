import { withTx } from '../db/pool';
import * as productRepo from '../repositories/productRepo';
import { badRequest, notFound } from '../utils/errors';

async function ownedProduct(shopId: string, productId: string, tx?: any, forUpdate = false) {
  const p = forUpdate ? await productRepo.findProductForUpdate(productId, tx) : await productRepo.findProductById(productId, tx);
  if (!p || (p as any).shop_id !== shopId) throw notFound('Product not found.');
  return p as any;
}

export const listCategories = () => productRepo.listCategories();
export const listProducts = (shopId: string) => productRepo.listProductsForShop(shopId);
export const searchProducts = (q: string) => productRepo.searchAvailableProducts(q);
export const getProduct = async (shopId: string, productId: string) => ownedProduct(shopId, productId);

export async function createProduct(shopId: string, input: any) {
  return withTx(async (tx) => {
    const product = await productRepo.insertProduct({
      shopId, categoryId: input.categoryId, name: input.name, nameHi: input.nameHi, description: input.description,
      unit: input.unit, price: input.price.toFixed(2), imageId: input.imageId,
    }, tx);
    const opening = Number(input.openingStock ?? 0);
    await productRepo.insertInventoryRow({ productId: product!.id, shopId, quantity: opening.toFixed(3), lowStockThreshold: Number(input.lowStockThreshold ?? 5) }, tx);
    if (opening > 0) {
      await productRepo.insertInventoryMovement({ shopId, productId: product!.id, changeQuantity: opening.toFixed(3), stockAfter: opening.toFixed(3), reason: 'opening' }, tx);
    }
    return ownedProduct(shopId, product!.id, tx);
  });
}

export async function updateProduct(shopId: string, productId: string, userId: string, patch: Record<string, any>) {
  return withTx(async (tx) => {
    const current = await ownedProduct(shopId, productId, tx, true);
    const dbPatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      const col = { name: 'name', nameHi: 'name_hi', price: 'price', categoryId: 'category_id', description: 'description', isAvailable: 'is_available', isActive: 'is_active', imageId: 'image_id' }[k];
      if (col) dbPatch[col] = k === 'price' ? Number(v).toFixed(2) : v;
    }
    if (patch.lowStockThreshold !== undefined) {
      await tx.query('update inventory set low_stock_threshold = $2, updated_at = now() where product_id = $1', [productId, patch.lowStockThreshold]);
    }
    if (Object.keys(dbPatch).length > 0) await productRepo.updateProductRow(productId, dbPatch, tx);
    if (patch.price !== undefined && Number(patch.price) !== Number(current.price)) {
      await productRepo.insertPriceHistory({ productId, shopId, oldPrice: current.price, newPrice: Number(patch.price).toFixed(2), changedBy: userId }, tx);
    }
    return ownedProduct(shopId, productId, tx);
  });
}

export async function adjustStock(shopId: string, productId: string, userId: string, mode: 'add' | 'reduce' | 'set', quantity: number, notes?: string) {
  return withTx(async (tx) => {
    const p = await ownedProduct(shopId, productId, tx, true);
    let next: number;
    let reason: string;
    if (mode === 'add') {
      if (quantity <= 0) throw badRequest('Enter a quantity above zero.');
      next = Number(p.stock_quantity) + quantity; reason = 'restock';
    } else if (mode === 'reduce') {
      if (quantity <= 0) throw badRequest('Enter a quantity above zero.');
      next = Number(p.stock_quantity) - quantity;
      if (next < 0) throw badRequest(`Stock cannot go below zero (you have ${p.stock_quantity}).`);
      reason = 'correction';
    } else {
      if (quantity < 0) throw badRequest('Stock cannot be negative.');
      next = quantity; reason = 'manual_set';
    }
    await productRepo.updateInventoryQuantity(productId, next, tx);
    await productRepo.insertInventoryMovement({ shopId, productId, changeQuantity: (next - Number(p.stock_quantity)).toFixed(3), stockAfter: next.toFixed(3), reason, notes, createdBy: userId }, tx);
    return { quantity: next };
  });
}
