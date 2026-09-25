import { z } from 'zod';

const uuid = z.string().uuid();
const url = z.string().url();

export const sourceCreateSchema = z.object({
  name: z.string().trim().min(2).max(250),
  source_type: z.string().trim().min(2).max(50),
  base_url: url,
  organization: z.string().trim().max(250).nullable().optional(),
  is_approved: z.boolean().optional(),
  access_notes: z.string().trim().max(2000).nullable().optional()
});

export const sourcePatchSchema = sourceCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required.'
);

export const runCreateSchema = z.object({
  source_id: uuid,
  notes: z.string().trim().max(1000).optional()
});

export const candidateSubmitSchema = z.object({
  run_id: uuid,
  source_id: uuid,
  document: z.object({
    url,
    document_title: z.string().trim().max(500).nullable().optional(),
    content_hash: z.string().trim().min(1).max(128),
    fetched_at: z.string().datetime().optional(),
    published_at: z.string().datetime().nullable().optional(),
    raw_text: z.string().max(500000).nullable().optional(),
    extraction_version: z.string().trim().max(100).optional()
  }),
  candidate: z.object({
    entity_type: z.enum(['opportunity']),
    candidate_data: z.record(z.string(), z.unknown()),
    extraction_version: z.string().trim().max(100).optional(),
    extraction_status: z.enum(['needs_review', 'approved', 'rejected']).default('needs_review')
  })
});

export const runStatusSchema = z.object({
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  discovered_count: z.number().int().min(0).optional(),
  extracted_count: z.number().int().min(0).optional(),
  accepted_count: z.number().int().min(0).optional(),
  rejected_count: z.number().int().min(0).optional(),
  error_message: z.string().trim().max(5000).nullable().optional()
});

export const candidateReviewSchema = z.object({
  review_notes: z.string().trim().max(5000).optional()
});

export const auditQuerySchema = z.object({
  entity_type: z.string().trim().max(80).optional(),
  action: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export const publishSchema = z.object({ candidate_id: uuid });
