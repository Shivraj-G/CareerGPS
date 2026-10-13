import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/database.js', () => ({
  checkDatabase: vi.fn().mockResolvedValue(true),
  pool: { end: vi.fn() }
}));

const { createApp } = await import('../src/app.js');
const app = createApp();

describe('CORS Configuration', () => {
  it('allows requests from http://localhost:5174 in development', async () => {
    const response = await request(app)
      .options('/api/v1/health')
      .set('Origin', 'http://localhost:5174')
      .set('Access-Control-Request-Method', 'GET');
    
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5174');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('allows requests from http://localhost:5173 in development', async () => {
    const response = await request(app)
      .options('/api/v1/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('allows requests from the configured CORS_ORIGIN', async () => {
    // We dynamically read what env.CORS_ORIGIN is set to so the test passes in any environment.
    const { env } = await import('../src/config/env.js');
    const configuredOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim().replace(/\/$/, ''));
    
    const response = await request(app)
      .options('/api/v1/health')
      .set('Origin', configuredOrigins[0])
      .set('Access-Control-Request-Method', 'GET');
    
    expect(response.headers['access-control-allow-origin']).toBe(configuredOrigins[0]);
  });

  it('rejects unapproved origins', async () => {
    const response = await request(app)
      .options('/api/v1/health')
      .set('Origin', 'https://evil.com')
      .set('Access-Control-Request-Method', 'GET');
    
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
