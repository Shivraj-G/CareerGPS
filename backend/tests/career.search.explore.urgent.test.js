import request from 'supertest';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

process.env.INTERNAL_SERVICE_TOKEN = 'test-token-1234567890';
process.env.JWT_SECRET = 'test-secret-123456789012345678901234567890';
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

function makeToken(userId = crypto.randomUUID()) {
  return jwt.sign({ sub: userId, role: 'student' }, process.env.JWT_SECRET);
}

describe('Career Search & AI Career Exploration End-to-End Suite', () => {
  let mockClient;

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
    mockClient = {
      query: vi.fn(),
      release: vi.fn()
    };
    pool.connect.mockReturnValue(mockClient);

    pool.query.mockImplementation(async (sql, params) => {
      const q = String(sql || '').toLowerCase();
      if (q.includes('from users')) {
        return { rows: [{ id: (params && params[0]) || '00000000-0000-0000-0000-000000000001', role: 'student', account_status: 'active' }] };
      }
      if (q.includes('from user_skills') || q.includes('from user_custom_skills')) {
        return { rows: [] };
      }
      if (q.includes('from skills')) {
        return { rows: [{ name: 'Legal Research' }, { name: 'Cooking' }, { name: 'Python' }] };
      }
      return { rows: [] };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Search Lawyer, Data Engineer, Chef in Database Catalogue', () => {
    it('returns Lawyer when Lawyer exists in database catalogue via GET /careers?search=Lawyer', async () => {
      pool.query.mockImplementation(async (sql, params) => {
        const q = String(sql || '').toLowerCase();
        if (q.includes('count(*)::int as total from careers')) {
          return { rows: [{ total: 1 }] };
        }
        if (q.includes('select c.id, c.title, c.description') && q.includes('from careers c')) {
          return {
            rows: [{
              id: '4e562ff8-f160-46f5-a459-ee10499559c7',
              title: 'Lawyer',
              description: 'Provides legal counsel and representation.',
              responsibilities: ['Legal research', 'Client consultation'],
              qualifications: ['Bachelor of Laws (LL.B.)'],
              entry_routes: ['Law School'],
              verification_status: 'verified',
              origin: 'curated'
            }]
          };
        }
        return { rows: [] };
      });

      const res = await request(app).get('/api/v1/careers?search=Lawyer');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Lawyer');
      expect(res.body.data[0].id).toBe('4e562ff8-f160-46f5-a459-ee10499559c7');
    });

    it('returns Data Engineer from database catalogue via GET /careers?search=Data%20Engineer', async () => {
      pool.query.mockImplementation(async (sql) => {
        const q = String(sql || '').toLowerCase();
        if (q.includes('count(*)::int as total from careers')) {
          return { rows: [{ total: 1 }] };
        }
        if (q.includes('select c.id, c.title, c.description') && q.includes('from careers c')) {
          return {
            rows: [{
              id: '11111111-2222-3333-4444-555555555555',
              title: 'Data Engineer',
              description: 'Designs data pipelines and warehouses.',
              responsibilities: ['ETL pipelines', 'SQL optimization'],
              qualifications: ['B.Tech Computer Science'],
              entry_routes: ['Engineering degree'],
              verification_status: 'verified',
              origin: 'curated'
            }]
          };
        }
        return { rows: [] };
      });

      const res = await request(app).get('/api/v1/careers?search=Data%20Engineer');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Data Engineer');
    });

    it('returns Chef from database catalogue via GET /careers?search=Chef', async () => {
      pool.query.mockImplementation(async (sql) => {
        const q = String(sql || '').toLowerCase();
        if (q.includes('count(*)::int as total from careers')) {
          return { rows: [{ total: 1 }] };
        }
        if (q.includes('select c.id, c.title, c.description') && q.includes('from careers c')) {
          return {
            rows: [{
              id: '99999999-8888-7777-6666-555555555555',
              title: 'Chef',
              description: 'Directs kitchen food preparation and menu design.',
              responsibilities: ['Culinary planning', 'Food safety'],
              qualifications: ['Hotel Management Diploma'],
              entry_routes: ['Culinary Institute'],
              verification_status: 'verified',
              origin: 'curated'
            }]
          };
        }
        return { rows: [] };
      });

      const res = await request(app).get('/api/v1/careers?search=Chef');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Chef');
    });
  });

  describe('2. POST /api/v1/careers/explore Resilience and Edge Cases', () => {
    it('returns 200 with DB career if query matches catalogue immediately (bypassing AI call)', async () => {
      pool.query.mockImplementation(async (sql, params) => {
        const q = String(sql || '').toLowerCase();
        if (q.includes('from users')) return { rows: [{ id: (params && params[0]) || '00000000-0000-0000-0000-000000000001', role: 'student', account_status: 'active' }] };
        if (q.includes('from careers c') && q.includes('c.title ilike $1')) {
          return {
            rows: [{
              id: '4e562ff8-f160-46f5-a459-ee10499559c7',
              title: 'Lawyer',
              description: 'Provides legal counsel and representation in court.',
              verification_status: 'verified',
              origin: 'curated'
            }]
          };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ query: 'Lawyer' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Lawyer');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('accepts flexible body shapes ({ search } or { goal } instead of { query })', async () => {
      pool.query.mockImplementation(async (sql, params) => {
        const q = String(sql || '').toLowerCase();
        if (q.includes('from users')) return { rows: [{ id: (params && params[0]) || '00000000-0000-0000-0000-000000000001', role: 'student', account_status: 'active' }] };
        if (q.includes('from careers c') && q.includes('c.title ilike $1')) {
          return { rows: [{ id: '4e562ff8-f160-46f5-a459-ee10499559c7', title: 'Lawyer' }] };
        }
        return { rows: [] };
      });

      const resWithSearch = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ search: '  Lawyer  ' });
      expect(resWithSearch.status).toBe(200);
      expect(resWithSearch.body.data.title).toBe('Lawyer');

      const resWithGoal = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ goal: 'Lawyer' });
      expect(resWithGoal.status).toBe(200);
      expect(resWithGoal.body.data.title).toBe('Lawyer');
    });

    it('returns 400 with correlation_id for empty or malformed requests without throwing 500', async () => {
      const emptyRes = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ query: '   ' });

      expect(emptyRes.status).toBe(400);
      expect(emptyRes.body.error.code).toBe('VALIDATION_ERROR');
      expect(emptyRes.body.error.correlation_id).toBeDefined();

      const nullRes = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({});

      expect(nullRes.status).toBe(400);
      expect(nullRes.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('handles nonexistent career with not_a_career response gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'not_a_career',
          reason: 'The term Quantum Alchemist XYZ is not a recognized professional field.'
        })
      });

      const res = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ query: 'Quantum Alchemist XYZ' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('not_a_career');
      expect(res.body.reason).toContain('Quantum Alchemist XYZ');
    });

    it('falls back to database catalogue when AI provider fails or returns 503', async () => {
      global.fetch.mockRejectedValueOnce(new Error('AI Service connection refused'));

      pool.query.mockImplementation(async (sql, params) => {
        const q = String(sql || '').toLowerCase();
        if (q.includes('from users')) return { rows: [{ id: (params && params[0]) || '00000000-0000-0000-0000-000000000001', role: 'student', account_status: 'active' }] };
        // Initial direct check returns empty
        if (q.includes('from careers c') && q.includes('c.title ilike $1 or')) return { rows: [] };
        if (q.includes('from ai_career_profiles')) return { rows: [] };
        if (q.includes('c.description ilike $1')) return { rows: [] };
        // Fallback token query returns database career
        if (q.includes('c.description ilike \'%\' || $1 || \'%\'')) {
          return {
            rows: [{
              id: '4e562ff8-f160-46f5-a459-ee10499559c7',
              title: 'Corporate Lawyer',
              description: 'Provides legal counsel to corporations.'
            }]
          };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ query: 'Corporate Lawyer' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Corporate Lawyer');
    });

    it('returns structured 503 AI_UNAVAILABLE with correlation_id when AI fails and no DB token matches', async () => {
      global.fetch.mockRejectedValueOnce(new Error('AI Service timeout'));

      pool.query.mockImplementation(async (sql, params) => {
        const q = String(sql || '').toLowerCase();
        if (q.includes('from users')) return { rows: [{ id: (params && params[0]) || '00000000-0000-0000-0000-000000000001', role: 'student', account_status: 'active' }] };
        return { rows: [] };
      });

      const res = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ query: 'Space Miner' });

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('AI_UNAVAILABLE');
      expect(res.body.error.correlation_id).toBeDefined();
      expect(res.body.error.message).toContain('unavailable');
    });

    it('safely handles AI output with DB unique constraint conflicts without throwing 500', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ai_generated',
          career: {
            title: 'Lawyer',
            description: 'A practicing legal advocate representing clients in civil and criminal litigation.',
            responsibilities: ['Draft pleadings', 'Advocate in court'],
            qualifications: ['Bachelor of Laws (LL.B.)'],
            entry_routes: ['Bar Council Examination'],
            required_skills: [
              { name: 'Legal Drafting', importance: 'required' },
              { name: 'Negotiation', importance: 'required' },
              { name: 'Advocacy', importance: 'important' }
            ],
            related_careers: ['Judge', 'Paralegal'],
            goa_relevance: 'Goa tourism and civil disputes frequently require legal services.'
          }
        })
      });

      // Mock database transaction queries to test graceful collision resolution
      mockClient.query.mockImplementation(async (sql, params) => {
        const q = String(sql || '').toLowerCase();
        if (q.includes('begin') || q.includes('commit') || q.includes('rollback')) return { rows: [] };
        if (q.includes('from ai_career_profiles where normalized_title')) return { rows: [] };
        if (q.includes('select id from careers where title ilike')) {
          // Career already exists in careers table!
          return { rows: [{ id: '4e562ff8-f160-46f5-a459-ee10499559c7' }] };
        }
        if (q.includes('update careers set record_status')) return { rows: [] };
        if (q.includes('insert into ai_career_profiles')) return { rows: [] };
        if (q.includes('select id from skills where name ilike')) return { rows: [{ id: 's-123' }] };
        if (q.includes('insert into career_skills')) return { rows: [] };
        if (q.includes('select id as ai_career_id, id, title') && q.includes('from ai_career_profiles where id = $1')) {
          return {
            rows: [{
              ai_career_id: '4e562ff8-f160-46f5-a459-ee10499559c7',
              id: '4e562ff8-f160-46f5-a459-ee10499559c7',
              title: 'Lawyer',
              description: 'A practicing legal advocate representing clients in civil and criminal litigation.',
              origin: 'ai_generated',
              status: 'unverified'
            }]
          };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ query: 'Lawyer' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Lawyer');
      expect(res.body.data.id).toBe('4e562ff8-f160-46f5-a459-ee10499559c7');
    });

    it('safely handles non-UUID careerId on GET /careers/:careerId without returning 500', async () => {
      const res = await request(app).get('/api/v1/careers/rec_123_invalid-career-id');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
