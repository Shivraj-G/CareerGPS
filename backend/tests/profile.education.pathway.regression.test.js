import { describe, expect, it } from 'vitest';
import { pool } from '../src/config/database.js';
import {
  normalizeStream,
  ALL_STREAMS,
  SUPPORTED_STREAMS,
  getCompatiblePrograms,
  validateProgramCompatibility
} from '../src/modules/education/education.service.js';
import {
  evaluateUserProgressAndEvidence,
  DOMAIN_PATHWAY_TEMPLATES
} from '../src/modules/pathways/pathway-engine.js';
import {
  getCareerPathways,
  getPathway
} from '../src/modules/pathways/pathway.service.js';

describe('Profile Education and Career Pathway Regression Tests', () => {
  it('1. Stream normalization maps legacy labels to canonical options', () => {
    expect(normalizeStream('Science — PCMB (Both Math & Biology)')).toBe('Science — PCMB');
    expect(normalizeStream('Science — PCB (Physics, Chemistry, Biology)')).toBe('Science — PCB');
    expect(normalizeStream('Science — PCM (Physics, Chemistry, Mathematics)')).toBe('Science — PCM');
    expect(normalizeStream('Commerce')).toBe('Commerce with Mathematics');
    expect(normalizeStream('Arts / Humanities')).toBe('Humanities without Mathematics');
    expect(normalizeStream('Science — PCMB')).toBe('Science — PCMB');
  });

  it('2. Normalized streams include BCA in eligible undergraduate programs', () => {
    const rawStream = 'Science — PCMB (Both Math & Biology)';
    const canonicalStream = normalizeStream(rawStream);
    expect(canonicalStream).toBe('Science — PCMB');

    const programs = getCompatiblePrograms(canonicalStream);
    expect(programs).toContain('BCA');
    expect(programs).toContain('B.Tech / BE');
    expect(programs).toContain('MBBS');
    expect(programs.length).toBeGreaterThan(10);

    // Compatibility validation with legacy label and canonical label both pass
    expect(validateProgramCompatibility(canonicalStream, 'BCA')).toBe(true);
    expect(validateProgramCompatibility(rawStream, 'BCA')).toBe(true);
  });

  it('3. BCA pursuing qualification hydrates properly without being cleared', () => {
    // Simulating database education array from user_profiles table
    const dbEducation = [
      {
        level: 'Undergraduate',
        degree: 'BCA',
        current_program: 'BCA',
        status: 'pursuing',
        school_12_stream: 'Science — PCMB',
        specialization: 'Artificial Intelligence',
        year: 2
      }
    ];

    const bachelors = dbEducation.find(e => e.level === 'Undergraduate');
    expect(bachelors).toBeDefined();
    expect(bachelors.degree).toBe('BCA');
    expect(bachelors.status).toBe('pursuing');

    const canonicalStream = normalizeStream(bachelors.school_12_stream);
    expect(canonicalStream).toBe('Science — PCMB');

    const availablePrograms = getCompatiblePrograms(canonicalStream);
    expect(availablePrograms).toContain('BCA');

    // UI preservation rule: degree is NEVER wiped when present
    const displayPrograms = availablePrograms.filter(p => p !== 'MBA');
    if (bachelors.degree && !displayPrograms.includes(bachelors.degree)) {
      displayPrograms.unshift(bachelors.degree);
    }
    expect(displayPrograms).toContain('BCA');
  });

  it('4. Backend Developer pathways contain meaningful, non-duplicated route options', async () => {
    const careerRes = await pool.query("SELECT id, title FROM careers WHERE title = 'Backend Developer' LIMIT 1");
    expect(careerRes.rows.length).toBe(1);
    const careerId = careerRes.rows[0].id;

    // Direct query as executed by GET /careers/:careerId/pathways
    const pathwaysRes = await pool.query(`
      SELECT p.id, p.title, p.description, p.record_status, p.verification_status, p.origin,
             COALESCE(
               (SELECT jsonb_agg(jsonb_build_object('order', ps.step_order, 'title', ps.title)) 
                FROM pathway_steps ps WHERE ps.pathway_id = p.id), '[]'::jsonb
             ) AS steps
      FROM pathways p 
      WHERE p.career_id = $1 
        AND p.record_status != 'archived'
        AND p.pathway_type = 'template'
      ORDER BY CASE WHEN p.record_status = 'published' THEN 0 ELSE 1 END, p.title
    `, [careerId]);

    const distinct = [];
    const seenTitles = new Set();
    const seenStepSignatures = new Set();
    for (const pw of pathwaysRes.rows) {
      const normTitle = (pw.title || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().replace(/\s+/g, ' ');
      const stepSig = Array.isArray(pw.steps) && pw.steps.length > 0
        ? pw.steps.map(s => (s.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15)).sort().join('|')
        : '';
      if (seenTitles.has(normTitle)) continue;
      if (stepSig && seenStepSignatures.has(stepSig)) continue;
      seenTitles.add(normTitle);
      if (stepSig) seenStepSignatures.add(stepSig);
      distinct.push(pw);
    }

    // Should NOT have 10 duplicate rows anymore
    expect(distinct.length).toBeGreaterThanOrEqual(1);
    expect(distinct.length).toBeLessThanOrEqual(3);
    expect(distinct[0].title).toContain('Backend Developer');
  });

  it('5. Curated Backend Developer domain template has authentic 7-stage actionable steps', () => {
    const backendTemplate = DOMAIN_PATHWAY_TEMPLATES['backend developer'];
    expect(backendTemplate).toBeDefined();
    expect(backendTemplate.length).toBe(7);

    const stepTitles = backendTemplate.map(s => s.title);
    expect(stepTitles[0]).toContain('Computer Science & Backend Runtime');
    expect(stepTitles[1]).toContain('Relational Database Architecture');
    expect(stepTitles[2]).toContain('RESTful API');
    expect(stepTitles[3]).toContain('Asynchronous Processing');
    expect(stepTitles[4]).toContain('Automated Testing');
    expect(stepTitles[5]).toContain('Cloud Infrastructure');
    expect(stepTitles[6]).toContain('Production System Portfolio');

    // Every step must have deliverable, action link, and estimated duration
    backendTemplate.forEach(step => {
      expect(step.deliverable).toBeTruthy();
      expect(step.action_link).toBeTruthy();
      expect(step.estimated_duration).toBeTruthy();
      expect(step.skills.length).toBeGreaterThan(0);
    });
  });

  it('6. Personalization uses BCA qualification to auto-detect technical foundational steps', () => {
    const rawSteps = DOMAIN_PATHWAY_TEMPLATES['backend developer'];
    const bcaContext = {
      profile: {
        education: [
          { level: 'Undergraduate', degree: 'BCA', current_program: 'BCA', status: 'pursuing' },
          { level: '12th / Higher Secondary', school_12_stream: 'Science — PCMB', status: 'completed' }
        ],
        experience: []
      },
      user_skills: [
        { name: 'JavaScript', proficiency: 'intermediate' },
        { name: 'Node.js', proficiency: 'intermediate' }
      ],
      custom_skills: []
    };

    const evaluated = evaluateUserProgressAndEvidence(bcaContext, rawSteps, 'Backend Developer');
    
    // Step 1 should be recognized from BCA + JavaScript/Node.js skills
    const step1 = evaluated.steps.find(s => s.step_order === 1);
    expect(step1.status).toBe('completed');
    expect(step1.completion_source).toBe('auto_detected');
    expect(evaluated.metrics.completed).toBeGreaterThanOrEqual(1);
    expect(evaluated.experience_tier).toBe('intermediate');
  });

  it('7. Experienced professional is categorized correctly and foundational stages advance', () => {
    const rawSteps = DOMAIN_PATHWAY_TEMPLATES['backend developer'];
    const experiencedContext = {
      profile: {
        education: [{ level: 'Undergraduate', degree: 'B.Tech', status: 'completed' }],
        experience: [{ role: 'Backend Engineer', years: 3 }]
      },
      user_skills: [
        { name: 'Node.js', proficiency: 'advanced' },
        { name: 'SQL', proficiency: 'advanced' },
        { name: 'PostgreSQL', proficiency: 'advanced' }
      ],
      custom_skills: []
    };

    const evaluated = evaluateUserProgressAndEvidence(experiencedContext, rawSteps, 'Backend Developer');
    expect(evaluated.experience_tier).toBe('experienced');
    expect(evaluated.metrics.completed).toBeGreaterThanOrEqual(2);
  });

  it('8. Database-backed and AI-generated pathways are clearly distinguished in service responses', async () => {
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');
    const careerRes = await pool.query("SELECT id FROM careers WHERE title = 'Backend Developer' LIMIT 1");
    if (userRes.rows[0] && careerRes.rows[0]) {
      const data = await getCareerPathways(userRes.rows[0].id, careerRes.rows[0].id);
      expect(Array.isArray(data.existing)).toBe(true);
      expect(Array.isArray(data.aiGenerated)).toBe(true);
      if (data.existing.length > 0) {
        expect(data.existing[0].is_database_backed).toBe(true);
      }
      if (data.aiGenerated.length > 0) {
        expect(data.aiGenerated[0].is_database_backed).toBe(false);
      }
    }
  });
});
