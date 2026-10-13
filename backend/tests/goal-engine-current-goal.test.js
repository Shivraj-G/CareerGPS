import { describe, expect, it } from 'vitest';
import { evaluateGoalEligibility } from '../src/modules/goals/goal.engine.js';

describe('Current Goal direct-route assessment', () => {
  const profile = {
    education: [{
      education_stage: 'HIGHER_EDUCATION',
      level: 'Undergraduate',
      school_12_stream: 'Commerce without Mathematics',
      current_program: 'BCA',
      degree: 'BCA',
      status: 'pursuing',
    }],
    age: 20,
  };

  it('does not mark High Court Judge as directly eligible without a matching rule', () => {
    const result = evaluateGoalEligibility(profile, { title: 'High court judge' });
    expect(result.status).toBe('E');
    expect(result.decision).toBe('Verification Pending');
  });

  it('does not mark Backend Developer as directly eligible without a matching rule', () => {
    const result = evaluateGoalEligibility(profile, { title: 'Backend Developer' });
    expect(result.status).toBe('E');
  });

  it('still recognizes direct-route rules that are present in the deterministic engine', () => {
    const result = evaluateGoalEligibility({
      education: [{ level: '12th', school_12_stream: 'Physics Chemistry Biology', status: 'completed' }],
      age: 18,
    }, { title: 'MBBS Doctor' });
    expect(result.status).toBe('A');
    expect(result.action).toMatch(/NEET/i);
  });
});
