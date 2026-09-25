import { describe, expect, it } from 'vitest';
import { evaluateRequirement } from '../src/modules/eligibility/eligibility.engine.js';

describe('Deterministic eligibility evaluation', () => {
  it('marks a verified skill requirement as satisfied when the profile meets it', () => {
    const result = evaluateRequirement({
      verification_status: 'verified', requirement_type: 'skill',
      requirement_text: 'JavaScript', rule_data: { skill_name: 'JavaScript', minimum_level: 'intermediate' }
    }, { skills: [{ name: 'JavaScript', level: 'advanced' }] });
    expect(result.status).toBe('satisfied');
  });

  it('marks a missing required skill as not satisfied', () => {
    const result = evaluateRequirement({
      verification_status: 'verified', requirement_type: 'skill',
      requirement_text: 'Python', rule_data: { skill_name: 'Python' }
    }, { skills: [] });
    expect(result.status).toBe('not_satisfied');
  });

  it('returns unable_to_determine for unverified requirements', () => {
    const result = evaluateRequirement({
      verification_status: 'needs_review', requirement_type: 'custom',
      requirement_text: 'Special requirement', rule_data: {}
    }, {});
    expect(result.status).toBe('unable_to_determine');
  });
});
