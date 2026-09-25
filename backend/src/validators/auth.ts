import { z } from 'zod';

// 8-128 chars; argon2 itself has no 72-byte issue, but we still cap length as a hashing-cost DoS guard.
const password = z.string().min(8, 'Password must be at least 8 characters.').max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password,
  role: z.enum(['customer', 'shopkeeper']),
  phone: z.string().trim().regex(/^[0-9+ ()-]{7,20}$/).optional(),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});
export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });
export const updateMeSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().regex(/^[0-9+ ()-]{7,20}$/).nullable().optional(),
});
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });
