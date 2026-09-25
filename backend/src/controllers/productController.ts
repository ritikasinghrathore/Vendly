import { asyncHandler } from '../utils/asyncHandler';
import * as productService from '../services/productService';
import { badRequest } from '../utils/errors';

export const categories = asyncHandler(async (_req, res) => res.json({ categories: await productService.listCategories() }));
export const list = asyncHandler(async (req, res) => res.json({ products: await productService.listProducts(req.shop!.id) }));
export const search = asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (q.trim().length < 2) throw badRequest('Type at least two letters to search.');
  res.json({ products: await productService.searchProducts(q) });
});
export const create = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.shop!.id, req.body);
  res.status(201).json({ product });
});
export const getOne = asyncHandler(async (req, res) => res.json({ product: await productService.getProduct(req.shop!.id, req.params.productId) }));
export const update = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.shop!.id, req.params.productId, req.auth!.userId, req.body);
  res.json({ product });
});
export const adjustStock = asyncHandler(async (req, res) => {
  const result = await productService.adjustStock(req.shop!.id, req.params.productId, req.auth!.userId, req.body.mode, req.body.quantity, req.body.notes);
  res.json(result);
});
