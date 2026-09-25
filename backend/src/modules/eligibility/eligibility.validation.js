import { z } from 'zod';

export const eligibilityCheckSchema = z.object({
  opportunity_id: z.string().uuid()
}).strict();

export const requirementSchema = z.object({
  requirement_type: z.enum(['skill', 'education', 'experience', 'location', 'custom']),
  requirement_text: z.string().trim().min(1).max(2000),
  rule_data: z.record(z.string(), z.unknown()),
  verification_status: z.enum(['verified', 'needs_review', 'unverified']).default('needs_review'),
  source_id: z.string().uuid().nullable().optional(),
  source_url: z.string().url().nullable().optional(),
  source_document_url: z.string().url().nullable().optional()
}).strict();
