import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/database.js', () => ({
  checkDatabase: vi.fn().mockResolvedValue(true),
  pool: { end: vi.fn() }
}));

const { createApp } = await import('../src/app.js');
const app = createApp();

describe('Foundation API', () => {
  it('returns service metadata from root', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.apiVersion).toBe('v1');
  });

  it('returns a healthy database check', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.checks.database).toBe('ok');
  });

  it('returns the standard 404 structure', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
