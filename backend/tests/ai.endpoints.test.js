import request from 'supertest';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

process.env.INTERNAL_SERVICE_TOKEN = 'phase9-test-internal-token-123456';
process.env.JWT_SECRET = 'phase9-test-jwt-secret-12345678901234567890';
process.env.AI_SERVICE_URL = 'http://ai-service';

vi.mock('../src/config/database.js', () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn()
  };
  return {
    pool: {
      query: vi.fn(),
      connect: vi.fn(() => mockClient)
    },
    checkDatabase: vi.fn()
  };
});

import { pool } from '../src/config/database.js';
const { createApp } = await import('../src/app.js');
const app = createApp();

function makeToken(userId = '00000000-0000-0000-0000-000000000001') {
  return jwt.sign({ sub: userId, role: 'student' }, process.env.JWT_SECRET);
}

describe('AI Endpoints', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
    // Default mocks for standard flow
    pool.query.mockImplementation(async (queryText) => {
      if (typeof queryText === 'string' && queryText.includes('FROM users')) {
        return { rows: [{ id: '00000000-0000-0000-0000-000000000001', role: 'student', account_status: 'active' }] };
      }
      return { rows: [] };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/careers/explore', () => {
    it('returns 401 if unauthorized', async () => {
      const res = await request(app).post('/api/v1/careers/explore').send({ query: 'chef' });
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid payload', async () => {
      const res = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ query: '' });
      expect(res.status).toBe(400);
    });

    it('handles AI service unavailability', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network Error'));
      const res = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${makeToken('u1')}`)
        .send({ query: 'chef' });
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('AI_UNAVAILABLE');
    });

    it('handles not_a_career response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'not_a_career', reason: 'Not a recognized career' })
      });
      const res = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${makeToken('u2')}`)
        .send({ query: 'asdasdasd' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('not_a_career');
      expect(res.body.reason).toBe('Not a recognized career');
    });

    it('handles catalogue_match response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'catalogue_match', matched_catalogue: { career_id: 'c123', title: 'Chef' } })
      });
      // the second pool query is fetching the matched career
      pool.query.mockImplementation(async (sql, params) => {
         if (typeof sql === 'string' && sql.includes('FROM users')) return { rows: [{ id: 'u3', role: 'student', account_status: 'active' }] };
         if (sql.includes('FROM careers c WHERE c.id = $1')) {
             return { rows: [{ id: 'c123', title: 'Chef', verification_status: 'verified', record_status: 'published' }] };
         }
         return { rows: [] };
      });

      const res = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${makeToken('u3')}`)
        .send({ query: 'chef' });
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('c123');
    });

    it('handles ai_generated success response and saves to db', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ai_generated',
          career: {
            title: 'Underwater Basket Weaver',
            description: 'Weaves baskets',
            responsibilities: ['Weaving', 'Diving'],
            qualifications: ['Scuba Certification'],
            entry_routes: ['Apprenticeship'],
            required_skills: [
              { name: 'Holding breath', importance: 'required' },
              { name: 'Weaving', importance: 'required' },
              { name: 'Diving', importance: 'required' }
            ]
          }
        })
      });

      const mockClient = { query: vi.fn().mockImplementation(async (sql) => {
         if (typeof sql === 'string' && sql.includes('FROM users')) return { rows: [{ id: 'u4', role: 'student', account_status: 'active' }] };
         return { rows: [{ ai_career_id: 'new-id' }] };
      }), release: vi.fn() };
      pool.query = mockClient.query;

      const res = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${makeToken('u4')}`)
        .send({ query: 'underwater basket weaver' });
      
      expect(res.status).toBe(200);
      expect(res.body.data.ai_career_id).toBe('new-id');
    });

    it('handles concurrent identical requests gracefully (race condition)', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ai_generated',
          career: {
            title: 'Space Explorer',
            description: 'Explores space',
            responsibilities: ['Exploring', 'Flying'],
            qualifications: ['Astronaut Training'],
            entry_routes: ['Space Agency'],
            required_skills: [
              { name: 'Zero-G Maneuvering', importance: 'required' },
              { name: 'Piloting', importance: 'required' },
              { name: 'Engineering', importance: 'important' }
            ]
          }
        })
      });

      const mockClient = { query: vi.fn().mockResolvedValue({ rows: [{ id: 'space-id' }] }), release: vi.fn() };
      pool.connect.mockResolvedValue(mockClient);

      // Fire two requests concurrently
      const [res1, res2] = await Promise.all([
        request(app).post('/api/v1/careers/explore').set('Authorization', `Bearer ${makeToken('u6')}`).send({ query: 'space' }),
        request(app).post('/api/v1/careers/explore').set('Authorization', `Bearer ${makeToken('u7')}`).send({ query: 'space' })
      ]);
      
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });
  });

  describe('POST /api/v1/skills/suggest', () => {
    it('handles successful suggestions', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ai_generated',
          skills: [{ name: 'Node.js', category: 'Tech' }]
        })
      });
      let queryCallCount = 0;
      pool.query.mockImplementation(async (sql, params) => {
         queryCallCount++;
         if (typeof sql === 'string' && sql.includes('FROM users')) return { rows: [{ id: 'u5', role: 'student', account_status: 'active' }] };
         if (sql.includes('SELECT name FROM skills')) return { rows: [] };
         if (sql.includes('SELECT id, name')) return { rows: [] };
         if (sql.includes('INSERT INTO skills')) return { rows: [{ id: 's1', name: 'Node.js', category: 'Tech', origin: 'ai_generated' }] };
         return { rows: [] };
      });

      const res = await request(app)
        .post('/api/v1/skills/suggest')
        .set('Authorization', `Bearer ${makeToken('u5')}`)
        .send({ query: 'backend' });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]); // Omitted since it's unresolvable
    });
  });
});
