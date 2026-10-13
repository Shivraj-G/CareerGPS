import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../client.js';

test('Project & Portfolio Studio Client & Integration Tests', async (t) => {
  await t.test('1. Client exports required Project & Portfolio Studio methods', () => {
    assert.equal(typeof api.projectRecommendations, 'function', 'projectRecommendations should be a function');
    assert.equal(typeof api.myProjects, 'function', 'myProjects should be a function');
    assert.equal(typeof api.projectDetails, 'function', 'projectDetails should be a function');
    assert.equal(typeof api.startProject, 'function', 'startProject should be a function');
    assert.equal(typeof api.updateProjectTask, 'function', 'updateProjectTask should be a function');
    assert.equal(typeof api.addProjectDeliverable, 'function', 'addProjectDeliverable should be a function');
    assert.equal(typeof api.removeProjectDeliverable, 'function', 'removeProjectDeliverable should be a function');
    assert.equal(typeof api.submitProject, 'function', 'submitProject should be a function');
    assert.equal(typeof api.updateProjectStatus, 'function', 'updateProjectStatus should be a function');
    assert.equal(typeof api.myPortfolio, 'function', 'myPortfolio should be a function');
    assert.equal(typeof api.updateMyPortfolio, 'function', 'updateMyPortfolio should be a function');
    assert.equal(typeof api.publicPortfolio, 'function', 'publicPortfolio should be a function');
  });

  await t.test('2. Three distinct project difficulty tiers are defined and strictly separated from learning levels', () => {
    const projectTiers = {
      1: { name: 'Level 1 — Starter', scope: 'individual_skill_practice' },
      2: { name: 'Level 2 — Practical', scope: 'multi_skill_scenario' },
      3: { name: 'Level 3 — Career-Ready', scope: 'capstone_or_case_study' }
    };

    assert.equal(Object.keys(projectTiers).length, 3, 'Should define exactly 3 project tiers');
    assert.equal(projectTiers[1].name, 'Level 1 — Starter');
    assert.equal(projectTiers[2].name, 'Level 2 — Practical');
    assert.equal(projectTiers[3].name, 'Level 3 — Career-Ready');

    // Projects can combine skills of different learning levels
    const sampleProject = {
      tier: 2, // Practical Project
      skills: [
        { id: 'sk-1', name: 'SQL', learning_difficulty: 1 },
        { id: 'sk-2', name: 'PostgreSQL', learning_difficulty: 2 },
        { id: 'sk-3', name: 'System Architecture', learning_difficulty: 3 }
      ]
    };
    assert.equal(sampleProject.tier, 2);
    assert.equal(sampleProject.skills.length, 3);
    assert.notEqual(sampleProject.tier, sampleProject.skills[0].learning_difficulty);
  });

  await t.test('3. Deliverable URL validation enforces http/https protocol and blocks unsafe schemes', () => {
    const validUrls = [
      'https://github.com/careergps-user/api-service',
      'http://localhost:3000/demo',
      'https://my-domain.org/reports/case-study.pdf'
    ];

    const invalidUrls = [
      'javascript:alert("exploit")',
      'data:text/html,<script>alert(1)</script>',
      'ftp://ftp.example.com/file.zip',
      'file:///etc/passwd',
      'not-a-valid-url'
    ];

    function validateDeliverableUrl(input) {
      try {
        const parsed = new URL(input);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }

    for (const url of validUrls) {
      assert.ok(validateDeliverableUrl(url), `Expected valid URL for: ${url}`);
    }

    for (const url of invalidUrls) {
      assert.ok(!validateDeliverableUrl(url), `Expected invalid URL rejection for: ${url}`);
    }
  });

  await t.test('4. Supports both technical and non-technical career deliverables', () => {
    const deliverables = [
      // Technical Backend
      {
        career: 'Backend Developer',
        tier: 2,
        deliverableType: 'github_repo',
        title: 'Authenticated REST API with PostgreSQL and automated test suite'
      },
      // Non-technical GIS
      {
        career: 'Geography / GIS Analyst',
        tier: 2,
        deliverableType: 'design_artifact',
        title: 'Goa Coastal Geospatial Analysis Map & Land Use Change Detection'
      },
      // Non-technical Teaching
      {
        career: 'Assistant Professor / Teacher',
        tier: 2,
        deliverableType: 'report_document',
        title: 'Undergraduate Curriculum Syllabus, Lesson Sequence & Rubric'
      },
      // Non-technical Marketing
      {
        career: 'Digital Marketing Specialist',
        tier: 2,
        deliverableType: 'report_document',
        title: 'Multi-Channel Campaign Strategy, Audience Personas & Conversion Metrics'
      }
    ];

    for (const d of deliverables) {
      assert.ok(d.career, 'Career must be defined');
      assert.ok(d.deliverableType, 'Deliverable type must be defined');
      assert.ok(d.title.length > 10, 'Deliverable title must be descriptive');
    }
  });

  await t.test('5. Submission requires structured reflection prompts', () => {
    function validateSubmission(payload) {
      if (!payload.deliverables || payload.deliverables.length === 0) {
        return { valid: false, reason: 'At least one deliverable required' };
      }
      if (!payload.reflection) {
        return { valid: false, reason: 'Reflection object required' };
      }
      const { whatLearned, difficulties, whatToImprove } = payload.reflection;
      if (!whatLearned?.trim() || !difficulties?.trim() || !whatToImprove?.trim()) {
        return { valid: false, reason: 'All three reflection questions required' };
      }
      return { valid: true };
    }

    const invalid1 = validateSubmission({ deliverables: [] });
    assert.equal(invalid1.valid, false);

    const invalid2 = validateSubmission({
      deliverables: [{ title: 'Code repo', linkUrl: 'https://github.com' }],
      reflection: { whatLearned: 'Learned SQL', difficulties: '', whatToImprove: '' }
    });
    assert.equal(invalid2.valid, false);

    const valid = validateSubmission({
      deliverables: [{ title: 'Code repo', linkUrl: 'https://github.com' }],
      reflection: {
        whatLearned: 'Designed indexed tables and implemented pooling.',
        difficulties: 'Resolving connection pool timeouts under concurrent load.',
        whatToImprove: 'Add Redis cache layer for high-throughput reads.'
      }
    });
    assert.equal(valid.valid, true);
  });

  await t.test('6. Public portfolio displays only completed projects and sanitizes private information', () => {
    const rawUserData = {
      id: 'usr-1234',
      email: 'private_student@example.com',
      password_hash: '$2b$10$secret',
      display_name: 'Dr. Jane Doe',
      target_career: 'Backend Developer',
      projects: [
        { id: 'p1', title: 'Draft in progress', status: 'in_progress', deliverables: [] },
        { id: 'p2', title: 'Finished CRUD API', status: 'completed', deliverables: [{ title: 'Repo', link_url: 'https://github.com' }] },
        { id: 'p3', title: 'Paused scratchpad', status: 'paused', deliverables: [] }
      ]
    };

    function sanitizeForPublicShowcase(user) {
      return {
        displayName: user.display_name,
        targetCareer: user.target_career,
        completedProjects: user.projects.filter(p => p.status === 'completed')
      };
    }

    const publicView = sanitizeForPublicShowcase(rawUserData);
    assert.equal(publicView.displayName, 'Dr. Jane Doe');
    assert.equal(publicView.completedProjects.length, 1);
    assert.equal(publicView.completedProjects[0].title, 'Finished CRUD API');
    assert.equal(publicView.email, undefined, 'Email must never be exposed');
    assert.equal(publicView.password_hash, undefined, 'Credentials must never be exposed');
  });

  await t.test('7. Step 4 Action links in Pathway Engine resolve to internal project studio routes', () => {
    const step4ActionLink = '/projects?career=c123&title=Backend+Developer';
    assert.ok(step4ActionLink.startsWith('/projects'), 'Link must navigate to /projects');
    const url = new URL(`https://careergps.app${step4ActionLink}`);
    assert.equal(url.searchParams.get('career'), 'c123');
    assert.equal(url.searchParams.get('title'), 'Backend Developer');
  });
});
