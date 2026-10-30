import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(8).max(20),
  password: z.string().min(8).max(72),
  fullName: z.string().min(2).max(120),
  role: z.enum(['CUSTOMER', 'DRIVER']).optional().default('CUSTOMER'),
});

export const loginSchema = z.object({
  email: z.string().trim().min(1).max(255),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(16),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type RefreshDto = z.infer<typeof refreshSchema>;
