import { describe, expect, it } from 'vitest';
import { candidateSubmitSchema, publishSchema, sourceCreateSchema } from '../src/modules/ingestion/ingestion.validation.js';

describe('ingestion validation', () => {
  it('accepts an approved source registration', () => {
    const result = sourceCreateSchema.safeParse({
      name: 'Goa Government Recruitment',
      source_type: 'government',
      base_url: 'https://example.gov.in',
      is_approved: true
    });
    expect(result.success).toBe(true);
  });

  it('requires a source document hash for candidates', () => {
    const result = candidateSubmitSchema.safeParse({
      run_id: '123e4567-e89b-42d3-a456-426614174000',
      source_id: '123e4567-e89b-42d3-a456-426614174001',
      document: { url: 'https://example.gov.in/notice' },
      candidate: { entity_type: 'opportunity', candidate_data: {} }
    });
    expect(result.success).toBe(false);
  });

  it('accepts an internal publish request with a candidate id', () => {
    const result = publishSchema.safeParse({ candidate_id: '123e4567-e89b-42d3-a456-426614174000' });
    expect(result.success).toBe(true);
  });
});
