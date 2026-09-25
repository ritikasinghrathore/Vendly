import { z } from 'zod';
import { PAY_METHODS } from '../config/constants';

export const createCustomerSchema = z.object({ name: z.string().trim().min(1).max(80), phone: z.string().trim().max(20).optional() });

const billItem = z.object({ productId: z.string().uuid(), quantity: z.coerce.number().positive().max(999999.999) });
export const createBillSchema = z.object({
  shopCustomerId: z.string().uuid(),
  items: z.array(billItem).min(1).max(200),
  discount: z.coerce.number().min(0).max(999999.99).default(0),
  amountPaid: z.coerce.number().min(0).max(999999.99).default(0),
  method: z.enum(PAY_METHODS).default('cash'),
  notes: z.string().trim().max(300).optional(),
  shoppingListId: z.string().uuid().optional(),
  requestId: z.string().uuid(),
});
export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive().max(999999.99),
  method: z.enum(PAY_METHODS).default('cash'),
  notes: z.string().trim().max(300).optional(),
  billId: z.string().uuid().optional(),
  requestId: z.string().uuid(),
});
export const recordAdjustmentSchema = z.object({
  amount: z.coerce.number().positive().max(999999.99),
  direction: z.enum(['owes_more', 'owes_less']),
  reason: z.string().trim().min(3).max(300),
});
