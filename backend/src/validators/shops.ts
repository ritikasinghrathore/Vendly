import { z } from 'zod';
import { SHOP_TYPES } from '../config/constants';

export const createShopSchema = z.object({
  name: z.string().trim().min(2).max(80),
  ownerName: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(140).optional(),
  description: z.string().trim().max(1000).optional(),
  shopType: z.enum(SHOP_TYPES).default('grocery'),
  phone: z.string().trim().regex(/^[0-9+ ()-]{7,20}$/),
  addressLine: z.string().trim().min(3),
  area: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^[0-9]{6}$/),
});
export const updateShopSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  ownerName: z.string().trim().min(2).max(80).optional(),
  tagline: z.string().trim().max(140).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  shopType: z.enum(SHOP_TYPES).optional(),
  phone: z.string().trim().regex(/^[0-9+ ()-]{7,20}$/).optional(),
  addressLine: z.string().trim().min(3).optional(),
  area: z.string().trim().max(80).nullable().optional(),
  city: z.string().trim().min(2).max(80).optional(),
  state: z.string().trim().min(2).max(80).optional(),
  pincode: z.string().trim().regex(/^[0-9]{6}$/).optional(),
  isOpen: z.boolean().optional(),
  logoImageId: z.string().uuid().nullable().optional(),
});
