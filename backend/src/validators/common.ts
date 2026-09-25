import { z } from 'zod';
export const uuidParam = (name: string) => z.object({ [name]: z.string().uuid() }).passthrough();
export const searchQuery = z.object({ q: z.string().trim().min(1).max(80) });
