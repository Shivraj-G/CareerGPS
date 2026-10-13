import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
const app = createApp();
import { pool } from '../src/config/database.js';
import {
  calculateGoalRelevance,
  getDatabaseRecommendations,
  resolveUserGoal,
  CAREER_SYNONYMS,
  ADJACENT_DOMAINS
} from '../src/modules/recommendations/recommendation.service.js';
import { classifyCareerDomain } from '../src/modules/careers/domain-taxonomy.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

describe('Goal-Centred Career Recommendations Multi-Domain Regression Suite', () => {
  let testUserToken;
  let testUserId;

  beforeAll(async () => {
    // Obtain or create a test user with tech skills in profile to rigorously test anti-contamination
    const userRes = await pool.query(`SELECT id, email FROM users ORDER BY created_at LIMIT 1`);
    if (userRes.rows.length) {
      testUserId = userRes.rows[0].id;
    } else {
      const inserted = await pool.query(
        `INSERT INTO users (email, password_hash, role) VALUES ('test_rec_user@example.com', 'hash', 'student') RETURNING id`
      );
      testUserId = inserted.rows[0].id;
    }

    testUserToken = jwt.sign(
      { sub: testUserId, role: 'student', email: 'test_rec_user@example.com' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Ensure the profile has technical skills (Python, SQL, JavaScript)
    await pool.query(
      `INSERT INTO user_profiles (user_id, career_goal, current_goal)
       VALUES ($1, 'Lawyer', $2)
       ON CONFLICT (user_id) DO UPDATE SET career_goal = 'Lawyer', current_goal = $2`,
      [testUserId, JSON.stringify({ title: 'Lawyer' })]
    );
  });

  // --------------------------------------------------------------------------
  // 1. LAWYER DOMAIN ISOLATION & LEGAL SPECIALIZATIONS
  // --------------------------------------------------------------------------
  describe('1. Lawyer Goal Relevance & Domain Isolation', () => {
    it('Lawyer goal matches Lawyer directly and excludes unrelated technology roles', () => {
      const lawyerRel = calculateGoalRelevance('Lawyer', 'Lawyer');
      expect(lawyerRel.matchType).toBe('direct');
      expect(lawyerRel.score).toBe(100);

      // Unrelated tech careers must be strictly classified as unrelated
      const techCareers = ['AI Engineer', 'Backend Developer', 'Data Analyst', 'Data Scientist', 'Frontend Developer'];
      for (const title of techCareers) {
        const rel = calculateGoalRelevance(title, 'Lawyer');
        expect(rel.matchType).toBe('unrelated');
        expect(rel.score).toBe(0);
      }
    });

    it('Lawyer goal classifies legal aliases and specializations as direct or related', () => {
      const advocateRel = calculateGoalRelevance('Lawyer', 'Advocate');
      expect(advocateRel.matchType).toBe('direct');

      const legalCounselRel = calculateGoalRelevance('Lawyer', 'Legal Counsel');
      expect(legalCounselRel.matchType).toBe('direct');

      const policeRel = calculateGoalRelevance('Police Officer', 'Lawyer');
      expect(policeRel.matchType).toBe('related');
      expect(policeRel.score).toBeGreaterThan(60);
    });

    it('Database recommendations for Lawyer contain legal roles and zero technology contamination', async () => {
      const recs = await getDatabaseRecommendations(testUserId, 'Lawyer', { limit: 10 });
      expect(recs.goal).toBe('Lawyer');
      expect(recs.results.length).toBeGreaterThan(0);

      // Top result is Lawyer
      expect(recs.results[0].title).toBe('Lawyer');
      expect(recs.results[0].match_type).toBe('direct');

      // Zero tech careers in results
      const titles = recs.results.map(r => r.title);
      expect(titles).not.toContain('Backend Developer');
      expect(titles).not.toContain('AI Engineer');
      expect(titles).not.toContain('Data Analyst');
      expect(titles).not.toContain('Data Scientist');
      expect(titles).not.toContain('Frontend Developer');
    });
  });

  // --------------------------------------------------------------------------
  // 2. CHEF CULINARY DOMAIN ISOLATION
  // --------------------------------------------------------------------------
  describe('2. Chef Goal Relevance & Culinary Isolation', () => {
    it('Chef goal matches Chef directly and excludes tech and clinical roles', () => {
      const chefRel = calculateGoalRelevance('Chef', 'Chef');
      expect(chefRel.matchType).toBe('direct');
      expect(chefRel.score).toBe(100);

      const cookRel = calculateGoalRelevance('Chef', 'Cook');
      expect(cookRel.matchType).toBe('direct');

      const devRel = calculateGoalRelevance('Backend Developer', 'Chef');
      expect(devRel.matchType).toBe('unrelated');
      expect(devRel.score).toBe(0);

      const docRel = calculateGoalRelevance('Doctor', 'Chef');
      expect(docRel.matchType).toBe('unrelated');
      expect(docRel.score).toBe(0);
    });

    it('Database recommendations for Chef return culinary roles without tech leaks', async () => {
      const recs = await getDatabaseRecommendations(testUserId, 'Chef', { limit: 10 });
      expect(recs.results[0].title).toBe('Chef');
      expect(recs.results[0].match_type).toBe('direct');

      const titles = recs.results.map(r => r.title);
      expect(titles).not.toContain('Backend Developer');
      expect(titles).not.toContain('AI Engineer');
      expect(titles).not.toContain('Data Analyst');
    });
  });

  // --------------------------------------------------------------------------
  // 3. TEACHER EDUCATION DOMAIN ISOLATION
  // --------------------------------------------------------------------------
  describe('3. Teacher Goal Relevance & Academic Instruction Isolation', () => {
    it('Teacher goal groups Teacher and Assistant Professor into education domain', () => {
      const teacherRel = calculateGoalRelevance('Teacher', 'Teacher');
      expect(teacherRel.matchType).toBe('direct');

      const profRel = calculateGoalRelevance('Assistant Professor', 'Teacher');
      expect(profRel.matchType).toBe('related');
      expect(profRel.score).toBeGreaterThanOrEqual(70);

      const devRel = calculateGoalRelevance('Backend Developer', 'Teacher');
      expect(devRel.matchType).toBe('unrelated');
      expect(devRel.score).toBe(0);
    });

    it('Database recommendations for Teacher include education roles and exclude tech', async () => {
      const recs = await getDatabaseRecommendations(testUserId, 'Teacher', { limit: 10 });
      expect(recs.results[0].title).toBe('Teacher');
      const titles = recs.results.map(r => r.title);
      expect(titles).toContain('Assistant Professor');
      expect(titles).not.toContain('Backend Developer');
      expect(titles).not.toContain('Data Analyst');
    });
  });

  // --------------------------------------------------------------------------
  // 4. NURSE HEALTHCARE DOMAIN ISOLATION
  // --------------------------------------------------------------------------
  describe('4. Nurse Goal Relevance & Healthcare Isolation', () => {
    it('Nurse goal matches clinical healthcare roles and excludes software roles', () => {
      const nurseDomain = classifyCareerDomain('Nurse');
      expect(nurseDomain.id).toBe('healthcare_medicine');

      const docRel = calculateGoalRelevance('Doctor', 'Nurse');
      expect(docRel.matchType).toBe('related');
      expect(docRel.score).toBeGreaterThan(65);

      const surgRel = calculateGoalRelevance('Surgeon', 'Nurse');
      expect(surgRel.matchType).toBe('related');

      const devRel = calculateGoalRelevance('Backend Developer', 'Nurse');
      expect(devRel.matchType).toBe('unrelated');
      expect(devRel.score).toBe(0);
    });

    it('Database recommendations for Nurse return medical roles and zero tech roles', async () => {
      const recs = await getDatabaseRecommendations(testUserId, 'Nurse', { limit: 10 });
      const titles = recs.results.map(r => r.title);
      expect(titles).toContain('Doctor');
      expect(titles).toContain('Surgeon');
      expect(titles).not.toContain('Backend Developer');
      expect(titles).not.toContain('AI Engineer');
    });
  });

  // --------------------------------------------------------------------------
  // 5. BACKEND DEVELOPER SOFTWARE ENGINEERING DOMAIN
  // --------------------------------------------------------------------------
  describe('5. Backend Developer Software Engineering Domain', () => {
    it('Backend Developer matches software engineering roles and excludes Chef/Lawyer', () => {
      const beRel = calculateGoalRelevance('Backend Developer', 'Backend Developer');
      expect(beRel.matchType).toBe('direct');

      const fsRel = calculateGoalRelevance('Full Stack Developer', 'Backend Developer');
      expect(fsRel.matchType).toBe('related');

      const devopsRel = calculateGoalRelevance('Cloud / DevOps Engineer', 'Backend Developer');
      expect(devopsRel.matchType).toBe('related');

      const chefRel = calculateGoalRelevance('Chef', 'Backend Developer');
      expect(chefRel.matchType).toBe('unrelated');
      expect(chefRel.score).toBe(0);

      const lawyerRel = calculateGoalRelevance('Lawyer', 'Backend Developer');
      expect(lawyerRel.matchType).toBe('unrelated');
      expect(lawyerRel.score).toBe(0);
    });

    it('Database recommendations for Backend Developer return software roles', async () => {
      const recs = await getDatabaseRecommendations(testUserId, 'Backend Developer', { limit: 10 });
      expect(recs.results[0].title).toBe('Backend Developer');
      expect(recs.results[0].match_type).toBe('direct');

      const titles = recs.results.map(r => r.title);
      expect(titles).toContain('Full Stack Developer');
      expect(titles).not.toContain('Chef');
      expect(titles).not.toContain('Lawyer');
    });
  });

  // --------------------------------------------------------------------------
  // 6. AI ENGINEER DATA & MACHINE LEARNING DOMAIN
  // --------------------------------------------------------------------------
  describe('6. AI Engineer Data & Machine Learning Domain', () => {
    it('AI Engineer matches data science and analytics roles', () => {
      const aiRel = calculateGoalRelevance('AI Engineer', 'AI Engineer');
      expect(aiRel.matchType).toBe('direct');

      const dsRel = calculateGoalRelevance('Data Scientist', 'AI Engineer');
      expect(dsRel.matchType).toBe('related');

      const daRel = calculateGoalRelevance('Data Analyst', 'AI Engineer');
      expect(daRel.matchType).toBe('related');

      const lawyerRel = calculateGoalRelevance('Lawyer', 'AI Engineer');
      expect(lawyerRel.matchType).toBe('unrelated');
      expect(lawyerRel.score).toBe(0);
    });

    it('Database recommendations for AI Engineer return AI and Data roles', async () => {
      const recs = await getDatabaseRecommendations(testUserId, 'AI Engineer', { limit: 10 });
      expect(recs.results[0].title).toBe('AI Engineer');

      const titles = recs.results.map(r => r.title);
      expect(titles).toContain('Data Scientist');
      expect(titles).not.toContain('Lawyer');
      expect(titles).not.toContain('Chef');
    });
  });

  // --------------------------------------------------------------------------
  // 7. ACCOUNTANT BUSINESS & FINANCE DOMAIN
  // --------------------------------------------------------------------------
  describe('7. Accountant Business & Finance Domain', () => {
    it('Accountant matches financial and business operations roles', () => {
      const accDomain = classifyCareerDomain('Accountant');
      expect(accDomain.id).toBe('business_finance_operations');

      const fintechRel = calculateGoalRelevance('Finance Technology Analyst', 'Accountant');
      expect(fintechRel.matchType).toBe('related');

      const baRel = calculateGoalRelevance('Business Analyst', 'Accountant');
      expect(baRel.matchType).toBe('related');

      const chefRel = calculateGoalRelevance('Chef', 'Accountant');
      expect(chefRel.matchType).toBe('unrelated');

      const lawyerRel = calculateGoalRelevance('Lawyer', 'Accountant');
      expect(lawyerRel.matchType).toBe('unrelated');
    });

    it('Database recommendations for Accountant include finance roles and exclude tech/culinary', async () => {
      const recs = await getDatabaseRecommendations(testUserId, 'Accountant', { limit: 10 });
      const titles = recs.results.map(r => r.title);
      expect(titles).toContain('Finance Technology Analyst');
      expect(titles).toContain('Business Analyst');
      expect(titles).not.toContain('Chef');
      expect(titles).not.toContain('Lawyer');
    });
  });

  // --------------------------------------------------------------------------
  // 8. GIS ANALYST GEOSPATIAL DOMAIN
  // --------------------------------------------------------------------------
  describe('8. GIS Analyst Geospatial Domain', () => {
    it('GIS Analyst matches Geo Analyst catalogue record and excludes unrelated fields', () => {
      const gisRel = calculateGoalRelevance('Geo Analyst', 'GIS Analyst');
      expect(gisRel.matchType).toBe('direct');
      expect(gisRel.score).toBeGreaterThanOrEqual(85);

      const chefRel = calculateGoalRelevance('Chef', 'GIS Analyst');
      expect(chefRel.matchType).toBe('unrelated');

      const lawyerRel = calculateGoalRelevance('Lawyer', 'GIS Analyst');
      expect(lawyerRel.matchType).toBe('unrelated');
    });

    it('Database recommendations for GIS Analyst return Geo Analyst as top match', async () => {
      const recs = await getDatabaseRecommendations(testUserId, 'GIS Analyst', { limit: 10 });
      expect(recs.results[0].title).toBe('Geo Analyst');
      expect(recs.results[0].match_type).toBe('direct');

      const titles = recs.results.map(r => r.title);
      expect(titles).not.toContain('Chef');
      expect(titles).not.toContain('Lawyer');
    });
  });

  // --------------------------------------------------------------------------
  // 9. END-TO-END HTTP API & ANTI-CONTAMINATION CONTRACT
  // --------------------------------------------------------------------------
  describe('9. POST /api/v1/recommendations/careers HTTP API Contract', () => {
    it('returns direct match for Lawyer and excludes tech careers in HTTP response', async () => {
      const res = await request(app)
        .post('/api/v1/recommendations/careers')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ goal: 'Lawyer' });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.goal).toBe('Lawyer');

      const results = res.body.data.results;
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toBe('Lawyer');
      expect(results[0].match_type).toBe('direct');

      // Crucial assertion: no tech careers in results
      const titles = results.map(r => r.title);
      expect(titles).not.toContain('Backend Developer');
      expect(titles).not.toContain('AI Engineer');
      expect(titles).not.toContain('Data Analyst');
      expect(titles).not.toContain('Data Scientist');

      // Groups structure
      expect(res.body.data.groups).toBeDefined();
      expect(res.body.data.groups.direct_matches.some(c => c.title === 'Lawyer')).toBe(true);
      const relatedTitles = res.body.data.groups.related_careers.map(c => c.title);
      expect(relatedTitles).not.toContain('Backend Developer');
    }, 30000);

    it('persists feedback via POST /api/v1/recommendations/:id/feedback', async () => {
      // First get a recommendation id
      const recRes = await request(app)
        .post('/api/v1/recommendations/careers')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ goal: 'Chef' });

      const recId = recRes.body.data.recommendation_id;
      expect(recId).toBeDefined();

      // Submit feedback
      const fbRes = await request(app)
        .post(`/api/v1/recommendations/${recId}/feedback`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ rating: 'helpful', comment: 'Accurate culinary recommendation' });

      expect(fbRes.status).toBe(201);
      expect(fbRes.body.data.saved).toBe(true);
    }, 30000);

    it('rejects feedback on nonexistent recommendation with 404', async () => {
      const fbRes = await request(app)
        .post('/api/v1/recommendations/00000000-0000-0000-0000-000000000000/feedback')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ rating: 'helpful' });

      expect(fbRes.status).toBe(404);
    });
  });
});
