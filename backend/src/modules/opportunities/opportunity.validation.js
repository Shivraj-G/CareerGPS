import { z } from 'zod';

export const opportunityListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['upcoming', 'open', 'closed', 'cancelled', 'unknown']).optional(),
  opportunity_type: z.string().trim().max(100).optional(),
  location: z.string().trim().max(200).optional(),
  career_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
}).strict();
