import { z } from 'zod';
export const setListItemSchema = z.object({ productId: z.string().uuid(), quantity: z.coerce.number().min(0).max(999999.999) });
export const setListNotesSchema = z.object({ notes: z.string().trim().max(500) });
