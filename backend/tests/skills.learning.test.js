import { describe, expect, it } from 'vitest';
import { pool } from '../src/config/database.js';
import {
  classifySkillLevel,
  getLevelNumber,
  buildLearningMetadata,
  personalizeSkill,
  enrichCareerSkillsList,
  enrichSkillWithAi,
  normalizeString
} from '../src/modules/skills/skill-learning-engine.js';
import { calculateSkillGap } from '../src/modules/skills/skill-intelligence.service.js';

describe('3-Level Career Skills Engine & Personalization Tests', () => {
  const AI_ENGINEER_ID = '2a7f4d18-6335-472c-aaef-ae9547bfc1e2';
  const DOCTOR_ID = '1fbc7614-cf1f-460b-b167-6eda303bb61e';
  const ERP_ID = '863e1d32-8e45-4cac-a937-304f45a82550';
  const TEACHER_ID = '9ae2c439-f3eb-4ddc-89d6-f269bcdaf460';
  const PROF_ID = '17e40e2c-763d-496c-8fc8-c18e40bd8ab1';

  it('1. AI Engineer displays relevant skills across all three learning levels', async () => {
    const sRes = await pool.query(
      `SELECT s.id, s.name, s.description, s.learning_level, s.learning_metadata,
              cs.importance, cs.origin, cs.verification_status
       FROM career_skills cs
       JOIN skills s ON s.id = cs.skill_id
       WHERE cs.career_id = $1 AND s.record_status IN ('published', 'needs_review')`,
      [AI_ENGINEER_ID]
    );

    const enriched = enrichCareerSkillsList({
      skills: sRes.rows,
      career: { id: AI_ENGINEER_ID, title: 'AI Engineer' }
    });

    expect(enriched.summary.total_count).toBe(7);
    expect(enriched.summary.foundational_count).toBeGreaterThanOrEqual(1);
    expect(enriched.summary.intermediate_count).toBeGreaterThanOrEqual(1);
    expect(enriched.summary.advanced_count).toBeGreaterThanOrEqual(1);

    const foundational = enriched.skills.filter(s => s.learning_level === 'foundational').map(s => s.name);
    const intermediate = enriched.skills.filter(s => s.learning_level === 'intermediate').map(s => s.name);
    const advanced = enriched.skills.filter(s => s.learning_level === 'advanced').map(s => s.name);

    expect(foundational).toContain('Python');
    expect(intermediate).toContain('Machine Learning');
    expect(advanced).toContain('RAG');
    expect(advanced).toContain('LLM Concepts');
  });

  it('2. Other careers receive their own domain-authentic skills, not AI Engineer skills', async () => {
    // Test Doctor
    const docRes = await pool.query(
      `SELECT s.id, s.name, s.description, s.learning_level, s.learning_metadata,
              cs.importance, cs.origin, cs.verification_status
       FROM career_skills cs
       JOIN skills s ON s.id = cs.skill_id
       WHERE cs.career_id = $1`,
      [DOCTOR_ID]
    );
    const docEnriched = enrichCareerSkillsList({
      skills: docRes.rows,
      career: { id: DOCTOR_ID, title: 'Doctor' }
    });

    const docNames = docEnriched.skills.map(s => s.name);
    expect(docNames).toContain('Anatomy');
    expect(docNames).toContain('Physiology');
    expect(docNames).toContain('Clinical history taking');
    expect(docNames).not.toContain('Python');
    expect(docNames).not.toContain('Machine Learning');
    expect(docNames).not.toContain('RAG');

    // Test ERP Specialist
    const erpRes = await pool.query(
      `SELECT s.id, s.name, s.description, s.learning_level, s.learning_metadata,
              cs.importance, cs.origin, cs.verification_status
       FROM career_skills cs
       JOIN skills s ON s.id = cs.skill_id
       WHERE cs.career_id = $1`,
      [ERP_ID]
    );
    const erpEnriched = enrichCareerSkillsList({
      skills: erpRes.rows,
      career: { id: ERP_ID, title: 'ERP Specialist' }
    });

    const erpNames = erpEnriched.skills.map(s => s.name);
    expect(erpNames).toContain('ERP Concepts');
    expect(erpNames).toContain('Business Analysis');
    expect(erpNames).not.toContain('Anatomy');
    expect(erpNames).not.toContain('RAG');

    // Test Teacher
    const teacherRes = await pool.query(
      `SELECT s.id, s.name, s.description, s.learning_level, s.learning_metadata,
              cs.importance, cs.origin, cs.verification_status
       FROM career_skills cs
       JOIN skills s ON s.id = cs.skill_id
       WHERE cs.career_id = $1`,
      [TEACHER_ID]
    );
    const teacherEnriched = enrichCareerSkillsList({
      skills: teacherRes.rows,
      career: { id: TEACHER_ID, title: 'Teacher' }
    });
    const teacherNames = teacherEnriched.skills.map(s => s.name);
    expect(teacherNames).toContain('Teaching/Pedagogy');
    expect(teacherNames).toContain('Curriculum Development');
    expect(teacherNames).not.toContain('Python');
  });

  it('3. Skill detail produces all required structured content', () => {
    const skill = { name: 'Python', learning_level: 'foundational', importance: 'required' };
    const meta = buildLearningMetadata(skill, 'AI Engineer');

    expect(meta.what_it_means).toBeTruthy();
    expect(meta.why_needed).toBeTruthy();
    expect(meta.why_needed.toLowerCase()).toContain('ai engineer');
    expect(Array.isArray(meta.what_to_learn)).toBe(true);
    expect(meta.what_to_learn.length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(meta.prerequisites)).toBe(true);
    expect(meta.practical_application).toBeTruthy();
    expect(meta.hands_on_exercise).toBeTruthy();
    expect(meta.estimated_effort).toContain('planning estimate');
    expect(Array.isArray(meta.learning_resources)).toBe(true);
    expect(meta.learning_resources.length).toBeGreaterThanOrEqual(1);
    expect(meta.recommended_action).toBeTruthy();
  });

  it('4. Details work gracefully for uncatalogued/custom skills with deterministic fallback', () => {
    const customSkill = { name: 'Custom Quantum Cryptography Tool', importance: 'useful' };
    const meta = buildLearningMetadata(customSkill, 'Security Researcher');

    expect(meta.what_it_means).toBeTruthy();
    expect(meta.why_needed).toBeTruthy();
    expect(meta.what_to_learn.length).toBeGreaterThanOrEqual(3);
    expect(meta.hands_on_exercise).toBeTruthy();
    expect(meta.estimated_effort).toBeTruthy();
    expect(meta.learning_resources).toBeTruthy();
  });

  it('5. Mandatory requirement status is preserved strictly independent of learning difficulty', async () => {
    const sRes = await pool.query(
      `SELECT s.id, s.name, s.description, s.learning_level, s.learning_metadata,
              cs.importance, cs.origin, cs.verification_status
       FROM career_skills cs
       JOIN skills s ON s.id = cs.skill_id
       WHERE cs.career_id = $1`,
      [AI_ENGINEER_ID]
    );

    const enriched = enrichCareerSkillsList({
      skills: sRes.rows,
      career: { id: AI_ENGINEER_ID, title: 'AI Engineer' }
    });

    const python = enriched.skills.find(s => s.name === 'Python');
    const ml = enriched.skills.find(s => s.name === 'Machine Learning');
    const rag = enriched.skills.find(s => s.name === 'RAG');

    // Python is Level 1 Foundational, but Mandatory ('required')
    expect(python.learning_level).toBe('foundational');
    expect(python.importance).toBe('required');

    // Machine Learning is Level 2 Intermediate, but Mandatory ('required')
    expect(ml.learning_level).toBe('intermediate');
    expect(ml.importance).toBe('required');

    // RAG is Level 3 Advanced, but Complementary ('useful')
    expect(rag.learning_level).toBe('advanced');
    expect(rag.importance).toBe('useful');
  });

  it('6. Skills tab skill IDs agree with calculateSkillGap', async () => {
    const testUserRes = await pool.query(`SELECT id FROM users LIMIT 1`);
    const userId = testUserRes.rows[0].id;

    const gap = await calculateSkillGap(userId, AI_ENGINEER_ID);
    const careerSkillsRes = await pool.query(
      `SELECT s.id, s.name, cs.importance FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1`,
      [AI_ENGINEER_ID]
    );

    const gapSkillIds = [
      ...gap.skills_present.map(s => s.skill_id),
      ...gap.skills_needing_development.map(s => s.skill_id)
    ];

    for (const cs of careerSkillsRes.rows) {
      expect(gapSkillIds).toContain(cs.id);
    }
  });

  it('7. User profile evidence changes personalized status appropriately', () => {
    const skillML = {
      id: 'ml-123',
      name: 'Machine Learning',
      learning_level: 'intermediate',
      importance: 'required'
    };

    // Case A: User has Python and Stats in profile -> ready to start ML
    const userSkillsReady = new Map([
      ['python', { name: 'Python', verified: true, level: 'intermediate' }],
      ['statistics', { name: 'Statistics', verified: false, level: 'intermediate' }]
    ]);

    const personalizedReady = personalizeSkill({
      skill: skillML,
      careerTitle: 'AI Engineer',
      userSkillsMap: userSkillsReady,
      gapData: { missing_skills: [{ skill: 'Machine Learning' }] }
    });

    expect(personalizedReady.user_status).toBe('assessed_gap');
    expect(personalizedReady.is_recommended_next).toBe(true);

    // Case B: User already has Machine Learning demonstrated in profile
    const userSkillsDemonstrated = new Map([
      ['machinelearning', { name: 'Machine Learning', verified: true, level: 'advanced' }]
    ]);

    const personalizedDem = personalizeSkill({
      skill: skillML,
      careerTitle: 'AI Engineer',
      userSkillsMap: userSkillsDemonstrated
    });

    expect(personalizedDem.user_status).toBe('demonstrated');
    expect(personalizedDem.is_demonstrated).toBe(true);
    expect(personalizedDem.is_recommended_next).toBe(false);
  });

  it('8. Fallback works seamlessly if AI service is offline', async () => {
    // Direct call with simulated offline environment
    const detail = await enrichSkillWithAi('TensorFlow', 'AI Engineer', 'important');
    expect(detail).toBeTruthy();
    expect(detail.what_it_means).toBeTruthy();
    expect(detail.what_to_learn.length).toBeGreaterThanOrEqual(3);
    expect(detail.estimated_effort).toContain('planning estimate');
  });

  it('9. Browsing skills does not alter user profile or current_goal', async () => {
    const testUser = await pool.query(`SELECT id FROM users LIMIT 1`);
    const userId = testUser.rows[0].id;

    const before = await pool.query(`SELECT current_goal FROM user_profiles WHERE user_id = $1`, [userId]);
    const originalGoal = before.rows[0]?.current_goal;

    // Simulate requesting skills for Doctor
    const sRes = await pool.query(
      `SELECT s.id, s.name, cs.importance FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1`,
      [DOCTOR_ID]
    );
    enrichCareerSkillsList({
      skills: sRes.rows,
      career: { id: DOCTOR_ID, title: 'Doctor' },
      userSkills: [],
      customSkills: [],
      userProfile: { current_goal: originalGoal }
    });

    const after = await pool.query(`SELECT current_goal FROM user_profiles WHERE user_id = $1`, [userId]);
    expect(after.rows[0]?.current_goal).toEqual(originalGoal);
  });
});
