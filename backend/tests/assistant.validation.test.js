import { describe, expect, it } from 'vitest';
import { chatSchema } from '../src/modules/assistant/assistant.validation.js';

describe('assistant validation', () => {
  it('accepts a valid chat request', () => {
    const result = chatSchema.safeParse({ message: 'What careers can I explore?' });
    expect(result.success).toBe(true);
  });
  it('rejects empty messages', () => {
    const result = chatSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
  });
  it('accepts an optional conversation UUID', () => {
    const result = chatSchema.safeParse({ conversation_id: '123e4567-e89b-42d3-a456-426614174000', message: 'Tell me about pathways' });
    expect(result.success).toBe(true);
  });
});
