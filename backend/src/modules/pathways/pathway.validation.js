import { z } from 'zod';

export const generatePathwaySchema = z.object({
  pathway_id: z.string().uuid().optional(),
  career_id: z.string().uuid().optional(),
  goal: z.string().trim().max(500).optional(),
  preferences: z.record(z.string(), z.unknown()).optional()
}).strict().refine((value) => value.pathway_id || value.career_id, {
  message: 'pathway_id or career_id is required.'
});

export const progressSchema = z.object({
  steps: z.array(z.object({
    pathway_step_id: z.string().uuid(),
    status: z.enum(['not_started', 'in_progress', 'completed']),
    notes: z.string().max(2000).nullable().optional()
  }).strict()).min(1)
}).strict();
