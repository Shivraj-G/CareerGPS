import { z } from 'zod';
export const chatSchema = z.object({ conversation_id: z.string().uuid().optional(), message: z.string().trim().min(1).max(4000) });
