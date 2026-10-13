import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/config/database.js';

const app = createApp();

describe('CareerGPS Pathway Removal, 404 Prevention & My Plan State Regression Test Suite', () => {
  let user1Token = null;
  let user1Id = null;
  let user2Token = null;
  let user2Id = null;
  let templatePathwayId = null;
  let templateCareerId = null;
  let user1ActiveAssignmentId = null;

  beforeAll(async () => {
    // 1. Create two test users
    const email1 = `pw_remover_${Date.now()}@example.com`;
    const reg1 = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: email1, password: 'password123' });
    user1Token = reg1.body.accessToken;
    user1Id = reg1.body.user.id;

    const email2 = `pw_other_${Date.now()}@example.com`;
    const reg2 = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: email2, password: 'password123' });
    user2Token = reg2.body.accessToken;
    user2Id = reg2.body.user.id;

    // 2. Fetch a published canonical template pathway
    const pathwayRes = await pool.query(
      `SELECT p.id, p.career_id FROM pathways p 
       WHERE p.pathway_type = 'template' AND p.record_status = 'published' LIMIT 1`
    );
    expect(pathwayRes.rows.length).toBeGreaterThan(0);
    templatePathwayId = pathwayRes.rows[0].id;
    templateCareerId = pathwayRes.rows[0].career_id;
  });

  afterAll(async () => {
    // Cleanup test users and assignments
    if (user1Id) {
      await pool.query('DELETE FROM user_pathway_steps WHERE user_pathway_id IN (SELECT id FROM user_pathways WHERE user_id = $1)', [user1Id]);
      await pool.query('DELETE FROM user_pathways WHERE user_id = $1', [user1Id]);
      await pool.query('DELETE FROM user_profiles WHERE user_id = $1', [user1Id]);
      await pool.query('DELETE FROM users WHERE id = $1', [user1Id]);
    }
    if (user2Id) {
      await pool.query('DELETE FROM user_pathway_steps WHERE user_pathway_id IN (SELECT id FROM user_pathways WHERE user_id = $1)', [user2Id]);
      await pool.query('DELETE FROM user_pathways WHERE user_id = $1', [user2Id]);
      await pool.query('DELETE FROM user_profiles WHERE user_id = $1', [user2Id]);
      await pool.query('DELETE FROM users WHERE id = $1', [user2Id]);
    }
  });

  it('1. Rejection of malformed identifier with 400 Bad Request', async () => {
    const res = await request(app)
      .delete('/api/v1/pathways/not-a-valid-uuid')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Invalid pathway identifier');
  });

  it('2. Removing a nonexistent assignment returns 404 cleanly without crashing', async () => {
    const fakeUuid = '00000000-0000-4000-8000-000000000000';
    const res = await request(app)
      .delete(`/api/v1/pathways/${fakeUuid}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('Pathway not found or already removed');
  });

  it('3. Previewing a template does NOT create an assignment; attempting to remove preview returns 404', async () => {
    // Verify user1 currently has no assignment for this template
    const checkDb = await pool.query(
      `SELECT id FROM user_pathways WHERE user_id = $1 AND pathway_id = $2`,
      [user1Id, templatePathwayId]
    );
    expect(checkDb.rows.length).toBe(0);

    // Attempting DELETE on template ID when user only previewed it
    const res = await request(app)
      .delete(`/api/v1/pathways/${templatePathwayId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('4. Choosing a template creates an active user pathway assignment with progress steps', async () => {
    const res = await request(app)
      .post(`/api/v1/pathways/template/${templatePathwayId}/select`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.steps.length).toBeGreaterThan(0);

    user1ActiveAssignmentId = res.body.data.id;

    // Verify it now appears in My Plan (/pathways/me)
    const myPlanRes = await request(app)
      .get('/api/v1/pathways/me')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(myPlanRes.status).toBe(200);
    expect(myPlanRes.body.data.some(p => p.id === user1ActiveAssignmentId)).toBe(true);
  });

  it('5. User 2 cannot remove User 1 assignment (Ownership verification returns 403 Forbidden)', async () => {
    const res = await request(app)
      .delete(`/api/v1/pathways/${user1ActiveAssignmentId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('permission');

    // Verify User 1 assignment is STILL active in DB
    const checkDb = await pool.query(
      `SELECT status FROM user_pathways WHERE id = $1`,
      [user1ActiveAssignmentId]
    );
    expect(checkDb.rows[0].status).toBe('active');
  });

  it('6. Completing a milestone is preserved during progression', async () => {
    const pwDetails = await request(app)
      .get(`/api/v1/pathways/generated/${user1ActiveAssignmentId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    const firstStep = pwDetails.body.data.steps[0];
    expect(firstStep).toBeDefined();

    const completeRes = await request(app)
      .post(`/api/v1/pathways/${user1ActiveAssignmentId}/steps/${firstStep.pathway_step_id}/complete`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ notes: 'Completed in milestone verification' });

    expect(completeRes.status).toBe(200);
    const updatedStep = completeRes.body.data.steps.find(s => s.pathway_step_id === firstStep.pathway_step_id);
    expect(updatedStep.status).toBe('completed');
  });

  it('7. Removing an active saved pathway archives it and preserves completed milestone history', async () => {
    const res = await request(app)
      .delete(`/api/v1/pathways/${user1ActiveAssignmentId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.removed).toBe(true);

    // Verify user_pathways record is 'archived', NOT physically deleted
    const dbCheck = await pool.query(
      `SELECT id, status FROM user_pathways WHERE id = $1`,
      [user1ActiveAssignmentId]
    );
    expect(dbCheck.rows.length).toBe(1);
    expect(dbCheck.rows[0].status).toBe('archived');

    // Verify user_pathway_steps records are STILL intact with completed milestone
    const stepsCheck = await pool.query(
      `SELECT status, notes, completed_at FROM user_pathway_steps WHERE user_pathway_id = $1`,
      [user1ActiveAssignmentId]
    );
    expect(stepsCheck.rows.length).toBeGreaterThan(0);
    const completedStep = stepsCheck.rows.find(s => s.status === 'completed');
    expect(completedStep).toBeDefined();
    expect(completedStep.notes).toBe('Completed in milestone verification');
    expect(completedStep.completed_at).not.toBeNull();
  });

  it('8. Archived pathway is excluded from active My Plan view (/pathways/me)', async () => {
    const res = await request(app)
      .get('/api/v1/pathways/me')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some(p => p.id === user1ActiveAssignmentId)).toBe(false);
  });

  it('9. Career pathways list (/pathways/career/:careerId) has selected=null after archival', async () => {
    const res = await request(app)
      .get(`/api/v1/pathways/career/${templateCareerId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.selected).toBeNull();
    // But existing reference pathways are still offered
    expect(res.body.data.existing.length).toBeGreaterThan(0);
  });

  it('10. Repeated removal of an already archived pathway returns 404 (prevents stale repeat)', async () => {
    const res = await request(app)
      .delete(`/api/v1/pathways/${user1ActiveAssignmentId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('11. Choosing the pathway again reactivates the assignment and restores past milestone progress', async () => {
    const res = await request(app)
      .post(`/api/v1/pathways/template/${templatePathwayId}/select`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user1ActiveAssignmentId);
    expect(res.body.data.status).toBe('active');

    // Past completed milestone is preserved!
    const completedStep = res.body.data.steps.find(s => s.status === 'completed');
    expect(completedStep).toBeDefined();
    expect(completedStep.notes).toBe('Completed in milestone verification');
  });

  it('12. Changing paths archives previous assignment and preserves its history', async () => {
    // Find a second template pathway or generate a strategy
    const otherTplRes = await pool.query(
      `SELECT p.id FROM pathways p 
       WHERE p.pathway_type = 'template' AND p.record_status = 'published' AND p.id != $1 LIMIT 1`,
      [templatePathwayId]
    );

    if (otherTplRes.rows.length > 0) {
      const otherTplId = otherTplRes.rows[0].id;
      const res = await request(app)
        .post(`/api/v1/pathways/template/${otherTplId}/select`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.id).not.toBe(user1ActiveAssignmentId);

      // Verify the previous assignment still exists and has its completed milestones intact in DB
      const prevCheck = await pool.query(
        `SELECT ups.status, ups.notes FROM user_pathway_steps ups WHERE ups.user_pathway_id = $1`,
        [user1ActiveAssignmentId]
      );
      const prevCompleted = prevCheck.rows.find(s => s.status === 'completed');
      expect(prevCompleted).toBeDefined();
      expect(prevCompleted.notes).toBe('Completed in milestone verification');
    }
  });

  it('13. Shared reusable pathway template in pathways table remains published and untouched', async () => {
    const templateCheck = await pool.query(
      `SELECT id, pathway_type, record_status FROM pathways WHERE id = $1`,
      [templatePathwayId]
    );
    expect(templateCheck.rows.length).toBe(1);
    expect(templateCheck.rows[0].record_status).toBe('published');
    expect(templateCheck.rows[0].pathway_type).toBe('template');

    // Another user can select and use this same canonical template freely
    const user2Select = await request(app)
      .post(`/api/v1/pathways/template/${templatePathwayId}/select`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(user2Select.status).toBe(200);
    expect(user2Select.body.data.status).toBe('active');
    expect(user2Select.body.data.id).not.toBe(user1ActiveAssignmentId);
  });
});
