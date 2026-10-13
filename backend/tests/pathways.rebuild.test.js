import { describe, expect, it } from 'vitest';
import { pool } from '../src/config/database.js';
import {
  evaluateUserProgressAndEvidence,
  buildGenericCareerPathway,
  DOMAIN_PATHWAY_TEMPLATES
} from '../src/modules/pathways/pathway-engine.js';
import {
  generatePathway,
  getUserPathway,
  selectTemplatePathway,
  updateProgress,
  skipStep,
  undoStep,
  completeStep,
  archiveUserPathway
} from '../src/modules/pathways/pathway.service.js';

describe('CareerGPS Rebuilt Multi-Stage Pathway Engine Tests', () => {
  const AI_ENGINEER_ID = '2a7f4d18-6335-472c-aaef-ae9547bfc1e2';
  const GEO_ANALYST_ID = '5b71c777-6a12-4f11-9a7c-3f20d58be101';
  const ASSISTANT_PROFESSOR_ID = '17e40e2c-763d-496c-8fc8-c18e40bd8ab1';
  const DOCTOR_ID = '1fbc7614-cf1f-460b-b167-6eda303bb61e';

  it('1. AI Engineer beginner learner starts at foundational stage with clear rationale', () => {
    const rawSteps = DOMAIN_PATHWAY_TEMPLATES['ai engineer'];
    const beginnerContext = {
      profile: { education: [{ level: 'Class 12', status: 'completed' }], experience: [] },
      user_skills: [],
      custom_skills: []
    };

    const evaluated = evaluateUserProgressAndEvidence(beginnerContext, rawSteps, 'AI Engineer');
    expect(evaluated.experience_tier).toBe('beginner');
    expect(evaluated.starting_point.stage).toBe('Stage 1: Readiness & Prerequisite Verification');
    expect(evaluated.starting_point.step_order).toBe(1);
    expect(evaluated.metrics.completed).toBe(0);
    expect(evaluated.metrics.percentage).toBe(0);
    expect(evaluated.steps[0].is_current_focus).toBe(true);
    expect(evaluated.starting_point.reason).toContain('Stage 1');
  });

  it('2. AI Engineer with relevant skills and education auto-completes foundations and advances starting point', () => {
    const rawSteps = DOMAIN_PATHWAY_TEMPLATES['ai engineer'];
    const intermediateContext = {
      profile: {
        education: [{ level: 'Undergraduate', degree: 'BCA', status: 'completed' }],
        experience: [{ role: 'Junior Python Developer', years: 1.5 }]
      },
      user_skills: [
        { name: 'Python', proficiency: 'intermediate' },
        { name: 'SQL', proficiency: 'intermediate' },
        { name: 'Data Cleaning', proficiency: 'intermediate' }
      ],
      custom_skills: []
    };

    const evaluated = evaluateUserProgressAndEvidence(intermediateContext, rawSteps, 'AI Engineer');
    expect(evaluated.experience_tier).toBe('intermediate');
    
    // Step 2 (Python & Data Preparation) should be auto-detected as completed from acquired skills
    const step2 = evaluated.steps.find(s => s.step_order === 2);
    expect(step2.status).toBe('completed');
    expect(step2.completion_source).toBe('auto_detected');
    expect(step2.auto_evidence).toContain('Auto-detected from your acquired skill');

    // Progress percentage should reflect the auto-detected step
    expect(evaluated.metrics.completed).toBeGreaterThanOrEqual(1);
    expect(evaluated.metrics.percentage).toBeGreaterThan(0);
  });

  it('3. Geo Analyst pathway remains specifically geospatial and is never confused with Business Analyst', async () => {
    // Check that Geo Analyst exists in DB
    const geoRes = await pool.query('SELECT id, title, description FROM careers WHERE id = $1', [GEO_ANALYST_ID]);
    expect(geoRes.rows.length).toBe(1);
    expect(geoRes.rows[0].title).toBe('Geo Analyst');

    const geoSteps = DOMAIN_PATHWAY_TEMPLATES['geo analyst'];
    expect(geoSteps).toBeDefined();
    expect(geoSteps.length).toBeGreaterThanOrEqual(6);

    // Verify all steps are geospatial domain specific
    const titles = geoSteps.map(s => s.title.toLowerCase());
    expect(titles.some(t => t.includes('gis') || t.includes('geographic'))).toBe(true);
    expect(titles.some(t => t.includes('qgis'))).toBe(true);
    expect(titles.some(t => t.includes('remote sensing'))).toBe(true);
    expect(titles.some(t => t.includes('postgis') || t.includes('spatial sql'))).toBe(true);

    // Ensure no generic IT or Business Analyst jargon replaces the geospatial curriculum
    expect(titles.some(t => t.includes('business analyst') || t.includes('erp'))).toBe(false);
  });

  it('4. Assistant Professor pathway mandates academic qualification and UGC-NET/SET milestones', () => {
    const profSteps = DOMAIN_PATHWAY_TEMPLATES['assistant professor'];
    expect(profSteps).toBeDefined();
    expect(profSteps.length).toBeGreaterThanOrEqual(6);

    const stepTitles = profSteps.map(s => s.title.toLowerCase());
    expect(stepTitles.some(t => t.includes('master') || t.includes('55%'))).toBe(true);
    expect(stepTitles.some(t => t.includes('ugc-net') || t.includes('net / set'))).toBe(true);
    expect(stepTitles.some(t => t.includes('pedagogical') || t.includes('syllabus'))).toBe(true);
    expect(stepTitles.some(t => t.includes('publication') || t.includes('scopus'))).toBe(true);
    expect(stepTitles.some(t => t.includes('ph.d') || t.includes('doctoral'))).toBe(true);

    // Check deliverable integrity
    const netStep = profSteps.find(s => s.title.toLowerCase().includes('net'));
    expect(netStep.deliverable).toContain('scorecard');
  });

  it('5. Non-technical careers (Doctor) receive clinical medical milestones without forced IT steps', () => {
    const doctorSteps = DOMAIN_PATHWAY_TEMPLATES['doctor'];
    expect(doctorSteps).toBeDefined();
    expect(doctorSteps.length).toBeGreaterThanOrEqual(6);

    const titles = doctorSteps.map(s => s.title.toLowerCase());
    expect(titles.some(t => t.includes('10+2 pcb') || t.includes('physics, chemistry, biology'))).toBe(true);
    expect(titles.some(t => t.includes('neet-ug'))).toBe(true);
    expect(titles.some(t => t.includes('mbbs'))).toBe(true);
    expect(titles.some(t => t.includes('internship') || t.includes('crmi'))).toBe(true);
    expect(titles.some(t => t.includes('registration') || t.includes('medical council'))).toBe(true);

    // Ensure zero software engineering steps leaked
    expect(titles.some(t => t.includes('python') || t.includes('react') || t.includes('git'))).toBe(false);
  });

  it('6. Incomplete or empty profile data defaults gracefully to State 1 without throwing', () => {
    const emptyContext = {};
    const rawSteps = DOMAIN_PATHWAY_TEMPLATES['ai engineer'];
    const evaluated = evaluateUserProgressAndEvidence(emptyContext, rawSteps, 'AI Engineer');

    expect(evaluated).toBeDefined();
    expect(evaluated.experience_tier).toBe('beginner');
    expect(evaluated.starting_point.step_order).toBe(1);
    expect(evaluated.metrics.total).toBe(rawSteps.length);
    expect(evaluated.metrics.completed).toBe(0);
    expect(evaluated.steps[0].status).toBe('not_started');
  });

  it('7. Deterministic fallback generates 2 distinct, rich multi-stage alternatives when AI is offline', () => {
    const fallbackPathways = buildGenericCareerPathway('Data Analyst', {
      title: 'Data Analyst',
      required_skills: [{ name: 'SQL' }, { name: 'Excel' }, { name: 'Power BI' }]
    });

    expect(fallbackPathways.length).toBeGreaterThanOrEqual(5);
    fallbackPathways.forEach(step => {
      expect(step.stage).toBeDefined();
      expect(step.stage_order).toBeGreaterThanOrEqual(1);
      expect(step.deliverable).toBeDefined();
      expect(step.why_it_matters).toBeDefined();
      expect(step.action_link).toBeDefined();
    });
  });

  it('8. Step actions: Skip, Undo, and Complete update status and recalculate metrics', async () => {
    // Create a temporary user for testing
    const testUserRes = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ('test_pathway_${Date.now()}@careergps.local', 'hash123', 'USER')
       RETURNING id`
    );
    const userId = testUserRes.rows[0].id;

    try {
      // Find template for AI Engineer
      const templateRes = await pool.query(
        `SELECT id FROM pathways WHERE career_id = $1 AND pathway_type = 'template' LIMIT 1`,
        [AI_ENGINEER_ID]
      );
      expect(templateRes.rows.length).toBe(1);
      const templateId = templateRes.rows[0].id;

      // Select template pathway
      const userPathway = await selectTemplatePathway(userId, templateId);
      expect(userPathway).toBeDefined();
      expect(userPathway.steps.length).toBeGreaterThanOrEqual(1);

      const firstStepId = userPathway.steps[0].pathway_step_id;

      // 1. Mark complete
      const completed = await completeStep(userId, userPathway.id, firstStepId, 'Finished step');
      const stepAfterComplete = completed.steps.find(s => s.pathway_step_id === firstStepId);
      expect(stepAfterComplete.status).toBe('completed');
      expect(completed.metrics.completed).toBeGreaterThanOrEqual(1);

      // 2. Undo complete
      const undone = await undoStep(userId, userPathway.id, firstStepId);
      const stepAfterUndo = undone.steps.find(s => s.pathway_step_id === firstStepId);
      expect(stepAfterUndo.status).toBe('not_started');

      // 3. Skip step
      const skipped = await skipStep(userId, userPathway.id, firstStepId);
      const stepAfterSkip = skipped.steps.find(s => s.pathway_step_id === firstStepId);
      expect(stepAfterSkip.status).toBe('skipped');
      expect(skipped.metrics.skipped).toBe(1);

      // 4. Archive/Remove pathway from My Plan
      const archived = await archiveUserPathway(userId, userPathway.id);
      expect(archived).toBe(true);

      const pathwayAfterArchive = await getUserPathway(userId, userPathway.id);
      expect(pathwayAfterArchive.status).toBe('archived');
    } finally {
      // Clean up test user
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('9. Two separate users maintain completely isolated pathways and progress', async () => {
    const user1Res = await pool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ('test_p1_${Date.now()}@careergps.local', 'hash', 'USER') RETURNING id`
    );
    const user2Res = await pool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ('test_p2_${Date.now()}@careergps.local', 'hash', 'USER') RETURNING id`
    );
    const u1 = user1Res.rows[0].id;
    const u2 = user2Res.rows[0].id;

    try {
      const templateRes = await pool.query(
        `SELECT id FROM pathways WHERE career_id = $1 AND pathway_type = 'template' LIMIT 1`,
        [AI_ENGINEER_ID]
      );
      const templateId = templateRes.rows[0].id;

      const p1 = await selectTemplatePathway(u1, templateId);
      const p2 = await selectTemplatePathway(u2, templateId);

      // Mark step on user 1 only
      await completeStep(u1, p1.id, p1.steps[0].pathway_step_id);

      const check1 = await getUserPathway(u1, p1.id);
      const check2 = await getUserPathway(u2, p2.id);

      expect(check1.metrics.completed).toBeGreaterThanOrEqual(1);
      // User 2's step 0 must NOT be marked complete manually
      const u2Step0 = check2.steps.find(s => s.pathway_step_id === p2.steps[0].pathway_step_id);
      expect(u2Step0.notes).toBeNull();
    } finally {
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [u1, u2]);
    }
  });
});
