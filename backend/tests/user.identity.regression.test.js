import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { pool } from '../src/config/database.js';
import { createApp } from '../src/app.js';

const app = createApp();

describe('User Identity & Full Name Canonical Persistence Regression Suite', () => {
  const user1Email = 'identity_test_user1@example.com';
  const user2Email = 'identity_test_user2@example.com';
  const legacyEmail = '7896789_legacy@gmail.com';
  const password = 'Password123!';

  let token1;
  let token2;
  let legacyToken;

  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email IN ($1, $2, $3)', [
      user1Email,
      user2Email,
      legacyEmail
    ]);

    // 1. Register User 1 with Full Name
    const reg1 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: user1Email,
        password,
        full_name: 'Mittal Halarnekar'
      });
    expect([200, 201]).toContain(reg1.status);
    expect(reg1.body.user.full_name).toBe('Mittal Halarnekar');
    token1 = reg1.body.accessToken;

    // 2. Register User 2 with another Full Name
    const reg2 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: user2Email,
        password,
        name: 'Rahul Naik'
      });
    expect([200, 201]).toContain(reg2.status);
    expect(reg2.body.user.full_name).toBe('Rahul Naik');
    token2 = reg2.body.accessToken;

    // 3. Register legacy user with NO name provided
    const regLegacy = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: legacyEmail,
        password
      });
    expect([200, 201]).toContain(regLegacy.status);
    expect(regLegacy.body.user.full_name).toBeNull();
    legacyToken = regLegacy.body.accessToken;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email IN ($1, $2, $3)', [
      user1Email,
      user2Email,
      legacyEmail
    ]);
  });

  it('1. Registration persists full_name to both users and user_profiles tables in PostgreSQL', async () => {
    const userRes = await pool.query('SELECT full_name FROM users WHERE email = $1', [user1Email]);
    expect(userRes.rows[0].full_name).toBe('Mittal Halarnekar');

    const profileRes = await pool.query(
      `SELECT up.full_name FROM user_profiles up
       JOIN users u ON u.id = up.user_id
       WHERE u.email = $1`,
      [user1Email]
    );
    expect(profileRes.rows[0].full_name).toBe('Mittal Halarnekar');
  });

  it('2. Login returns canonical full_name in the authentication response', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user1Email, password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.full_name).toBe('Mittal Halarnekar');
  });

  it('3. GET /api/v1/users/me returns authenticated user with full_name', async () => {
    const meRes = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token1}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.full_name).toBe('Mittal Halarnekar');
    expect(meRes.body.data.email).toBe(user1Email);
  });

  it('4. GET /api/v1/profiles/me returns authenticated profile with full_name', async () => {
    const profRes = await request(app)
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${token1}`);

    expect(profRes.status).toBe(200);
    expect(profRes.body.data.full_name).toBe('Mittal Halarnekar');
  });

  it('5. Legacy account with no stored name returns null, never email prefix', async () => {
    const meRes = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${legacyToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.full_name).toBeNull();
    // Verify it is strictly not "7896789"
    expect(meRes.body.data.full_name).not.toBe('7896789');

    const profRes = await request(app)
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${legacyToken}`);

    expect(profRes.status).toBe(200);
    expect(profRes.body.data.full_name).toBeNull();
    expect(profRes.body.data.full_name).not.toBe('7896789');
  });

  it('6. Legacy account can save a genuine name via PUT /api/v1/profiles/me', async () => {
    const updateRes = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${legacyToken}`)
      .send({
        full_name: 'Goa Explorer'
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.full_name).toBe('Goa Explorer');

    // Verify GET /users/me now returns the updated name
    const meRes = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${legacyToken}`);
    expect(meRes.body.data.full_name).toBe('Goa Explorer');
  });

  it('7. PUT /api/v1/profiles/me preserves existing name when updating unrelated profile fields', async () => {
    const updateRes = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        interests: ['Artificial Intelligence', 'Robotics'],
        preferred_locations: ['Goa', 'Remote']
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.full_name).toBe('Mittal Halarnekar');
    expect(updateRes.body.data.interests).toEqual(['Artificial Intelligence', 'Robotics']);

    // Check directly in database
    const dbCheck = await pool.query('SELECT full_name FROM users WHERE email = $1', [user1Email]);
    expect(dbCheck.rows[0].full_name).toBe('Mittal Halarnekar');
  });

  it('8. Account isolation: User 1 and User 2 maintain separate identities and cannot cross-mutate', async () => {
    const u1Me = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token1}`);
    const u2Me = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token2}`);

    expect(u1Me.body.data.full_name).toBe('Mittal Halarnekar');
    expect(u2Me.body.data.full_name).toBe('Rahul Naik');
    expect(u1Me.body.data.id).not.toBe(u2Me.body.data.id);
  });

  it('9. Unauthenticated requests to /users/me and /profiles/me are rejected with 401', async () => {
    const unauth1 = await request(app).get('/api/v1/users/me');
    expect(unauth1.status).toBe(401);

    const unauth2 = await request(app).get('/api/v1/profiles/me');
    expect(unauth2.status).toBe(401);
  });
});
