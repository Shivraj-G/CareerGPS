import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { pool } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { normalizeSkillKey, deduplicateSkills } from '../src/modules/skills/skill-canonical.js';

const app = createApp();

describe('Onboarding Skills & Current Goal Career Intelligence Engine', () => {
  let testUserId;
  let testUserToken;

  beforeAll(async () => {
    const userRes = await pool.query(
      `SELECT id FROM users WHERE email = 'test_onboarding_skills@example.com' LIMIT 1`
    );

    if (userRes.rows.length > 0) {
      testUserId = userRes.rows[0].id;
    } else {
      const inserted = await pool.query(
        `INSERT INTO users (email, password_hash) VALUES ('test_onboarding_skills@example.com', 'dummy_hash') RETURNING id, role`
      );
      testUserId = inserted.rows[0].id;
    }

    testUserToken = jwt.sign(
      { sub: testUserId, role: 'user', email: 'test_onboarding_skills@example.com' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Setup initial profile with BCA
    await pool.query(
      `INSERT INTO user_profiles (user_id, education, career_goal)
       VALUES ($1, $2::jsonb, 'Data Analyst')
       ON CONFLICT (user_id) DO UPDATE SET education = $2::jsonb, career_goal = 'Data Analyst'`,
      [testUserId, JSON.stringify([{ level: 'Undergraduate', degree: 'BCA', current_program: 'BCA', status: 'pursuing' }])]
    );
  });

  // Scenario A: Data Analyst with BCA background
  it('Scenario A: Data Analyst recommends analytics core skills and excludes Vue.js/CI/CD/Software Testing from core', async () => {
    const res = await request(app)
      .post('/api/v1/skills/suggest')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        career_goal: 'Data Analyst',
        education: 'BCA',
        limit: 25
      });

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toBeDefined();

    const coreSkills = data.filter(s => s.is_core === true || s.relationship === 'direct');
    const coreNames = coreSkills.map(s => s.name.toLowerCase());

    // Analytics core skills should be present
    const hasAnalyticsCore = coreNames.some(name =>
      name.includes('sql') ||
      name.includes('data') ||
      name.includes('visual') ||
      name.includes('analytics') ||
      name.includes('excel') ||
      name.includes('statistics')
    );
    expect(hasAnalyticsCore).toBe(true);

    // Frontend/QA/DevOps must NOT be in core Data Analyst recommendations
    expect(coreNames).not.toContain('vue.js');
    expect(coreNames).not.toContain('software testing');
    expect(coreNames).not.toContain('ci/cd');
    expect(coreNames).not.toContain('docker');
    expect(coreNames).not.toContain('kubernetes');
  });

  // Scenario B: Backend Developer
  it('Scenario B: Backend Developer recommends backend, APIs, database, and dev skills', async () => {
    const res = await request(app)
      .post('/api/v1/skills/suggest')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        career_goal: 'Backend Developer',
        education: 'BCA',
        limit: 25
      });

    expect(res.status).toBe(200);
    const data = res.body.data;
    const coreSkills = data.filter(s => s.is_core === true || s.relationship === 'direct');
    const coreNames = coreSkills.map(s => s.name.toLowerCase());

    const hasBackendCore = coreNames.some(name =>
      name.includes('api') ||
      name.includes('backend') ||
      name.includes('database') ||
      name.includes('sql') ||
      name.includes('node') ||
      name.includes('python') ||
      name.includes('system')
    );
    expect(hasBackendCore).toBe(true);
  });

  // Scenario C: Chef
  it('Scenario C: Chef recommends culinary skills and strictly excludes software engineering skills from core', async () => {
    const res = await request(app)
      .post('/api/v1/skills/suggest')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        career_goal: 'Chef',
        education: 'Diploma in Culinary Arts',
        limit: 25
      });

    expect(res.status).toBe(200);
    const data = res.body.data;
    const coreSkills = data.filter(s => s.is_core === true || s.relationship === 'direct');
    const coreNames = coreSkills.map(s => s.name.toLowerCase());

    const hasCulinary = coreNames.some(name =>
      name.includes('culinary') ||
      name.includes('food') ||
      name.includes('kitchen') ||
      name.includes('cooking') ||
      name.includes('menu') ||
      name.includes('hygiene')
    );
    expect(hasCulinary).toBe(true);

    // Software development skills must NOT be in Chef core
    expect(coreNames).not.toContain('vue.js');
    expect(coreNames).not.toContain('react');
    expect(coreNames).not.toContain('software testing');
    expect(coreNames).not.toContain('ci/cd');
  });

  // Scenario D: Lawyer
  it('Scenario D: Lawyer recommends legal reasoning, research, and ethics, and excludes coding from core', async () => {
    const res = await request(app)
      .post('/api/v1/skills/suggest')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        career_goal: 'Lawyer',
        education: 'LLB',
        limit: 25
      });

    expect(res.status).toBe(200);
    const data = res.body.data;
    const coreSkills = data.filter(s => s.is_core === true || s.relationship === 'direct');
    const coreNames = coreSkills.map(s => s.name.toLowerCase());

    const hasLegal = coreNames.some(name =>
      name.includes('law') ||
      name.includes('legal') ||
      name.includes('research') ||
      name.includes('drafting') ||
      name.includes('advocacy') ||
      name.includes('litigation')
    );
    expect(hasLegal).toBe(true);

    // Programming skills must NOT be core for lawyer
    expect(coreNames).not.toContain('vue.js');
    expect(coreNames).not.toContain('ci/cd');
    expect(coreNames).not.toContain('software testing');
  });

  // Scenario E: Changing career goal switches recommendations dynamically
  it('Scenario E: Changing career goal immediately reflects new domain core skills', async () => {
    const resDA = await request(app)
      .post('/api/v1/skills/suggest')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ career_goal: 'Data Analyst' });

    const resChef = await request(app)
      .post('/api/v1/skills/suggest')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ career_goal: 'Chef' });

    expect(resDA.status).toBe(200);
    expect(resChef.status).toBe(200);

    const daCore = resDA.body.data.filter(s => s.is_core).map(s => s.name.toLowerCase());
    const chefCore = resChef.body.data.filter(s => s.is_core).map(s => s.name.toLowerCase());

    expect(daCore).not.toEqual(chefCore);
    expect(chefCore.some(n => n.includes('culinary') || n.includes('food'))).toBe(true);
  }, 20000);

  // Canonical Deduplication Test
  it('Canonical deduplication handles spelling aliases cleanly without duplicate entries', () => {
    const rawList = [
      { id: '1', name: 'Data Visualisation', relationship: 'direct', is_core: true },
      { id: '2', name: 'Data Visualization', relationship: 'direct', is_core: true },
      { id: '3', name: 'Communication Skills', relationship: 'supporting', is_core: false },
      { id: '4', name: 'Communication', relationship: 'supporting', is_core: false }
    ];

    const deduplicated = deduplicateSkills(rawList);
    const names = deduplicated.map(s => s.name);

    // Only one Data Visualization and one Communication should remain
    expect(names.filter(n => n.toLowerCase().includes('visual')).length).toBe(1);
    expect(names.filter(n => n.toLowerCase().includes('communicat')).length).toBe(1);
    expect(deduplicated.length).toBe(2);
  });
});
