import { z } from 'zod';
export const uploadImageSchema = z.object({
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  base64: z.string().min(10).max(2_900_000), // base64 is ~1.37x the raw 2 MB limit; final size re-checked from the decoded buffer
});
