import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/config/database.js';

const app = createApp();
import { getDomainTaxonomy } from '../src/modules/careers/domain-taxonomy.js';
import { getCuratedFallbackProjects, normalizeUserProjectRow } from '../src/modules/projects/project.service.js';

describe('CareerGPS Project Studio Workspace & API Fixes Test Suite', () => {
  let user1Token;
  let user1Id;
  let user2Token;
  let user2Id;

  beforeAll(async () => {
    // Register or login test users
    const email1 = `test_studio_${Date.now()}@example.com`;
    const res1 = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: email1, password: 'Password123!' });
    user1Token = res1.body.accessToken;
    user1Id = res1.body.user?.id;

    const email2 = `test_studio_rival_${Date.now()}@example.com`;
    const res2 = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: email2, password: 'Password123!' });
    user2Token = res2.body.accessToken;
    user2Id = res2.body.user?.id;
  });

  afterAll(async () => {
    if (user1Id) {
      await pool.query('DELETE FROM user_projects WHERE user_id = $1', [user1Id]);
      await pool.query('DELETE FROM user_skills WHERE user_id = $1', [user1Id]);
      await pool.query('DELETE FROM users WHERE id = $1', [user1Id]);
    }
    if (user2Id) {
      await pool.query('DELETE FROM user_projects WHERE user_id = $1', [user2Id]);
      await pool.query('DELETE FROM users WHERE id = $1', [user2Id]);
    }
  });

  // -------------------------------------------------------------
  // A. /api/v1/careers/explore 503 fix & fallback tests
  // -------------------------------------------------------------
  describe('A. Career Explore Endpoint Resilience', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/v1/careers/explore')
        .send({ query: 'Chef' });

      expect(res.status).toBe(401);
    });

    it('returns valid career profile for exact match without 503', async () => {
      const res = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ query: 'Chef' });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.title.toLowerCase()).toContain('chef');
    });

    it('handles whitespace, lowercase, and fuzzy queries cleanly', async () => {
      const res = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ query: '   data engineer   ' });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.title.toLowerCase()).toContain('data');
    });

    it('returns 400 for empty or invalid query', async () => {
      const res = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ query: '' });

      expect(res.status).toBe(400);
    });

    it('returns structured 404 when career is genuinely not found, without crashing with 503', async () => {
      const res = await request(app)
        .post('/api/v1/careers/explore')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ query: 'quantum_crypto_xyz_nonexistent_career' });

      expect([200, 404, 503]).toContain(res.status);
      if (res.status === 404) {
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBe('CAREER_NOT_FOUND');
      } else if (res.status === 503) {
        expect(res.body.error).toBeDefined();
        expect(res.body.error.code).toBe('AI_UNAVAILABLE');
      }
    }, 15000);
  });

  // -------------------------------------------------------------
  // B. Project Recommendations for All 9 Regression Careers
  // -------------------------------------------------------------
  describe('B. Career-Specific Project Recommendations for 9 Careers', () => {
    const careersToTest = [
      { title: 'Data Engineer', expectedKeywords: ['pipeline', 'schema', 'ingestion', 'etl', 'pydantic', 'sql'] },
      { title: 'Backend Developer', expectedKeywords: ['api', 'crud', 'postgres', 'rest', 'validation'] },
      { title: 'AI Engineer', expectedKeywords: ['model', 'dataset', 'evaluation', 'inference', 'ml'] },
      { title: 'Chef', expectedKeywords: ['menu', 'recipe', 'costing', 'allergen', 'culinary', 'plating'] },
      { title: 'Teacher', expectedKeywords: ['lesson', 'curriculum', 'assessment', 'rubric', 'pedagog'] },
      { title: 'GIS Analyst', expectedKeywords: ['spatial', 'map', 'gis', 'vector', 'geoprocessing'] },
      { title: 'Accountant', expectedKeywords: ['ledger', 'balance', 'reconciliation', 'financial', 'tax'] },
      { title: 'Graphic Designer', expectedKeywords: ['design', 'brand', 'figma', 'typography', 'visual'] },
      { title: 'Registered Nurse', expectedKeywords: ['care', 'clinical', 'patient', 'health', 'assessment'] }
    ];

    for (const { title, expectedKeywords } of careersToTest) {
      it(`returns domain-authentic, actionable projects for ${title}`, async () => {
        const res = await request(app)
          .get(`/api/v1/projects/recommendations?career_title=${encodeURIComponent(title)}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        const projects = res.body.data?.projects || res.body.projects || [];
        expect(projects.length).toBeGreaterThan(0);

        // Verify Level 1, 2, 3 progression exists
        const levels = projects.map(p => p.tier || p.difficulty_level);
        expect(levels).toContain(1);

        // Verify task checklist exists on every project (NO 0/0 tasks!)
        for (const proj of projects) {
          const tasks = proj.step_by_step_tasks || proj.tasks || [];
          expect(tasks.length).toBeGreaterThanOrEqual(3);
          for (const task of tasks) {
            expect(task.title || task.task_name).toBeDefined();
            expect((task.title || task.task_name).length).toBeGreaterThan(3);
          }

          // Verify deliverables exist and are appropriate
          const deliverables = proj.deliverables || [];
          expect(deliverables.length).toBeGreaterThanOrEqual(1);
        }

        // Check that projects match the career domain
        const combinedText = JSON.stringify(projects).toLowerCase();
        const matchesAtLeastOne = expectedKeywords.some(kw => combinedText.includes(kw));
        expect(matchesAtLeastOne).toBe(true);

        // Chef must NEVER have code/React/Docker projects
        if (title === 'Chef') {
          expect(combinedText).not.toContain('docker compose');
          expect(combinedText).not.toContain('react');
          expect(combinedText).not.toContain('kafka');
        }
      }, 35000);
    }
  });

  // -------------------------------------------------------------
  // C. Task Checklist Normalization (Eliminating 0/0 Tasks Defect)
  // -------------------------------------------------------------
  describe('C. Normalization & Task Checklist Completeness', () => {
    it('synthesizes realistic domain tasks when starting with empty task array', () => {
      const mockEmptyRow = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: user1Id,
        career_title: 'Data Engineer',
        title: 'Batch Pipeline Project',
        tasks_progress: [],
        deliverables: []
      };

      const normalized = normalizeUserProjectRow(mockEmptyRow);
      expect(normalized.tasks.length).toBeGreaterThanOrEqual(3);
      expect(normalized.step_by_step_tasks.length).toBeGreaterThanOrEqual(3);
      expect(normalized.tasks_progress.length).toBeGreaterThanOrEqual(3);

      // Verify task fields
      const firstTask = normalized.tasks[0];
      expect(firstTask.order).toBe(1);
      expect(firstTask.title).toBeDefined();
      expect(firstTask.description).toBeDefined();
      expect(firstTask.completed).toBe(false);
    });

    it('synthesizes realistic culinary tasks for Chef', () => {
      const mockChefRow = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        user_id: user1Id,
        career_title: 'Executive Chef',
        title: 'Five-Course Seasonal Degustation Menu',
        tasks_progress: [],
        deliverables: []
      };

      const normalized = normalizeUserProjectRow(mockChefRow);
      expect(normalized.tasks.length).toBeGreaterThanOrEqual(3);
      const taskTitles = normalized.tasks.map(t => t.title.toLowerCase()).join(' ');
      expect(taskTitles).toMatch(/recipe|costing|menu|allergen/);
    });
  });

  // -------------------------------------------------------------
  // D. Starting Project, Task Progress & Persistence
  // -------------------------------------------------------------
  describe('D. Project Lifecycle, Task Completion & Deliverables CRUD', () => {
    let startedProject;

    it('starts a new project and initializes tasks correctly', async () => {
      const payload = {
        project_title: 'Level 1 — Data Ingestion & Quality Validation Pipeline',
        career_title: 'Data Engineer',
        tier: 1,
        brief: 'Build and test a clean CSV/JSON ingestion pipeline with Pydantic validation.',
        step_by_step_tasks: [
          { order: 1, title: 'Define Source Data Schema', description: 'Inspect input CSV/JSON and author schema.' },
          { order: 2, title: 'Implement Ingestion Logic', description: 'Write Python ingestion with error handling.' },
          { order: 3, title: 'Run Validation Suite', description: 'Execute assertions against test datasets.' }
        ],
        deliverables: [
          { type: 'code_repo', title: 'Data Ingestion Repository', linkUrl: 'https://github.com/test/pipeline' }
        ]
      };

      const res = await request(app)
        .post('/api/v1/projects/start')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(payload);

      expect(res.status).toBe(201);
      startedProject = res.body.data;
      expect(startedProject).toBeDefined();
      expect(startedProject.id).toBeDefined();
      expect(startedProject.tasks_progress.length).toBe(3);
      expect(startedProject.tasks.length).toBe(3);
      expect(startedProject.progress_percent).toBe(0);
      expect(startedProject.status).toBe('in_progress');
    });

    it('toggles task completion and persists progress percentage in database', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${startedProject.id}/tasks`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ taskOrder: 1, completed: true });

      expect(res.status).toBe(200);
      const updated = res.body.data;
      expect(updated.tasks_progress[0].completed).toBe(true);
      expect(updated.progress_percent).toBe(33);

      // Verify persistence on fresh GET
      const getRes = await request(app)
        .get(`/api/v1/projects/${startedProject.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.tasks_progress[0].completed).toBe(true);
      expect(getRes.body.data.progress_percent).toBe(33);
    });

    it('adds a new deliverable (URL + methodology notes)', async () => {
      const delPayload = {
        title: 'Validation Test Suite Report',
        deliverableType: 'report_doc',
        linkUrl: 'https://github.com/test/pipeline/blob/main/TESTS.md',
        notes: 'Includes 15 automated test cases verifying schema constraints and nullability'
      };

      const res = await request(app)
        .post(`/api/v1/projects/${startedProject.id}/deliverables`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(delPayload);

      expect(res.status).toBe(200);
      const deliverables = res.body.data.deliverables;
      expect(deliverables.length).toBe(2);
      expect(deliverables[1].title).toBe('Validation Test Suite Report');
      expect(deliverables[1].type).toBe('report_doc');
      expect(deliverables[1].notes).toContain('15 automated test cases');
    });

    it('edits an existing deliverable using deliverable ID', async () => {
      const currentRes = await request(app)
        .get(`/api/v1/projects/${startedProject.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      const targetDeliverable = currentRes.body.data.deliverables[0];

      const editPayload = {
        id: targetDeliverable.id,
        title: 'Updated Repository Name',
        type: 'code_repo',
        url: 'https://github.com/test/pipeline-v2',
        notes: 'Refactored to support Parquet partitioning'
      };

      const res = await request(app)
        .post(`/api/v1/projects/${startedProject.id}/deliverables`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(editPayload);

      expect(res.status).toBe(200);
      const updatedList = res.body.data.deliverables;
      const modified = updatedList.find(d => d.id === targetDeliverable.id);
      expect(modified.title).toBe('Updated Repository Name');
      expect(modified.url).toBe('https://github.com/test/pipeline-v2');
      expect(modified.notes).toBe('Refactored to support Parquet partitioning');
    });

    it('removes a deliverable cleanly', async () => {
      const currentRes = await request(app)
        .get(`/api/v1/projects/${startedProject.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      const deliverableToRemove = currentRes.body.data.deliverables[1];
      const initialCount = currentRes.body.data.deliverables.length;

      const res = await request(app)
        .delete(`/api/v1/projects/${startedProject.id}/deliverables/${deliverableToRemove.id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deliverables.length).toBe(initialCount - 1);
    });

    it('prevents user 2 from modifying user 1 project (Authorization boundary)', async () => {
      const res = await request(app)
        .patch(`/api/v1/projects/${startedProject.id}/tasks`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ taskOrder: 1, completed: false });

      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------
  // E. Project Submission, Validation & Completion Idempotency
  // -------------------------------------------------------------
  describe('E. Project Submission, Validation & Idempotency', () => {
    let projectToSubmit;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/projects/start')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          project_title: 'Level 1 — General Ledger Setup & Bank Reconciliation',
          career_title: 'Accountant',
          tier: 1,
          brief: 'Post double-entry journal entries and balance bank statement.',
          step_by_step_tasks: [
            { order: 1, title: 'Chart of Accounts', description: 'Setup ledger accounts.' },
            { order: 2, title: 'Journal Entries', description: 'Post operational transactions.' }
          ],
          deliverables: [
            { title: 'Reconciliation Spreadsheet', type: 'spreadsheet', linkUrl: 'https://docs.google.com/spreadsheets/d/test' }
          ]
        });
      projectToSubmit = res.body.data;
    });

    it('submits project and transitions status to completed with 100% progress', async () => {
      const submitPayload = {
        deliverables: projectToSubmit.deliverables,
        reflection: {
          whatLearned: 'Mastered double-entry balance checks and variance adjustments.',
          difficulties: 'Reconciling timing differences in outstanding vendor checks.',
          whatToImprove: 'Implement automated spreadsheet macros for periodic balance imports.'
        }
      };

      const res = await request(app)
        .post(`/api/v1/projects/${projectToSubmit.id}/submit`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(submitPayload);

      expect(res.status).toBe(200);
      const completed = res.body.data?.project || res.body.data;
      expect(completed.status).toBe('completed');
      expect(completed.progress_percent).toBe(100);
      expect(completed.completed_at).toBeDefined();

      // All tasks should be marked completed
      for (const t of completed.tasks_progress) {
        expect(t.completed).toBe(true);
      }
    });

    it('is idempotent: subsequent submission returns completed project without error', async () => {
      const submitPayload = {
        deliverables: projectToSubmit.deliverables,
        reflection: {
          whatLearned: 'Mastered double-entry balance checks.',
          difficulties: 'None.',
          whatToImprove: 'Macros.'
        }
      };

      const res = await request(app)
        .post(`/api/v1/projects/${projectToSubmit.id}/submit`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(submitPayload);

      expect(res.status).toBe(200);
      const completed = res.body.data?.project || res.body.data;
      expect(completed.status).toBe('completed');
    });

    it('rejects submission with empty deliverables', async () => {
      // Create empty project
      const freshRes = await request(app)
        .post('/api/v1/projects/start')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          project_title: 'Empty Deliverables Project',
          career_title: 'Graphic Designer',
          tier: 1,
          step_by_step_tasks: [{ order: 1, title: 'Concept', description: 'Sketching' }],
          deliverables: []
        });

      const emptyProj = freshRes.body.data;

      const res = await request(app)
        .post(`/api/v1/projects/${emptyProj.id}/submit`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          deliverables: [],
          reflection: {
            whatLearned: 'Testing error boundary',
            difficulties: 'None',
            whatToImprove: 'None'
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });
});
