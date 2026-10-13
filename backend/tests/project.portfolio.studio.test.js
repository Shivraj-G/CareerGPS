import { describe, expect, it } from 'vitest';
import { pool } from '../src/config/database.js';
import {
  getProjectRecommendations,
  startProject,
  getUserProjects,
  getUserProjectById,
  updateTaskProgress,
  addDeliverable,
  removeDeliverable,
  submitProject,
  updateProjectStatus,
  calculateUserExperienceTier
} from '../src/modules/projects/project.service.js';
import {
  getUserPortfolio,
  updateUserPortfolio,
  getPublicPortfolioBySlug
} from '../src/modules/projects/portfolio.service.js';
import {
  addDeliverableSchema,
  startProjectSchema,
  submitProjectSchema
} from '../src/modules/projects/project.validation.js';
import {
  evaluateUserProgressAndEvidence,
  DOMAIN_PATHWAY_TEMPLATES
} from '../src/modules/pathways/pathway-engine.js';

describe('Project & Portfolio Studio — Comprehensive Requirements & Integration Tests', () => {
  const BACKEND_ID = 'dd929e8c-07b1-4567-a202-384a53b6e254';
  const AI_ENGINEER_ID = '2a7f4d18-6335-472c-aaef-ae9547bfc1e2';
  const DATA_ANALYST_ID = '549fa435-9499-4e45-bee1-b89a13b3d64e';
  const GEO_ANALYST_ID = '5b71c777-6a12-4f11-9a7c-3f20d58be101';
  const PROFESSOR_ID = '17e40e2c-763d-496c-8fc8-c18e40bd8ab1';
  const DOCTOR_ID = '1fbc7614-cf1f-460b-b167-6eda303bb61e';

  it('1. AI Engineer project recommendations return 3 distinct difficulty tiers (Starter, Practical, Career-Ready)', async () => {
    const recs = await getProjectRecommendations({
      careerId: AI_ENGINEER_ID,
      careerTitle: 'AI Engineer'
    });

    expect(recs).toBeDefined();
    expect(recs.career_title).toBe('AI Engineer');
    expect(recs.levels).toBeDefined();
    expect(recs.levels.level_1_starter.length).toBeGreaterThanOrEqual(1);
    expect(recs.levels.level_2_practical.length).toBeGreaterThanOrEqual(1);
    expect(recs.levels.level_3_career_ready.length).toBeGreaterThanOrEqual(1);

    const starter = recs.levels.level_1_starter[0];
    expect(starter.difficulty_level).toBe(1);
    expect(starter.difficulty_label).toBe('Starter');
    expect(starter.brief).toContain('data');
    expect(starter.skills).toBeDefined();

    const capstone = recs.levels.level_3_career_ready[0];
    expect(capstone.difficulty_level).toBe(3);
    expect(capstone.difficulty_label).toBe('Career-Ready');
    expect(capstone.deliverables.some(d => d.type === 'live_demo' || d.type === 'code_repo')).toBe(true);
  });

  it('2. Backend Developer project recommendations return complete CRUD, Auth, and Cloud Microservice projects', async () => {
    const recs = await getProjectRecommendations({
      careerId: BACKEND_ID,
      careerTitle: 'Backend Developer'
    });

    expect(recs.career_title).toBe('Backend Developer');
    const l1 = recs.levels.level_1_starter[0];
    const l2 = recs.levels.level_2_practical[0];
    const l3 = recs.levels.level_3_career_ready[0];

    expect(l1.title).toContain('CRUD REST API');
    expect(l2.title).toContain('PostgreSQL');
    expect(l3.title).toContain('Microservice');

    expect(l2.prerequisites.length).toBeGreaterThan(0);
    expect(l2.acceptance_criteria.length).toBeGreaterThan(0);
  });

  it('3. Data Analyst project recommendations return EDA memo, BI dashboard, and SQL capstone', async () => {
    const recs = await getProjectRecommendations({
      careerId: DATA_ANALYST_ID,
      careerTitle: 'Data Analyst'
    });

    expect(recs.career_title).toBe('Data Analyst');
    const titles = [
      ...recs.levels.level_1_starter.map(p => p.title),
      ...recs.levels.level_2_practical.map(p => p.title),
      ...recs.levels.level_3_career_ready.map(p => p.title)
    ].join(' ');

    expect(titles).toContain('Exploratory Dataset Analysis');
    expect(titles).toContain('Dashboard');
    expect(titles).toContain('Analytics Capstone');
  });

  it('4. Geography / GIS project recommendations return thematic mapping, spatial suitability, and remote sensing', async () => {
    const recs = await getProjectRecommendations({
      careerId: GEO_ANALYST_ID,
      careerTitle: 'Geo Analyst'
    });

    expect(recs.career_title).toBe('Geo Analyst');
    const allProjects = [
      ...recs.levels.level_1_starter,
      ...recs.levels.level_2_practical,
      ...recs.levels.level_3_career_ready
    ];

    expect(allProjects.some(p => p.project_type === 'geospatial')).toBe(true);
    expect(allProjects.some(p => p.title.includes('Thematic Map'))).toBe(true);
    expect(allProjects.some(p => p.title.includes('Suitability Analysis'))).toBe(true);
  });

  it('5. Assistant Professor project recommendations return academic syllabus, rubrics, and teaching portfolio', async () => {
    const recs = await getProjectRecommendations({
      careerId: PROFESSOR_ID,
      careerTitle: 'Assistant Professor'
    });

    expect(recs.career_title).toBe('Assistant Professor');
    const all = [
      ...recs.levels.level_1_starter,
      ...recs.levels.level_2_practical,
      ...recs.levels.level_3_career_ready
    ];

    expect(all.some(p => p.project_type === 'academic')).toBe(true);
    expect(all.some(p => p.title.includes('Lesson Plan') || p.title.includes('Syllabus'))).toBe(true);
    expect(all.some(p => p.title.includes('Academic Teaching Dossier') || p.title.includes('Teaching Portfolio'))).toBe(true);
  });

  it('6. Marketing and Business Analyst project recommendations return genuine campaign and case study deliverables', async () => {
    const mktRecs = await getProjectRecommendations({
      careerTitle: 'Marketing Specialist'
    });
    expect(mktRecs.career_title).toBe('Marketing Specialist');
    const mktAll = [
      ...mktRecs.levels.level_1_starter,
      ...mktRecs.levels.level_2_practical,
      ...mktRecs.levels.level_3_career_ready
    ];
    expect(mktAll.some(p => p.title.includes('Campaign'))).toBe(true);

    const baRecs = await getProjectRecommendations({
      careerTitle: 'Business Analyst'
    });
    expect(baRecs.career_title).toBe('Business Analyst');
    const baAll = [
      ...baRecs.levels.level_1_starter,
      ...baRecs.levels.level_2_practical,
      ...baRecs.levels.level_3_career_ready
    ];
    expect(baAll.some(p => p.title.includes('Business Scenario') || p.title.includes('Process Optimization'))).toBe(true);
  });

  it('7. Regulated career (Doctor) receives clinical alternative projects without bypassing mandatory licensing', async () => {
    const docRecs = await getProjectRecommendations({
      careerId: DOCTOR_ID,
      careerTitle: 'Doctor'
    });

    const docAll = [
      ...docRecs.levels.level_1_starter,
      ...docRecs.levels.level_2_practical,
      ...docRecs.levels.level_3_career_ready
    ];
    expect(docAll.some(p => p.project_type === 'clinical_case')).toBe(true);
    // Mandatory licensing must not be bypassed
    const capstone = docRecs.levels.level_3_career_ready[0];
    expect(capstone.brief.toLowerCase()).toContain('statutory');
  });

  it('8. Personalization: beginner and experienced user receive different default recommended difficulty tiers', () => {
    const beginnerTier = calculateUserExperienceTier(
      { education: [{ level: 'Class 12' }], experience: [] },
      [],
      [],
      []
    );
    expect(beginnerTier.tier).toBe('beginner');

    const experiencedTier = calculateUserExperienceTier(
      { education: [{ level: 'B.Tech' }], experience: [{ role: 'Senior Software Engineer', years: 4 }] },
      [{ name: 'Docker' }, { name: 'Node.js' }, { name: 'PostgreSQL' }],
      ['Backend CRUD', 'Auth Service'],
      [{ title: 'API Service' }]
    );
    expect(experiencedTier.tier).toBe('experienced');
  });

  it('9. Project lifecycle: Start, update tasks, pause, resume, archive, and reopen', async () => {
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ('test_pstudio_life_${Date.now()}@careergps.local', 'hash', 'USER') RETURNING id`
    );
    const userId = userRes.rows[0].id;

    try {
      // 1. Start project
      const startInput = {
        title: 'Custom Test Microservice',
        difficultyLevel: 2,
        difficultyLabel: 'Practical',
        careerTitle: 'Backend Developer',
        brief: 'Testing lifecycle',
        problemStatement: 'Testing lifecycle',
        tasks: [{ order: 1, title: 'Task A' }, { order: 2, title: 'Task B' }]
      };
      const project = await startProject(userId, startInput);
      expect(project.id).toBeDefined();
      expect(project.status).toBe('in_progress');
      expect(project.tasks_progress.length).toBe(2);

      // 2. Check task 1
      const updatedTasks = await updateTaskProgress(userId, project.id, {
        taskOrder: 1,
        completed: true,
        notes: 'Finished task 1'
      });
      expect(updatedTasks.tasks_progress[0].completed).toBe(true);
      expect(updatedTasks.progress_percent).toBe(50);

      // 3. Pause project
      const paused = await updateProjectStatus(userId, project.id, 'paused');
      expect(paused.status).toBe('paused');
      expect(paused.paused_at).toBeDefined();

      // 4. Resume project
      const resumed = await updateProjectStatus(userId, project.id, 'in_progress');
      expect(resumed.status).toBe('in_progress');

      // 5. Archive project
      const archived = await updateProjectStatus(userId, project.id, 'archived');
      expect(archived.status).toBe('archived');

      // 6. Idempotent start resumes archived project
      const reopened = await startProject(userId, { ...startInput, projectId: project.project_id });
      expect(reopened.status).toBe('in_progress');
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('10. Deliverable management: safe URL validation rejects javascript: and malformed URLs', async () => {
    // Test URL validation schema directly
    const validHttp = addDeliverableSchema.safeParse({
      title: 'GitHub Repo',
      type: 'code_repo',
      linkUrl: 'https://github.com/myuser/project'
    });
    expect(validHttp.success).toBe(true);

    const invalidProto = addDeliverableSchema.safeParse({
      title: 'XSS Attack',
      type: 'code_repo',
      linkUrl: 'javascript:alert(1)'
    });
    expect(invalidProto.success).toBe(false);

    const invalidUrl = addDeliverableSchema.safeParse({
      title: 'Not a URL',
      type: 'code_repo',
      linkUrl: 'ftp://bad-format.com'
    });
    expect(invalidUrl.success).toBe(false);
  });

  it('11. Project completion updates user_skills with project_supported evidence without fake mastery', async () => {
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ('test_pstudio_sub_${Date.now()}@careergps.local', 'hash', 'USER') RETURNING id`
    );
    const userId = userRes.rows[0].id;

    try {
      // Find a real skill
      const skillRes = await pool.query(`SELECT id, name FROM skills WHERE name = 'REST APIs' LIMIT 1`);
      expect(skillRes.rows.length).toBe(1);
      const skill = skillRes.rows[0];

      // Start a project exercising REST APIs
      const project = await startProject(userId, {
        title: 'REST API CRUD Delivery',
        difficultyLevel: 1,
        difficultyLabel: 'Starter',
        careerTitle: 'Backend Developer',
        brief: 'Deliverable test',
        problemStatement: 'Testing submission',
        skills: [skill.name],
        deliverables: [{ type: 'code_repo', title: 'Source Code', required: true }]
      });

      // Submit project with deliverable and reflection
      const submission = await submitProject(userId, project.id, {
        deliverables: [
          {
            type: 'code_repo',
            title: 'Verified Code Repo',
            linkUrl: 'https://github.com/careergps-user/crud-api',
            notes: 'Production tested'
          }
        ],
        reflection: {
          learnings: 'Mastered input validation and error handling',
          challenges: 'Handling edge case 400s',
          futureImprovements: 'Add caching with Redis'
        }
      });

      expect(submission.project.status).toBe('completed');
      expect(submission.project.completed_at).toBeDefined();

      // Verify skill was updated in user_skills with evidence_type = 'project_supported'
      const userSkillCheck = await pool.query(
        `SELECT * FROM user_skills WHERE user_id = $1 AND skill_id = $2`,
        [userId, skill.id]
      );
      expect(userSkillCheck.rows.length).toBe(1);
      expect(userSkillCheck.rows[0].evidence_type).toBe('project_supported');
      expect(userSkillCheck.rows[0].evidence_notes).toContain('REST API CRUD Delivery');
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('12. Portfolio privacy: private by default, sanitized public view hides email and unpublished projects', async () => {
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ('test_portfolio_priv_${Date.now()}@careergps.local', 'hash', 'USER') RETURNING id`
    );
    const userId = userRes.rows[0].id;

    try {
      // 1. Get user portfolio
      const { portfolio } = await getUserPortfolio(userId);
      expect(portfolio).toBeDefined();
      expect(portfolio.is_public).toBe(false);

      // 2. Fetch public portfolio when private -> returns null
      const privateCheck = await getPublicPortfolioBySlug(portfolio.share_slug);
      expect(privateCheck).toBeNull();

      // 3. Make public but keep email private
      await updateUserPortfolio(userId, {
        is_public: true,
        display_name: 'Alex Engineer',
        privacy_settings: { show_email: false, show_skills: true, allow_download: true }
      });

      const publicView = await getPublicPortfolioBySlug(portfolio.share_slug);
      expect(publicView).toBeDefined();
      expect(publicView.display_name).toBe('Alex Engineer');
      expect(publicView.contact_email).toBeNull(); // Private email hidden
      expect(publicView.user_id).toBeUndefined(); // Internal user ID not leaked
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('13. Pathway engine integrates completed project to satisfy Apply Your Skills stage', () => {
    const rawSteps = DOMAIN_PATHWAY_TEMPLATES['backend developer'];
    const userContextWithProject = {
      profile: { education: [{ level: 'BCA' }] },
      user_skills: [{ name: 'JavaScript' }, { name: 'Node.js' }],
      custom_skills: [],
      user_projects: [
        {
          title: 'Asynchronous Processing, Caching & Message Queues Service',
          career_title: 'Backend Developer',
          status: 'completed',
          skills: ['Redis', 'Caching']
        }
      ]
    };

    const evaluated = evaluateUserProgressAndEvidence(userContextWithProject, rawSteps, 'Backend Developer');
    const stage4Step = evaluated.steps.find(s => s.step_order === 4);

    expect(stage4Step.stage).toContain('Apply Your Skills');
    expect(stage4Step.status).toBe('completed');
    expect(stage4Step.completion_source).toBe('project_completed');
    expect(stage4Step.auto_evidence).toContain('Verified via completed project');
  });

  it('14. Generic skills (Communication/Presentation) do NOT mark project/portfolio stage complete', () => {
    const rawSteps = DOMAIN_PATHWAY_TEMPLATES['backend developer'];
    const genericSkillsContext = {
      profile: {},
      user_skills: [
        { name: 'Communication' },
        { name: 'Presentation Skills' },
        { name: 'Problem Solving' }
      ],
      custom_skills: [],
      user_projects: []
    };

    const evaluated = evaluateUserProgressAndEvidence(genericSkillsContext, rawSteps, 'Backend Developer');
    const stage4Step = evaluated.steps.find(s => s.step_order === 4);

    // Project stage must NOT be marked complete solely due to generic skills
    expect(stage4Step.status).not.toBe('completed');
  });

  it('15. Parallel practice allowed: project stage is not blocked if technical prerequisites are met', () => {
    const rawSteps = DOMAIN_PATHWAY_TEMPLATES['backend developer'];
    // User has completed prerequisite REST APIs
    const parallelContext = {
      profile: {},
      user_skills: [{ name: 'REST APIs' }],
      custom_skills: [],
      user_projects: []
    };

    const evaluated = evaluateUserProgressAndEvidence(parallelContext, rawSteps, 'Backend Developer');
    const stage4Step = evaluated.steps.find(s => s.step_order === 4);

    // Because prerequisite 'RESTful API Architecture' is satisfied via skills, it is not blocked
    expect(stage4Step.is_blocked).toBe(false);
  });
});
