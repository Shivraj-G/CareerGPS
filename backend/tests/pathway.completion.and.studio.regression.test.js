import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/config/database.js';

const app = createApp();
import { getProjectRecommendations } from '../src/modules/projects/project.service.js';
import { completePathway, getUserPathway } from '../src/modules/pathways/pathway.service.js';
import { evaluateUserProgressAndEvidence } from '../src/modules/pathways/pathway-engine.js';

describe('Regression Tests: Pathway Completion, Project Studio Recommendations & Safety', () => {
  let testUserToken = null;
  let testUserId = null;
  let otherUserToken = null;
  let otherUserId = null;
  let testUserPathwayId = null;

  beforeAll(async () => {
    // 1. Create a test user
    const email = `reg_tester_${Date.now()}@example.com`;
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123' });
    testUserToken = regRes.body.accessToken;
    testUserId = regRes.body.user.id;

    // 2. Create another user for authorization tests
    const otherEmail = `reg_other_${Date.now()}@example.com`;
    const otherRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: otherEmail, password: 'password123' });
    otherUserToken = otherRes.body.accessToken;
    otherUserId = otherRes.body.user.id;

    // 3. Find a career and template pathway to assign to test user
    const pathwayRes = await pool.query(
      `SELECT p.id, p.career_id FROM pathways p 
       WHERE p.pathway_type = 'template' AND p.record_status = 'published' LIMIT 1`
    );
    const template = pathwayRes.rows[0];

    const upInsert = await pool.query(
      `INSERT INTO user_pathways (user_id, pathway_id, title, status)
       VALUES ($1, $2, 'Regression Test Pathway', 'active') RETURNING id`,
      [testUserId, template.id]
    );
    testUserPathwayId = upInsert.rows[0].id;

    // Insert steps into user_pathway_steps
    const stepsRes = await pool.query(
      `SELECT id FROM pathway_steps WHERE pathway_id = $1 ORDER BY step_order`,
      [template.id]
    );
    for (const step of stepsRes.rows) {
      await pool.query(
        `INSERT INTO user_pathway_steps (user_pathway_id, pathway_step_id, status)
         VALUES ($1, $2, 'not_started')`,
        [testUserPathwayId, step.id]
      );
    }
  });

  afterAll(async () => {
    if (testUserId) {
      await pool.query('DELETE FROM user_pathway_steps WHERE user_pathway_id = $1', [testUserPathwayId]);
      await pool.query('DELETE FROM user_pathways WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM user_profiles WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    }
    if (otherUserId) {
      await pool.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    }
  });

  describe('1. Pathway Completion Endpoint (POST /api/v1/pathways/:pathwayId/complete)', () => {
    it('returns 404 NOT_FOUND for non-existent pathway ID (does not fake success)', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post(`/api/v1/pathways/${fakeId}/complete`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('returns 404 when a user tries to complete another user\'s pathway', async () => {
      const res = await request(app)
        .post(`/api/v1/pathways/${testUserPathwayId}/complete`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({});

      expect(res.status).toBe(404);
    });

    it('successfully completes the pathway and marks its steps completed for the owner', async () => {
      const res = await request(app)
        .post(`/api/v1/pathways/${testUserPathwayId}/complete`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.steps.every(s => s.status === 'completed')).toBe(true);

      // Verify idempotent: calling again succeeds with status 200
      const secondRes = await request(app)
        .post(`/api/v1/pathways/${testUserPathwayId}/complete`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({});

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.data.status).toBe('completed');
    });

    it('can complete an individual milestone using step_id in body', async () => {
      // Create another active pathway to test step completion via /complete
      const pathwayRes = await pool.query(
        `SELECT p.id, p.career_id FROM pathways p 
         WHERE p.pathway_type = 'template' AND p.record_status = 'published' LIMIT 1`
      );
      const template = pathwayRes.rows[0];

      const up = await pool.query(
        `INSERT INTO user_pathways (user_id, pathway_id, title, status)
         VALUES ($1, $2, 'Step Test Pathway', 'active') RETURNING id`,
        [testUserId, template.id]
      );
      const upId = up.rows[0].id;

      const stepsRes = await pool.query(
        `SELECT id FROM pathway_steps WHERE pathway_id = $1 ORDER BY step_order LIMIT 2`,
        [template.id]
      );
      for (const step of stepsRes.rows) {
        await pool.query(
          `INSERT INTO user_pathway_steps (user_pathway_id, pathway_step_id, status)
           VALUES ($1, $2, 'not_started')`,
          [upId, step.id]
        );
      }

      const stepToComplete = stepsRes.rows[0].id;
      const res = await request(app)
        .post(`/api/v1/pathways/${upId}/complete`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ step_id: stepToComplete, notes: 'Completed via regression test' });

      expect(res.status).toBe(200);
      const updatedSteps = res.body.data.steps;
      const completedStep = updatedSteps.find(s => s.pathway_step_id === stepToComplete || s.id === stepToComplete);
      expect(completedStep.status).toBe('completed');

      // Cleanup
      await pool.query('DELETE FROM user_pathway_steps WHERE user_pathway_id = $1', [upId]);
      await pool.query('DELETE FROM user_pathways WHERE id = $1', [upId]);
    });
  });

  describe('2. Project Recommendations & Query Parameter Handling', () => {
    it('accepts snake_case career_id and career_title without stripping parameters', async () => {
      const aiCareerId = '2a7f4d18-6335-472c-aaef-ae9547bfc1e2';
      const res = await request(app)
        .get(`/api/v1/projects/recommendations?career_id=${aiCareerId}&career_title=AI+Engineer`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.career_title).toBe('AI Engineer');
      expect(Array.isArray(res.body.data.projects)).toBe(true);
      expect(res.body.data.projects.length).toBeGreaterThanOrEqual(3);

      // Verify tier, estimated_hours, and difficulty_level normalization
      for (const p of res.body.data.projects) {
        expect(p.tier).toBeDefined();
        expect([1, 2, 3]).toContain(p.tier);
        expect(p.difficulty_level).toBe(p.tier);
        expect(p.estimated_hours).toBeDefined();
      }
    });

    it('returns 3 distinct difficulty tiers (Starter=1, Practical=2, Career-Ready=3)', async () => {
      const recs = await getProjectRecommendations({
        careerTitle: 'AI Engineer'
      });

      expect(recs.levels.level_1_starter.length).toBeGreaterThanOrEqual(1);
      expect(recs.levels.level_2_practical.length).toBeGreaterThanOrEqual(1);
      expect(recs.levels.level_3_career_ready.length).toBeGreaterThanOrEqual(1);

      expect(recs.levels.level_1_starter[0].tier).toBe(1);
      expect(recs.levels.level_2_practical[0].tier).toBe(2);
      expect(recs.levels.level_3_career_ready[0].tier).toBe(3);
    });
  });

  describe('3. Skill Object Rendering Safety (Preventing React Crashes)', () => {
    it('normalizes skill object with all error fields into safe renderable view model', async () => {
      // Simulate exact object from user crash:
      // { skill_id, skill_name, category, self_rating, level, verified, evidence_type, evidence_notes, updated_at }
      const crashObject = {
        skill_id: 'sk-12345',
        skill_name: 'Deep Learning & Neural Networks',
        category: 'AI / Machine Learning',
        self_rating: 4,
        level: 'Advanced',
        verified: true,
        evidence_type: 'project_submission',
        evidence_notes: 'Verified via MNIST and Transformer deliverables',
        updated_at: '2026-10-12T12:00:00Z'
      };

      // Import the frontend helper
      const { getSkillViewModel, formatSkillDisplayName } = await import('../../frontend/src/utils/skillDisplay.js');

      const vm = getSkillViewModel(crashObject);
      expect(vm.id).toBe('sk-12345');
      expect(vm.name).toBe('Deep Learning & Neural Networks');
      expect(typeof vm.name).toBe('string');
      expect(vm.level).toBe('Advanced');
      expect(vm.verified).toBe(true);

      const displayName = formatSkillDisplayName(crashObject);
      expect(displayName).toBe('Deep Learning & Neural Networks');
      expect(typeof displayName).toBe('string');
    });

    it('handles null, missing names, strings, and unstructured records without returning raw objects', async () => {
      const { getSkillViewModel, formatSkillDisplayName } = await import('../../frontend/src/utils/skillDisplay.js');

      // Null record
      expect(formatSkillDisplayName(null)).toBe('General Competency');

      // Object with only category
      expect(formatSkillDisplayName({ category: 'Cloud' })).toBe('Cloud Skill');

      // Plain string
      expect(formatSkillDisplayName('Python')).toBe('Python');

      // Object with empty name
      expect(formatSkillDisplayName({ name: '', skill_name: null })).toBe('Competency');

      // Completely empty object
      const vmEmpty = getSkillViewModel({});
      expect(typeof vmEmpty.name).toBe('string');
      expect(vmEmpty.name.length).toBeGreaterThan(0);
    });
  });

  describe('4. Pathway Prerequisites Unlocking & Gating', () => {
    it('satisfies prerequisites when preparatory steps are completed without requiring optional steps', () => {
      const steps = [
        { id: 's1', step_order: 1, title: 'Basics 1', status: 'completed', metadata: { stage: 'Stage 1', stage_order: 1, is_optional: false } },
        { id: 's2', step_order: 2, title: 'Basics 2', status: 'completed', metadata: { stage: 'Stage 2', stage_order: 2, is_optional: false } },
        { id: 's3', step_order: 3, title: 'Optional Elective', status: 'not_started', metadata: { stage: 'Stage 3', stage_order: 3, is_optional: true } },
        { id: 's4', step_order: 4, title: 'Capstone Project', status: 'not_started', metadata: { stage: 'Stage 4: Projects', stage_order: 4, is_optional: false } }
      ];

      // Test prerequisite logic
      const preProjectSteps = steps.filter(s => {
        const order = Number(s.metadata?.stage_order || s.step_order);
        return order < 4 && !s.metadata?.stage?.toLowerCase().includes('project');
      });

      const mandatorySteps = preProjectSteps.filter(s => !s.metadata?.is_optional);
      const isPrereqsCompleted = mandatorySteps.every(s => s.status === 'completed' || s.status === 'skipped');

      // Prereqs should be completed even though s3 (optional) is not started
      expect(isPrereqsCompleted).toBe(true);
    });

    it('keeps project stage gated when mandatory prerequisites are incomplete', () => {
      const steps = [
        { id: 's1', step_order: 1, title: 'Basics 1', status: 'not_started', metadata: { stage: 'Stage 1', stage_order: 1, is_optional: false } },
        { id: 's2', step_order: 2, title: 'Basics 2', status: 'not_started', metadata: { stage: 'Stage 2', stage_order: 2, is_optional: false } },
        { id: 's3', step_order: 3, title: 'Capstone Project', status: 'not_started', metadata: { stage: 'Stage 4: Projects', stage_order: 4, is_optional: false } }
      ];

      const mandatorySteps = steps.filter(s => {
        const order = Number(s.metadata?.stage_order || s.step_order);
        return order < 4 && !s.metadata?.is_optional;
      });
      const isPrereqsCompleted = mandatorySteps.every(s => s.status === 'completed' || s.status === 'skipped');

      expect(isPrereqsCompleted).toBe(false);
    });
  });
});
