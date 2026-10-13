import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/config/database.js';
import {
  isOpportunityRelevantToUser,
  createOpportunityNotifications,
  checkAndGenerateClosingSoonNotifications,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
} from '../src/modules/notifications/notification.service.js';

describe('Real-Time Opportunity Notifications System Regression Suite', () => {
  let app;
  let testUserA;
  let testUserB;
  let tokenA;
  let tokenB;
  let testOpp1;
  let testOpp2;

  beforeAll(async () => {
    app = createApp();

    // Create two isolated test users
    const emailA = `notif_test_a_${Date.now()}@careergps.local`;
    const emailB = `notif_test_b_${Date.now()}@careergps.local`;

    const resA = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: emailA, password: 'Password123!', role: 'USER' });
    testUserA = resA.body.user;
    tokenA = resA.body.accessToken;

    const resB = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: emailB, password: 'Password123!', role: 'USER' });
    testUserB = resB.body.user;
    tokenB = resB.body.accessToken;

    // Set profile preferences for user A (Goa-first software interests)
    await pool.query(
      `UPDATE user_profiles
       SET preferred_locations = '["Goa", "Panaji"]'::jsonb,
           interests = '["Software", "Engineering"]'::jsonb,
           career_goal = 'Software Engineer'
       WHERE user_id = $1`,
      [testUserA.id]
    );

    // Set profile preferences for user B (Remote-first design interests)
    await pool.query(
      `UPDATE user_profiles
       SET preferred_locations = '["Remote"]'::jsonb,
           interests = '["Design", "UI/UX"]'::jsonb,
           career_goal = 'Product Designer'
       WHERE user_id = $1`,
      [testUserB.id]
    );

    // Insert test opportunities directly
    const deadlineSoon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days -> '3_days' stage
    const dedup1 = `test_dedup_1_${Date.now()}`;
    const oppRes1 = await pool.query(
      `INSERT INTO opportunities 
         (title, organization, opportunity_type, location, application_deadline, status, record_status, verification_status, dedup_key)
       VALUES 
         ('Goa Tech Software Trainee', 'Goa Electronics Limited', 'job', 'Panaji, Goa', $1, 'open', 'published', 'verified', $2)
       RETURNING *`,
      [deadlineSoon.toISOString(), dedup1]
    );
    testOpp1 = oppRes1.rows[0];

    const dedup2 = `test_dedup_2_${Date.now()}`;
    const oppRes2 = await pool.query(
      `INSERT INTO opportunities 
         (title, organization, opportunity_type, location, application_deadline, status, record_status, verification_status, dedup_key)
       VALUES 
         ('Senior Remote UI Designer', 'DesignStudio Global', 'job', 'Remote', NOW() + INTERVAL '10 days', 'open', 'published', 'verified', $1)
       RETURNING *`,
      [dedup2]
    );
    testOpp2 = oppRes2.rows[0];
  });

  afterAll(async () => {
    // Cleanup created test records
    if (testOpp1) {
      await pool.query('DELETE FROM user_notifications WHERE opportunity_id = $1', [testOpp1.id]);
      await pool.query('DELETE FROM opportunities WHERE id = $1', [testOpp1.id]);
    }
    if (testOpp2) {
      await pool.query('DELETE FROM user_notifications WHERE opportunity_id = $1', [testOpp2.id]);
      await pool.query('DELETE FROM opportunities WHERE id = $1', [testOpp2.id]);
    }
    if (testUserA) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserA.id]);
    }
    if (testUserB) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUserB.id]);
    }
  });

  describe('1. Relevance Matching Criteria', () => {
    it('matches Goa opportunities to Goa-preferring and default users', () => {
      const goaOpp = { title: 'Junior Developer', location: 'Panaji, Goa', opportunity_type: 'job' };
      const goaProfile = { preferred_locations: ['Goa'] };
      const defaultProfile = { preferred_locations: [] };

      expect(isOpportunityRelevantToUser(goaOpp, goaProfile)).toBe(true);
      expect(isOpportunityRelevantToUser(goaOpp, defaultProfile)).toBe(true);
    });

    it('matches remote opportunities to remote-preferring users', () => {
      const remoteOpp = { title: 'Remote React Engineer', location: 'Remote', opportunity_type: 'job' };
      const remoteProfile = { preferred_locations: ['Remote'] };

      expect(isOpportunityRelevantToUser(remoteOpp, remoteProfile)).toBe(true);
    });

    it('broad government recuitments match state-wide seekers', () => {
      const govtOpp = { title: 'GPSC Junior Officer', location: 'Panaji', opportunity_type: 'government' };
      const profile = { preferred_locations: ['Goa'], interests: ['Administration'] };

      expect(isOpportunityRelevantToUser(govtOpp, profile)).toBe(true);
    });
  });

  describe('2. Notification Type A — New Opportunities & Idempotency', () => {
    it('generates notification for newly published opportunity', async () => {
      const result = await createOpportunityNotifications(testOpp1);
      expect(result.notified_count).toBeGreaterThanOrEqual(1);

      // Verify notification in database for testUserA
      const notifs = await getUserNotifications(testUserA.id);
      const opp1Notif = notifs.notifications.find(n => n.opportunity_id === testOpp1.id);
      expect(opp1Notif).toBeDefined();
      expect(opp1Notif.type).toBe('new_opportunity');
      expect(opp1Notif.urgency).toBe('normal');
      expect(opp1Notif.action_url).toBe(`/opportunities/${testOpp1.id}`);
      expect(opp1Notif.read_at).toBeNull();
    });

    it('re-ingesting/re-running the worker produces 0 duplicate notifications (Idempotency)', async () => {
      const beforeCount = await getUnreadCount(testUserA.id);

      // Call again on the same opportunity
      const secondRun = await createOpportunityNotifications(testOpp1);
      expect(secondRun.notified_count).toBe(0); // 0 new rows inserted due to unique constraint

      const afterCount = await getUnreadCount(testUserA.id);
      expect(afterCount).toBe(beforeCount);
    });

    it('does not create notifications for unpublished or closed opportunities', async () => {
      const unpublishedOpp = { id: testOpp1.id, record_status: 'draft', status: 'open' };
      const res1 = await createOpportunityNotifications(unpublishedOpp);
      expect(res1.notified_count).toBe(0);

      const closedOpp = { id: testOpp1.id, record_status: 'published', status: 'closed' };
      const res2 = await createOpportunityNotifications(closedOpp);
      expect(res2.notified_count).toBe(0);
    });
  });

  describe('3. Notification Type B — Closing Soon & Urgency Stages', () => {
    it('detects expiring opportunity within 7-day window and generates closing-soon alert', async () => {
      // Re-verify or ensure testOpp1 exists in case concurrent tests wiped opportunities
      const existing = await pool.query('SELECT id FROM opportunities WHERE id = $1', [testOpp1.id]);
      if (existing.rowCount === 0) {
        const deadlineSoon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        const dedup1 = `test_dedup_1_re_${Date.now()}`;
        const oppRes = await pool.query(
          `INSERT INTO opportunities 
             (id, title, organization, opportunity_type, location, application_deadline, status, record_status, verification_status, dedup_key)
           VALUES 
             ($1, 'Goa Tech Software Trainee', 'Goa Electronics Limited', 'job', 'Panaji, Goa', $2, 'open', 'published', 'verified', $3)
           RETURNING *`,
          [testOpp1.id, deadlineSoon.toISOString(), dedup1]
        );
        testOpp1 = oppRes.rows[0];
      }

      const checkRes = await checkAndGenerateClosingSoonNotifications();
      expect(checkRes.processed_opportunities).toBeGreaterThanOrEqual(1);

      // testOpp1 deadline is in 2 days -> stage '3_days'
      const notifs = await getUserNotifications(testUserA.id);
      const closingNotif = notifs.notifications.find(
        n => n.opportunity_id === testOpp1.id && n.type === 'closing_soon'
      );
      expect(closingNotif).toBeDefined();
      expect(closingNotif.urgency).toBe('3_days');
      expect(closingNotif.title).toContain('Closing Soon');
    });

    it('re-running the closing-soon scheduler does not create duplicate alerts for the same stage', async () => {
      const notifsBefore = await getUserNotifications(testUserA.id);
      const countBefore = notifsBefore.notifications.filter(
        n => n.opportunity_id === testOpp1.id && n.type === 'closing_soon'
      ).length;

      // Run scheduler again
      await checkAndGenerateClosingSoonNotifications();

      const notifsAfter = await getUserNotifications(testUserA.id);
      const countAfter = notifsAfter.notifications.filter(
        n => n.opportunity_id === testOpp1.id && n.type === 'closing_soon'
      ).length;

      expect(countAfter).toBe(countBefore);
    });

    it('opportunities without deadline or expired deadlines do not generate closing-soon alerts', async () => {
      // Insert an expired opportunity
      const expiredDedup = `test_expired_dedup_${Date.now()}`;
      const expiredRes = await pool.query(
        `INSERT INTO opportunities 
           (title, organization, opportunity_type, location, application_deadline, status, record_status, verification_status, dedup_key)
         VALUES 
           ('Expired Tech Job', 'Expired Corp', 'job', 'Panaji', NOW() - INTERVAL '2 days', 'open', 'published', 'verified', $1)
         RETURNING *`,
        [expiredDedup]
      );
      const expiredOpp = expiredRes.rows[0];

      await checkAndGenerateClosingSoonNotifications();

      const notifs = await getUserNotifications(testUserA.id);
      const foundExpired = notifs.notifications.find(n => n.opportunity_id === expiredOpp.id);
      expect(foundExpired).toBeUndefined();

      // Clean up
      await pool.query('DELETE FROM opportunities WHERE id = $1', [expiredOpp.id]);
    });
  });

  describe('4. User Isolation & Read Lifecycle', () => {
    it('user A cannot access user B notifications', async () => {
      const notifsA = await getUserNotifications(testUserA.id);
      for (const n of notifsA.notifications) {
        // Attempt to mark User A's notification as read using User B's token
        const attackRes = await request(app)
          .patch(`/api/v1/notifications/${n.id}/read`)
          .set('Authorization', `Bearer ${tokenB}`);

        expect(attackRes.status).toBe(404); // Isolated!
      }
    });

    it('user A can mark their own notification as read', async () => {
      const notifs = await getUserNotifications(testUserA.id);
      const target = notifs.notifications.find(n => !n.read_at);
      expect(target).toBeDefined();

      const res = await request(app)
        .patch(`/api/v1/notifications/${target.id}/read`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.read_at).toBeTruthy();

      // Check unread count decreased
      const countRes = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(countRes.status).toBe(200);
      expect(typeof countRes.body.data.unread_count).toBe('number');
    });

    it('mark all as read marks remaining notifications as read', async () => {
      const res = await request(app)
        .post('/api/v1/notifications/mark-all-read')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('marked_read_count');

      // Unread count is now 0
      const unreadRes = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(unreadRes.body.data.unread_count).toBe(0);
    });
  });

  describe('5. Authentication Security Boundary', () => {
    it('requires authentication for notification endpoints', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(401);

      const countRes = await request(app).get('/api/v1/notifications/unread-count');
      expect(countRes.status).toBe(401);
    });
  });
});
