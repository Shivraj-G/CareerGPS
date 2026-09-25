import { describe, expect, it } from 'vitest';
import { opportunityListQuerySchema } from '../src/modules/opportunities/opportunity.validation.js';

describe('opportunity list validation', () => {
  it('accepts supported filters and applies pagination defaults', () => {
    const parsed = opportunityListQuerySchema.parse({ status: 'open', location: 'Goa' });
    expect(parsed.status).toBe('open');
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });

  it('rejects unsupported opportunity statuses', () => {
    const parsed = opportunityListQuerySchema.safeParse({ status: 'active' });
    expect(parsed.success).toBe(false);
  });

  it('rejects a non-uuid career filter', () => {
    const parsed = opportunityListQuerySchema.safeParse({ career_id: '123' });
    expect(parsed.success).toBe(false);
  });
});
