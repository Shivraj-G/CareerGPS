import { describe, expect, it, vi, afterEach } from 'vitest';
import { pool } from '../src/config/database.js';
import {
  getProjectRecommendations,
  startProject,
  getUserProjects,
  generateFallbackProjects,
  calculateUserExperienceTier
} from '../src/modules/projects/project.service.js';
import { getUserPortfolio } from '../src/modules/projects/portfolio.service.js';

describe('Chef & AI Projects Studio Regression Test Suite', () => {
  const CHEF_CAREER_ID = 'ddbe9b4c-7b69-4696-a242-33f36b6d2261';
  const AI_ENGINEER_ID = '2a7f4d18-6335-472c-aaef-ae9547bfc1e2';
  const BACKEND_ID = 'dd929e8c-07b1-4567-a202-384a53b6e254';
  const DATA_ANALYST_ID = '549fa435-9499-4e45-bee1-b89a13b3d64e';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Chef with empty catalogue in database returns credible culinary projects across all 3 tiers', async () => {
    // Verify Chef has 0 rows in database career_projects
    const dbCheck = await pool.query(
      'SELECT COUNT(*) FROM career_projects WHERE career_id = $1',
      [CHEF_CAREER_ID]
    );
    expect(parseInt(dbCheck.rows[0].count, 10)).toBe(0);

    const recs = await getProjectRecommendations({
      careerId: CHEF_CAREER_ID,
      careerTitle: 'Chef'
    });

    expect(recs).toBeDefined();
    expect(recs.career_title).toBe('Chef');
    expect(recs.project_counts.total).toBeGreaterThanOrEqual(3);

    // Starter, Practical, Career-Ready
    expect(recs.levels.level_1_starter.length).toBeGreaterThanOrEqual(1);
    expect(recs.levels.level_2_practical.length).toBeGreaterThanOrEqual(1);
    expect(recs.levels.level_3_career_ready.length).toBeGreaterThanOrEqual(1);

    const allChefTitles = [
      ...recs.levels.level_1_starter.map(p => p.title),
      ...recs.levels.level_2_practical.map(p => p.title),
      ...recs.levels.level_3_career_ready.map(p => p.title)
    ].join(' ');

    // Must be culinary/hospitality related, NOT generic tech CRUD projects
    const hasCulinaryTerms = /menu|recipe|kitchen|culinary|food|hygiene|safety|costing|plating/i.test(allChefTitles);
    expect(hasCulinaryTerms).toBe(true);
  }, 25000);

  it('2. AI Engineer returns matching database projects with database_catalogue provenance', async () => {
    const recs = await getProjectRecommendations({
      careerId: AI_ENGINEER_ID,
      careerTitle: 'AI Engineer'
    });

    expect(recs.career_title).toBe('AI Engineer');
    expect(recs.project_counts.total).toBeGreaterThanOrEqual(3);
    const starter = recs.levels.level_1_starter[0];
    expect(starter.provenance).toBe('database_catalogue');
    expect(starter.difficulty_label).toBe('Starter');
  });

  it('3. Backend Developer returns structured projects with tasks and acceptance criteria', async () => {
    const recs = await getProjectRecommendations({
      careerId: BACKEND_ID,
      careerTitle: 'Backend Developer'
    });

    expect(recs.levels.level_1_starter.length).toBeGreaterThanOrEqual(1);
    const starter = recs.levels.level_1_starter[0];
    expect(starter.tasks).toBeDefined();
    expect(starter.tasks.length).toBeGreaterThan(0);
    expect(starter.acceptance_criteria).toBeDefined();
  });

  it('4. Data Analyst returns relevant analytics projects across all tiers', async () => {
    const recs = await getProjectRecommendations({
      careerId: DATA_ANALYST_ID,
      careerTitle: 'Data Analyst'
    });

    expect(recs.levels.level_1_starter.length).toBeGreaterThanOrEqual(1);
    expect(recs.levels.level_2_practical.length).toBeGreaterThanOrEqual(1);
    expect(recs.levels.level_3_career_ready.length).toBeGreaterThanOrEqual(1);

    const l1 = recs.levels.level_1_starter[0];
    expect(l1.skills.some(s => /sql|python|data|analytics|eda|pandas/i.test(s))).toBe(true);
  });

  it('5. Non-technical career fallback works when AI service is offline', () => {
    // Generate fallback directly
    const fallbackProjects = generateFallbackProjects('Chef', 'intermediate', 'Practical');
    expect(fallbackProjects.length).toBe(3);

    const starter = fallbackProjects.find(p => p.difficulty_level === 1);
    const practical = fallbackProjects.find(p => p.difficulty_level === 2);
    const careerReady = fallbackProjects.find(p => p.difficulty_level === 3);

    expect(starter).toBeDefined();
    expect(starter.difficulty_label).toBe('Starter');
    expect(starter.title).toContain('Menu Planning');

    expect(practical).toBeDefined();
    expect(practical.difficulty_label).toBe('Practical');
    expect(practical.title).toContain('Food Costing');

    expect(careerReady).toBeDefined();
    expect(careerReady.difficulty_label).toBe('Career-Ready');
    expect(careerReady.title).toContain('Restaurant Concept');
  });

  it('6. Both AI providers failing triggers graceful domain fallback without throwing or returning 0 projects', async () => {
    // Mock global fetch to reject (simulate total AI outage)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('AI Service Unreachable'));

    try {
      const recs = await getProjectRecommendations({
        careerId: CHEF_CAREER_ID,
        careerTitle: 'Chef'
      });

      expect(recs).toBeDefined();
      expect(recs.project_counts.total).toBe(3);
      expect(recs.levels.level_1_starter.length).toBe(1);
      expect(recs.levels.level_2_practical.length).toBe(1);
      expect(recs.levels.level_3_career_ready.length).toBe(1);
      expect(recs.levels.level_1_starter[0].provenance).toBe('domain_fallback');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('7. Malformed AI service response gracefully recovers with domain fallback', async () => {
    const originalFetch = globalThis.fetch;
    // Mock AI returning malformed / unexpected payload
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected_key: 'not_an_array', error: null })
    });

    try {
      const recs = await getProjectRecommendations({
        careerId: CHEF_CAREER_ID,
        careerTitle: 'Chef'
      });

      expect(recs).toBeDefined();
      expect(recs.project_counts.total).toBeGreaterThanOrEqual(3);
      expect(recs.levels.level_1_starter[0].provenance).toBe('domain_fallback');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('8. Difficulty filters normalize consistently across all 3 tiers', async () => {
    const recs = await getProjectRecommendations({
      careerId: CHEF_CAREER_ID,
      careerTitle: 'Chef'
    });

    const starters = recs.levels.level_1_starter;
    const practicals = recs.levels.level_2_practical;
    const careerReadies = recs.levels.level_3_career_ready;

    for (const p of starters) {
      expect(p.difficulty_level).toBe(1);
      expect(p.difficulty_label).toBe('Starter');
    }
    for (const p of practicals) {
      expect(p.difficulty_level).toBe(2);
      expect(p.difficulty_label).toBe('Practical');
    }
    for (const p of careerReadies) {
      expect(p.difficulty_level).toBe(3);
      expect(p.difficulty_label).toBe('Career-Ready');
    }
  }, 25000);

  it('9. Starting an AI candidate project (null project_id) persists under user without FK violation', async () => {
    // Create test user
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3) RETURNING id`,
      [`test_chef_studio_${Date.now()}@example.com`, 'hash', 'USER']
    );
    const userId = userRes.rows[0].id;

    try {
      // Generated candidate has a non-catalogue UUID
      const aiCandidate = {
        projectId: 'ai-cand-99999999-9999-9999-9999-999999999999',
        careerId: CHEF_CAREER_ID,
        careerTitle: 'Chef',
        title: 'Design Balanced Seasonal Tasting Menu',
        brief: 'Create and cost a balanced 5-course seasonal menu with allergen matrix.',
        difficultyLevel: 2,
        difficultyLabel: 'Practical',
        problemStatement: 'Modern kitchens require strict costing and food waste management.',
        skills: ['Menu Planning', 'Food Safety', 'Recipe Costing'],
        tasks: [
          { id: 't1', title: 'Draft menu items', order: 1, completed: false },
          { id: 't2', title: 'Calculate portion margins', order: 2, completed: false }
        ],
        deliverables: [
          { type: 'document', title: 'Menu Spec Sheet', required: true }
        ],
        acceptanceCriteria: ['All 5 courses have ingredient costing with margin >= 65%'],
        learningObjectives: ['Master commercial recipe standardization']
      };

      const started = await startProject(userId, {
        projectId: aiCandidate.projectId,
        careerId: aiCandidate.careerId,
        careerTitle: aiCandidate.careerTitle,
        title: aiCandidate.title,
        brief: aiCandidate.brief,
        difficultyLevel: aiCandidate.difficultyLevel,
        difficultyLabel: aiCandidate.difficultyLabel,
        problemStatement: aiCandidate.problemStatement,
        skills: aiCandidate.skills,
        tasks: aiCandidate.tasks,
        deliverables: aiCandidate.deliverables,
        acceptanceCriteria: aiCandidate.acceptanceCriteria,
        learningObjectives: aiCandidate.learningObjectives
      });

      expect(started).toBeDefined();
      expect(started.id).toBeDefined();
      expect(started.user_id).toBe(userId);
      expect(started.title).toBe('Design Balanced Seasonal Tasting Menu');
      expect(started.status).toBe('in_progress');
      expect(started.career_title).toBe('Chef');
      expect(started.skills).toContain('Menu Planning');
      // Foreign key project_id should be null because it was an AI candidate
      expect(started.project_id).toBeNull();

      // Verify it appears in getUserProjects
      const userProjects = await getUserProjects(userId);
      expect(userProjects.length).toBe(1);
      expect(userProjects[0].title).toBe('Design Balanced Seasonal Tasting Menu');

      // Verify portfolio loads without crashing
      const portfolio = await getUserPortfolio(userId);
      expect(portfolio).toBeDefined();
      expect(portfolio.projects).toBeDefined();
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('10. Repeated Generate Suggestions calls return consistent, deduplicated candidates', async () => {
    const run1 = await getProjectRecommendations({
      careerId: CHEF_CAREER_ID,
      careerTitle: 'Chef'
    });
    const run2 = await getProjectRecommendations({
      careerId: CHEF_CAREER_ID,
      careerTitle: 'Chef'
    });

    expect(run1.project_counts.total).toBeGreaterThanOrEqual(3);
    expect(run2.project_counts.total).toBeGreaterThanOrEqual(3);

    // Verify no internal duplicates within a single response
    const titles1 = [
      ...run1.levels.level_1_starter.map(p => p.title.toLowerCase()),
      ...run1.levels.level_2_practical.map(p => p.title.toLowerCase()),
      ...run1.levels.level_3_career_ready.map(p => p.title.toLowerCase())
    ];
    const uniqueTitles1 = new Set(titles1);
    expect(titles1.length).toBe(uniqueTitles1.size);
  }, 25000);
});
