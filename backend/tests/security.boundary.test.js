import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

process.env.INTERNAL_SERVICE_TOKEN = 'phase9-test-internal-token-123456';
process.env.JWT_SECRET = 'phase9-test-jwt-secret-12345678901234567890';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';

const { createApp } = await import('../src/app.js');
const app = createApp();

describe('Final integration security boundaries', () => {
  it('rejects admin endpoints without a bearer token', async () => {
    const response = await request(app).get('/api/v1/admin/sources');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects ingestion worker calls without the internal token', async () => {
    const response = await request(app).post('/internal/v1/ingestion/candidates').send({});
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INTERNAL_UNAUTHORIZED');
  });

  it('rejects ingestion worker calls with an incorrect internal token', async () => {
    const response = await request(app)
      .post('/internal/v1/ingestion/candidates')
      .set('x-internal-service-token', 'wrong-token')
      .send({});
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INTERNAL_UNAUTHORIZED');
  });

  it('does not expose an unversioned public API route for internal ingestion', async () => {
    const response = await request(app).post('/api/v1/internal/v1/ingestion/candidates').send({});
    expect(response.status).toBe(404);
  });
});
