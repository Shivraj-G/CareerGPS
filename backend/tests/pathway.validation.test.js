import { describe, expect, it } from 'vitest';
import { generatePathwaySchema, progressSchema } from '../src/modules/pathways/pathway.validation.js';

describe('Pathway validation', () => {
  it('requires a pathway or career target for generation', () => {
    const result = generatePathwaySchema.safeParse({ goal: 'Become a developer' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid pathway progress update', () => {
    const result = progressSchema.safeParse({ steps: [{ pathway_step_id: '11111111-1111-4111-8111-111111111111', status: 'completed' }] });
    expect(result.success).toBe(true);
  });
});
