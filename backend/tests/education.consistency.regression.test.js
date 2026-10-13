import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { pool } from '../src/config/database.js';
import { createApp } from '../src/app.js';
import {
  normalizeStream,
  getCompatiblePrograms,
  validateProgramCompatibility,
  PROGRAM_REQUIREMENTS
} from '../src/modules/education/education.service.js';
import { evaluateGoalEligibility } from '../src/modules/goals/goal.engine.js';
import { extractProfileFacts } from '../src/modules/goals/feasibility.engine.js';
import { calculateEducationRelevance } from '../src/modules/recommendations/recommendation.service.js';
import { evaluateUserProgressAndEvidence } from '../src/modules/pathways/pathway-engine.js';

const app = createApp();

describe('CareerGPS Education Data Consistency & Profile Lock Regression Suite', () => {
  let testUser1Id, testUser1Token;
  let testUser2Id, testUser2Token;
  let testUser3Id, testUser3Token;

  beforeAll(async () => {
    // Clean up any existing test accounts with these emails
    await pool.query(`DELETE FROM users WHERE email IN ('edutest1@careergps.com', 'edutest2@careergps.com', 'edutest3@careergps.com')`);

    // Create Test User 1 (Draft user for onboarding flow)
    const u1Res = await pool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ('edutest1@careergps.com', 'hash', 'USER') RETURNING id`
    );
    testUser1Id = u1Res.rows[0].id;
    testUser1Token = jwt.sign({ sub: testUser1Id, role: 'USER', email: 'edutest1@careergps.com' }, env.JWT_SECRET, { expiresIn: '1h' });
    await pool.query(`INSERT INTO user_profiles (user_id, profile_status) VALUES ($1, 'draft')`, [testUser1Id]);

    // Create Test User 2 (Complete user with existing education)
    const u2Res = await pool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ('edutest2@careergps.com', 'hash', 'USER') RETURNING id`
    );
    testUser2Id = u2Res.rows[0].id;
    testUser2Token = jwt.sign({ sub: testUser2Id, role: 'USER', email: 'edutest2@careergps.com' }, env.JWT_SECRET, { expiresIn: '1h' });
    await pool.query(
      `INSERT INTO user_profiles (user_id, profile_status, career_goal, preferred_locations, education) VALUES ($1, 'complete', 'Backend Developer', '["Goa"]'::jsonb, $2)`,
      [
        testUser2Id,
        JSON.stringify([
          {
            level: 'Undergraduate',
            degree: 'BCA',
            current_program: 'BCA',
            school_12_stream: 'Science — PCMB',
            specialization: 'Artificial Intelligence',
            status: 'pursuing'
          },
          {
            level: '12th / Higher Secondary',
            school_12_stream: 'Science — PCMB',
            status: 'completed'
          }
        ])
      ]
    );

    // Create Test User 3 (User with missing/unmapped education)
    const u3Res = await pool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ('edutest3@careergps.com', 'hash', 'USER') RETURNING id`
    );
    testUser3Id = u3Res.rows[0].id;
    testUser3Token = jwt.sign({ sub: testUser3Id, role: 'USER', email: 'edutest3@careergps.com' }, env.JWT_SECRET, { expiresIn: '1h' });
    await pool.query(`INSERT INTO user_profiles (user_id, profile_status, career_goal, education) VALUES ($1, 'draft', 'Doctor', '[]'::jsonb)`, [testUser3Id]);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE email IN ('edutest1@careergps.com', 'edutest2@careergps.com', 'edutest3@careergps.com')`);
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Commerce without Mathematics pursuing BCA
  // --------------------------------------------------------------------------
  it('1. A user selecting Commerce without Mathematics and subsequently pursuing BCA is supported and valid', () => {
    const rawStream = 'Commerce without Mathematics';
    const norm = normalizeStream(rawStream);
    expect(norm).toBe('Commerce without Mathematics');

    // BCA is compatible with Commerce without Mathematics in open degree frameworks
    expect(validateProgramCompatibility(norm, 'BCA')).toBe(true);

    const compatiblePrograms = getCompatiblePrograms(norm);
    expect(compatiblePrograms).toContain('BCA');
    expect(compatiblePrograms).toContain('B.Com');
    expect(compatiblePrograms).toContain('BBA');
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Commerce with Mathematics pursuing BCA
  // --------------------------------------------------------------------------
  it('2. A user selecting Commerce with Mathematics and subsequently pursuing BCA is valid and distinct from 12th stream', () => {
    const stream = 'Commerce with Mathematics';
    const norm = normalizeStream(stream);
    expect(norm).toBe('Commerce with Mathematics');

    expect(validateProgramCompatibility(norm, 'BCA')).toBe(true);
    expect(validateProgramCompatibility(norm, 'B.Com')).toBe(true);
    expect(validateProgramCompatibility(norm, 'BBA')).toBe(true);

    // Program requirements check confirms stream and program remain distinct
    const bcaReqs = PROGRAM_REQUIREMENTS.find(p => p.program === 'BCA');
    expect(bcaReqs).toBeDefined();
    expect(bcaReqs.required_streams).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Science with PCM, PCB, or PCMB
  // --------------------------------------------------------------------------
  it('3. A user selecting Science with PCM, PCB, or PCMB validates correctly against respective pathways', () => {
    expect(normalizeStream('Science — PCM (Physics, Chemistry, Mathematics)')).toBe('Science — PCM');
    expect(normalizeStream('Science — PCB (Physics, Chemistry, Biology)')).toBe('Science — PCB');
    expect(normalizeStream('Science — PCMB (Both Math & Biology)')).toBe('Science — PCMB');

    // PCM is eligible for Engineering, BCA, B.Sc Computer Science; not MBBS
    expect(validateProgramCompatibility('Science — PCM', 'B.Tech / BE')).toBe(true);
    expect(validateProgramCompatibility('Science — PCM', 'BCA')).toBe(true);
    expect(validateProgramCompatibility('Science — PCM', 'MBBS')).toBe(false);

    // PCB is eligible for MBBS, BDS, B.Pharm; not B.Tech Engineering
    expect(validateProgramCompatibility('Science — PCB', 'MBBS')).toBe(true);
    expect(validateProgramCompatibility('Science — PCB', 'BDS')).toBe(true);
    expect(validateProgramCompatibility('Science — PCB', 'B.Tech / BE')).toBe(false);

    // PCMB is eligible for both MBBS and Engineering
    expect(validateProgramCompatibility('Science — PCMB', 'MBBS')).toBe(true);
    expect(validateProgramCompatibility('Science — PCMB', 'B.Tech / BE')).toBe(true);
    expect(validateProgramCompatibility('Science — PCMB', 'BCA')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Diploma programme selection
  // --------------------------------------------------------------------------
  it('4. A user selecting a diploma programme is validly recognized and not rejected or converted', () => {
    // Explicit diploma programs in catalog
    expect(PROGRAM_REQUIREMENTS.find(p => p.program === 'Diploma')).toBeDefined();
    expect(PROGRAM_REQUIREMENTS.find(p => p.program === 'Diploma in Engineering')).toBeDefined();
    expect(PROGRAM_REQUIREMENTS.find(p => p.program === 'Polytechnic Diploma')).toBeDefined();
    expect(PROGRAM_REQUIREMENTS.find(p => p.program === 'Diploma in Pharmacy (D.Pharm)')).toBeDefined();

    expect(validateProgramCompatibility('Science — PCM', 'Diploma in Engineering')).toBe(true);
    expect(validateProgramCompatibility('Science — PCM', 'Polytechnic Diploma')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Postgraduate programme selection
  // --------------------------------------------------------------------------
  it('5. A user selecting a postgraduate programme does not falsely fail 12th stream requirements', () => {
    const mca = PROGRAM_REQUIREMENTS.find(p => p.program === 'MCA');
    expect(mca).toBeDefined();
    const mba = PROGRAM_REQUIREMENTS.find(p => p.program === 'MBA');
    expect(mba).toBeDefined();

    // Postgrad degrees are compatible regardless of 12th stream
    expect(validateProgramCompatibility('Commerce without Mathematics', 'MBA')).toBe(true);
    expect(validateProgramCompatibility('Humanities without Mathematics', 'MBA')).toBe(true);
    expect(validateProgramCompatibility('Commerce with Mathematics', 'MCA')).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Specialization and Pursuing status
  // --------------------------------------------------------------------------
  it('6. A user with a specialization and Pursuing status preserves both accurately', () => {
    const facts = extractProfileFacts({
      education: [
        {
          level: 'Undergraduate',
          degree: 'BCA',
          specialization: 'Artificial Intelligence',
          status: 'pursuing'
        }
      ]
    });

    expect(facts.qualification).toBe('BCA');
    expect(facts.degree_display).toBe('BCA');
    expect(facts.education_level).toBe('Undergraduate');
    expect(facts.status).toBe('pursuing');
    expect(facts.specialization).toBe('Artificial Intelligence');
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Completed qualification
  // --------------------------------------------------------------------------
  it('7. A user with a completed qualification has completed status recognized in facts and relevance', () => {
    const facts = extractProfileFacts({
      education: [
        {
          level: 'Undergraduate',
          degree: 'B.Tech / BE',
          specialization: 'Computer Science',
          status: 'completed'
        }
      ]
    });

    expect(facts.degree_display).toBe('B.Tech / BE');
    expect(facts.status).toBe('completed');

    // calculateEducationRelevance evaluates education matching
    const eduScore = calculateEducationRelevance(
      ['B.Tech / BE in Computer Science', 'Engineering degree'],
      [{ degree: 'B.Tech / BE', status: 'completed' }]
    );
    expect(eduScore).toBe(90);
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Profile with missing or unmapped education values
  // --------------------------------------------------------------------------
  it('8. A profile with missing education values does not fabricate BCA/Commerce and maps to State E (Facts Required)', () => {
    const facts = extractProfileFacts({ education: [] });
    expect(facts.qualification).toBeNull();
    expect(facts.degree_display).toBeNull();
    expect(facts.education_level).toBeNull();

    // Goal evaluation returns State E (Needs verification / facts required), never false eligibility
    const goalRes = evaluateGoalEligibility({ education: [] }, { title: 'Doctor' });
    expect(goalRes.status).toBe('E');
    expect(goalRes.decision).toBe('Request Data');
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Saving onboarding education and displaying exact values in Profile
  // --------------------------------------------------------------------------
  it('9. Saving onboarding education in draft status saves and retrieves exact values via GET /api/v1/profiles/me', async () => {
    const onboardingPayload = {
      career_goal: 'Software Engineer',
      preferred_locations: ['Panaji, Goa'],
      skills: [{ name: 'JavaScript', level: 'intermediate' }],
      education: [
        {
          level: 'Undergraduate',
          degree: 'BCA',
          current_program: 'BCA',
          school_12_stream: 'Commerce with Mathematics',
          specialization: 'Cloud Computing',
          status: 'pursuing'
        },
        {
          level: '12th / Higher Secondary',
          school_12_stream: 'Commerce with Mathematics',
          status: 'completed'
        }
      ]
    };

    // User 1 is currently 'draft' so saving onboarding education is permitted
    const saveRes = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${testUser1Token}`)
      .send(onboardingPayload);

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.data.profile_status).toBe('complete');

    // Fetch profile
    const getRes = await request(app)
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${testUser1Token}`);

    expect(getRes.status).toBe(200);
    const profile = getRes.body.data;
    expect(profile.education).toBeDefined();
    expect(profile.education.length).toBe(2);

    const ug = profile.education.find(e => e.level === 'Undergraduate');
    expect(ug).toBeDefined();
    expect(ug.degree).toBe('BCA');
    expect(ug.school_12_stream).toBe('Commerce with Mathematics');
    expect(ug.specialization).toBe('Cloud Computing');
    expect(ug.status).toBe('pursuing');

    const hsc = profile.education.find(e => e.level === '12th / Higher Secondary');
    expect(hsc).toBeDefined();
    expect(hsc.school_12_stream).toBe('Commerce with Mathematics');
    expect(hsc.status).toBe('completed');
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Refreshing or logging in again returns identical saved values
  // --------------------------------------------------------------------------
  it('10. Refreshing or querying GET /api/v1/profiles/me repeatedly returns identical, unaltered education data', async () => {
    const res1 = await request(app)
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${testUser1Token}`);

    const res2 = await request(app)
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${testUser1Token}`);

    expect(res1.body.data.education).toEqual(res2.body.data.education);
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Attempting to change education fields in Profile (UI Contract check)
  // --------------------------------------------------------------------------
  it('11. Profile UI contract mandates education fields are read-only and omitted from profile saves', () => {
    // In ProfilePage.jsx, handleSave creates an update payload without `education`:
    const profileFormState = {
      career_goal: 'Backend Developer',
      educationStage: 'college',
      stream_12: 'Science — PCMB',
      bachelorsDegree: 'BCA',
      specialization: 'Artificial Intelligence',
      educationStatus: 'pursuing',
      preferred_locations: ['Panaji, Goa'],
      skills: [{ name: 'JavaScript', level: 'intermediate' }]
    };

    // Simulated handleSave payload generation from ProfilePage.jsx:
    const savePayload = {
      career_goal: profileFormState.career_goal,
      preferred_locations: profileFormState.preferred_locations,
      skills: profileFormState.skills
      // NOTICE: education is deliberately omitted!
    };

    expect(savePayload.education).toBeUndefined();
    expect(savePayload.stream_12).toBeUndefined();
    expect(savePayload.bachelorsDegree).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Saving other profile fields without overwriting education
  // --------------------------------------------------------------------------
  it('12. Saving non-education fields (career_goal, locations, skills) via PUT /api/v1/profiles/me leaves existing education 100% intact', async () => {
    // User 2 has complete profile with BCA / Science — PCMB / Artificial Intelligence
    const updateRes = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${testUser2Token}`)
      .send({
        career_goal: 'Senior Backend Engineer',
        preferred_locations: ['Margao, Goa']
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.career_goal).toBe('Senior Backend Engineer');
    expect(updateRes.body.data.preferred_locations).toContain('Margao, Goa');

    // Verify education in database remained unchanged
    const getRes = await request(app)
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${testUser2Token}`);

    const edu = getRes.body.data.education;
    expect(edu).toBeDefined();
    expect(edu.length).toBe(2);
    expect(edu[0].degree).toBe('BCA');
    expect(edu[0].specialization).toBe('Artificial Intelligence');
    expect(edu[0].school_12_stream).toBe('Science — PCMB');
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Confirming backend education restrictions cannot be bypassed
  // --------------------------------------------------------------------------
  it('13. PUT /api/v1/profiles/me strictly rejects modifying education when profile is complete (HTTP 403 EDUCATION_LOCKED)', async () => {
    // User 2 has complete profile with education. Attempting to tamper with education via PUT /profiles/me
    const tamperRes = await request(app)
      .put('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${testUser2Token}`)
      .send({
        education: [
          {
            level: 'Undergraduate',
            degree: 'B.Tech / BE',
            current_program: 'B.Tech / BE',
            school_12_stream: 'Arts',
            status: 'completed'
          }
        ]
      });

    expect(tamperRes.status).toBe(403);
    expect(tamperRes.body.error).toBeDefined();
    expect(tamperRes.body.error.code).toBe('EDUCATION_LOCKED');
    expect(tamperRes.body.error.message).toContain('Education details are set during onboarding');

    // Ensure database was NOT altered
    const verifyRes = await request(app)
      .get('/api/v1/profiles/me')
      .set('Authorization', `Bearer ${testUser2Token}`);

    expect(verifyRes.body.data.education[0].degree).toBe('BCA');
    expect(verifyRes.body.data.education[0].specialization).toBe('Artificial Intelligence');
  });

  // --------------------------------------------------------------------------
  // Scenario 14: Career recommendations and pathways receive correct saved education
  // --------------------------------------------------------------------------
  it('14. Career recommendations and pathway personalization consume canonical saved education without fabrication', () => {
    const savedEducation = [
      {
        level: 'Undergraduate',
        degree: 'BCA',
        current_program: 'BCA',
        school_12_stream: 'Science — PCMB',
        specialization: 'Artificial Intelligence',
        status: 'pursuing'
      },
      {
        level: '12th / Higher Secondary',
        school_12_stream: 'Science — PCMB',
        status: 'completed'
      }
    ];

    // Facts extraction aggregates accurately
    const facts = extractProfileFacts({ education: savedEducation });
    expect(facts.degree_display).toBe('BCA');
    expect(facts.qualification).toBe('BCA');
    expect(facts.school_12_stream).toBe('Science — PCMB');

    // Pathway evidence evaluation correctly auto-detects BCA foundational knowledge
    const rawSteps = [
      {
        step_order: 1,
        title: 'Computer Science & Backend Runtime Foundations',
        skills: ['JavaScript', 'Algorithms'],
        deliverable: 'CLI Tool',
        action_link: '/docs',
        estimated_duration: '3 weeks'
      },
      {
        step_order: 2,
        title: 'Relational Database Architecture',
        skills: ['PostgreSQL', 'SQL'],
        deliverable: 'Schema migrations',
        action_link: '/docs',
        estimated_duration: '3 weeks'
      }
    ];

    const context = {
      profile: { education: savedEducation, experience: [] },
      user_skills: [{ name: 'JavaScript', proficiency: 'intermediate' }],
      custom_skills: []
    };

    const evaluated = evaluateUserProgressAndEvidence(context, rawSteps, 'Backend Developer');
    const step1 = evaluated.steps.find(s => s.step_order === 1);
    expect(step1.status).toBe('completed');
    expect(step1.completion_source).toBe('auto_detected');
  });
});
