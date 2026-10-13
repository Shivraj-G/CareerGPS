import { z } from 'zod';

const email = z.string().trim().email().max(320).transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);

export const registerSchema = z.object({
  email,
  password,
  role: z.literal('USER').optional(),
  full_name: z.string().trim().max(250).optional(),
  name: z.string().trim().max(250).optional()
}).strict();

export const loginSchema = z.object({ email, password }).strict();
