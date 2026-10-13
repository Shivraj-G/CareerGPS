import request from 'supertest';
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { pool } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import bcrypt from 'bcryptjs';

const app = createApp();

describe('Auth Endpoints', () => {
  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['testauth%@example.com']);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['testauth%@example.com']);
  });

  it('returns UNKNOWN_EMAIL for unregistered email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'testauth_unregistered@example.com', password: 'password123' });
    
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNKNOWN_EMAIL');
  });

  it('returns INVALID_PASSWORD for registered email but wrong password', async () => {
    // register user first
    const email = 'testauth_registered@example.com';
    const password = 'Password123!';
    await request(app).post('/api/v1/auth/register').send({ email, password });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword123!' });
    
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_PASSWORD');
  });

  it('successfully logs in with correct credentials', async () => {
    const email = 'testauth_success@example.com';
    const password = 'Password123!';
    await request(app).post('/api/v1/auth/register').send({ email, password });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });
  
  it('returns 400 for malformed email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'password123' });
    
    expect(res.status).toBe(400);
  });

  describe('Registration Password Length Validation', () => {
    it('returns 400 for empty password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ email: 'testauth_pass_0@example.com', password: '' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for 5-character password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ email: 'testauth_pass_5@example.com', password: '12345' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for 7-character password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ email: 'testauth_pass_7@example.com', password: '1234567' });
      expect(res.status).toBe(400);
    });

    it('successfully registers with exactly 8-character password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ email: 'testauth_pass_8@example.com', password: '12345678' });
      expect(res.status).toBe(201);
    });

    it('successfully registers with longer valid password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ email: 'testauth_pass_long@example.com', password: 'superlongpassword123!' });
      expect(res.status).toBe(201);
    });
  });

  describe('Registration Email Validation', () => {
    it('successfully registers a new email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'testauth_new_email@example.com', password: 'password123' });
      expect(res.status).toBe(201);
    });

    it('returns EMAIL_ALREADY_EXISTS for an already-registered email', async () => {
      const email = 'testauth_duplicate@example.com';
      const password = 'password123';
      
      // First registration
      await request(app).post('/api/v1/auth/register').send({ email, password });
      
      // Second registration with exact same email
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password });
        
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('returns EMAIL_ALREADY_EXISTS for case variations of a registered email', async () => {
      // First registration with lowercase
      await request(app).post('/api/v1/auth/register').send({ email: 'testauth_case@example.com', password: 'password123' });
      
      // Second registration with uppercase
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'TESTAUTH_CASE@example.com', password: 'password123' });
        
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('returns 400 for malformed email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'password123' });
        
      expect(res.status).toBe(400);
    });
  });
});
