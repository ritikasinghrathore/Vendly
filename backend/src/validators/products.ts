import { z } from 'zod';
import { UNITS } from '../config/constants';

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(120),
  nameHi: z.string().trim().max(120).optional(),
  unit: z.enum(UNITS),
  price: z.coerce.number().min(0).max(999999.99),
  categoryId: z.string().uuid().optional(),
  description: z.string().trim().max(1000).optional(),
  openingStock: z.coerce.number().min(0).max(999999.999).default(0),
  lowStockThreshold: z.coerce.number().min(0).max(999999.999).default(5),
  imageId: z.string().uuid().optional(),
});
export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  nameHi: z.string().trim().max(120).nullable().optional(),
  price: z.coerce.number().min(0).max(999999.99).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  lowStockThreshold: z.coerce.number().min(0).max(999999.999).optional(),
  isAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  imageId: z.string().uuid().nullable().optional(),
});
export const adjustStockSchema = z.object({
  mode: z.enum(['add', 'reduce', 'set']),
  quantity: z.coerce.number().min(0).max(999999.999),
  notes: z.string().trim().max(300).optional(),
});
