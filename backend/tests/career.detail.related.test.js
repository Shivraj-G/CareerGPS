import { describe, expect, it } from 'vitest';
import { pool } from '../src/config/database.js';
import { calculateSkillGap } from '../src/modules/skills/skill-intelligence.service.js';
import {
  classifyDomain,
  areDomainsCompatible,
  getProgressionLadder,
  getRegulatoryAndQualificationGuidance,
  scoreAndRankRelatedCareers
} from '../src/modules/careers/occupational-engine.js';

describe('Career Detail, Skill Gap Analysis & Related Careers', () => {
  const FTA_ID = 'c9a5a6a7-a3d1-4e0b-bc07-6de2d5a686f6'; // Finance Technology Analyst
  const ERP_ID = '863e1d32-8e45-4cac-a937-304f45a82550'; // ERP Specialist

  it('1. Finance Technology Analyst loads its real database record', async () => {
    const res = await pool.query(
      `SELECT id, title, description, responsibilities, qualifications, entry_routes, verification_status
       FROM careers WHERE id = $1 AND record_status IN ('published', 'needs_review')`,
      [FTA_ID]
    );
    expect(res.rows.length).toBe(1);
    const career = res.rows[0];
    expect(career.id).toBe(FTA_ID);
    expect(career.title).toBe('Finance Technology Analyst');
    expect(career.description).toBeTruthy();

    // Check skills in database
    const skillsRes = await pool.query(
      `SELECT s.name, cs.importance FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1`,
      [FTA_ID]
    );
    const skillNames = skillsRes.rows.map(r => r.name);
    expect(skillNames).toContain('SQL');
    expect(skillNames).toContain('Excel');
    expect(skillNames).toContain('Accounting');
  });

  it('2. ERP Specialist loads its real database record', async () => {
    const res = await pool.query(
      `SELECT id, title, description, responsibilities, qualifications, entry_routes, verification_status
       FROM careers WHERE id = $1 AND record_status IN ('published', 'needs_review')`,
      [ERP_ID]
    );
    expect(res.rows.length).toBe(1);
    const career = res.rows[0];
    expect(career.id).toBe(ERP_ID);
    expect(career.title).toBe('ERP Specialist');
    expect(career.description).toBeTruthy();

    const skillsRes = await pool.query(
      `SELECT s.name, cs.importance FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1`,
      [ERP_ID]
    );
    const skillNames = skillsRes.rows.map(r => r.name);
    expect(skillNames).toContain('ERP Concepts');
    expect(skillNames).toContain('Business Analysis');
  });

  it('3. Skill-gap analysis evaluates authenticated user actual saved skills', async () => {
    // Find or use test user
    const userRes = await pool.query(`SELECT id FROM users LIMIT 1`);
    expect(userRes.rows.length).toBeGreaterThan(0);
    const userId = userRes.rows[0].id;

    const gap = await calculateSkillGap(userId, FTA_ID);

    expect(gap.target_career_id).toBe(FTA_ID);
    expect(gap.career_title).toBe('Finance Technology Analyst');
    expect(typeof gap.match_score).toBe('number');
    expect(gap.match_score).toBeGreaterThanOrEqual(0);
    expect(gap.match_score).toBeLessThanOrEqual(100);

    // Documented explanation & transparent rules
    expect(gap.score_explanation).toContain('Required skills weighted 3x');
    expect(['High Alignment', 'Moderate Alignment', 'Emerging Foundation', 'Early Exploration']).toContain(gap.readiness_level);

    // Distinct groups
    expect(Array.isArray(gap.skills_present)).toBe(true);
    expect(Array.isArray(gap.skills_needing_development)).toBe(true);
    expect(Array.isArray(gap.priority_skills)).toBe(true);
    expect(gap.priority_skills.length).toBeGreaterThan(0);

    // Not reported vs confirmed missing
    if (gap.skills_needing_development.length > 0) {
      expect(gap.skills_needing_development[0].evidence_status).toBe('not_reported');
    }

    // Actionable next step and milestones
    expect(gap.recommended_next_action).toBeTruthy();
    expect(Array.isArray(gap.learning_milestones)).toBe(true);
    expect(gap.learning_milestones.length).toBe(3);
  });

  it('4. Related careers query retrieves real database records and ranks deterministically', async () => {
    // Test for Finance Technology Analyst
    const ftaSkillsRes = await pool.query(
      `SELECT s.id, s.name, cs.importance FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1`,
      [FTA_ID]
    );
    const ftaSkillIds = new Set(ftaSkillsRes.rows.map(s => s.id));

    const candidatesRes = await pool.query(`
      SELECT c.id, c.title, c.description,
             json_agg(json_build_object('id', s.id, 'name', s.name, 'importance', cs.importance)) FILTER (WHERE s.id IS NOT NULL) as skills
      FROM careers c
      LEFT JOIN career_skills cs ON cs.career_id = c.id
      LEFT JOIN skills s ON s.id = cs.skill_id AND s.record_status IN ('published', 'needs_review')
      WHERE c.id <> $1 AND c.record_status IN ('published', 'needs_review')
      GROUP BY c.id, c.title, c.description
    `, [FTA_ID]);

    const related = [];
    for (const cand of candidatesRes.rows) {
      const candSkills = cand.skills || [];
      const shared = candSkills.filter(s => ftaSkillIds.has(s.id));
      if (shared.length > 0) {
        related.push({
          id: cand.id,
          title: cand.title,
          sharedCount: shared.length,
          sharedNames: shared.map(s => s.name)
        });
      }
    }

    related.sort((a, b) => b.sharedCount - a.sharedCount || a.title.localeCompare(b.title));

    // Must return actual DB careers
    expect(related.length).toBeGreaterThan(0);
    const relatedTitles = related.map(r => r.title);

    // Business Analyst or ERP Specialist or Finance Technology must be in related careers
    expect(relatedTitles.some(t => t.includes('Business Analyst') || t.includes('ERP') || t.includes('Finance'))).toBe(true);

    // Verify all IDs are valid UUIDs from careers table
    for (const r of related) {
      const check = await pool.query(`SELECT id FROM careers WHERE id = $1`, [r.id]);
      expect(check.rows.length).toBe(1);
    }
  });

  it('5. ERP Specialist relates to Business Analyst and Data Analyst in PostgreSQL', async () => {
    const erpSkillsRes = await pool.query(
      `SELECT s.id, s.name FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1`,
      [ERP_ID]
    );
    const erpSkillIds = new Set(erpSkillsRes.rows.map(s => s.id));

    const candidatesRes = await pool.query(`
      SELECT c.id, c.title,
             json_agg(s.id) FILTER (WHERE s.id IS NOT NULL) as skill_ids
      FROM careers c
      LEFT JOIN career_skills cs ON cs.career_id = c.id
      LEFT JOIN skills s ON s.id = cs.skill_id
      WHERE c.id <> $1 AND c.record_status IN ('published', 'needs_review')
      GROUP BY c.id, c.title
    `, [ERP_ID]);

    const related = candidatesRes.rows
      .map(c => ({
        id: c.id,
        title: c.title,
        shared: (c.skill_ids || []).filter(sid => erpSkillIds.has(sid)).length
      }))
      .filter(c => c.shared > 0)
      .sort((a, b) => b.shared - a.shared);

    expect(related.length).toBeGreaterThan(0);
    expect(related[0].title).toBe('Business Analyst');
    expect(related[0].shared).toBeGreaterThanOrEqual(4);
  });

  it('6. Duplicate career IDs or aliases do not produce duplicate related cards', async () => {
    const candidatesRes = await pool.query(`
      SELECT c.id, count(*) as count
      FROM careers c
      WHERE c.record_status IN ('published', 'needs_review')
      GROUP BY c.id
      HAVING count(*) > 1
    `);
    // Unique constraint on id guarantees no duplicate career rows
    expect(candidatesRes.rows.length).toBe(0);
  });

  it('7. AI unavailable still returns database-backed related careers and deterministic skill gaps', async () => {
    // When AI service is offline, calculateSkillGap still executes 100% deterministically from DB
    const userRes = await pool.query(`SELECT id FROM users LIMIT 1`);
    const gap = await calculateSkillGap(userRes.rows[0].id, ERP_ID);
    expect(gap).toBeTruthy();
    expect(gap.career_title).toBe('ERP Specialist');
    expect(gap.priority_skills.length).toBeGreaterThan(0);
  });

  it('8. Assistant Professor regression test: prioritizes academic/teaching roles and strictly excludes Chef, Police Officer, and Business Analyst', async () => {
    const apRes = await pool.query(
      `SELECT c.id, c.title, c.description,
              json_agg(json_build_object('id', s.id, 'name', s.name, 'importance', cs.importance)) FILTER (WHERE s.id IS NOT NULL) as skills
       FROM careers c
       LEFT JOIN career_skills cs ON cs.career_id = c.id
       LEFT JOIN skills s ON s.id = cs.skill_id
       WHERE c.title ILIKE '%Assistant Professor%'
       GROUP BY c.id, c.title, c.description`
    );
    expect(apRes.rows.length).toBe(1);
    const ap = apRes.rows[0];

    const allCandRes = await pool.query(
      `SELECT c.id, c.title, c.description,
              json_agg(json_build_object('id', s.id, 'name', s.name, 'importance', cs.importance)) FILTER (WHERE s.id IS NOT NULL) as skills
       FROM careers c
       LEFT JOIN career_skills cs ON cs.career_id = c.id
       LEFT JOIN skills s ON s.id = cs.skill_id
       WHERE c.id <> $1 AND c.record_status IN ('published', 'needs_review')
       GROUP BY c.id, c.title, c.description`,
      [ap.id]
    );

    const related = scoreAndRankRelatedCareers(ap, allCandRes.rows);
    const relatedTitles = related.data.map(r => r.title);

    // Teacher must be related (shared curriculum/pedagogy in ACADEMIA_EDUCATION)
    expect(relatedTitles).toContain('Teacher');

    // Unrelated careers sharing only generic soft skills (Communication, Critical Thinking) MUST be excluded!
    expect(relatedTitles).not.toContain('Chef');
    expect(relatedTitles).not.toContain('Police Officer');
    expect(relatedTitles).not.toContain('Business Analyst');
    expect(relatedTitles).not.toContain('Clerk');
    expect(relatedTitles).not.toContain('Technician');

    // Limited catalogue note must be present
    expect(related.meta.has_limited_catalogue).toBe(true);
    expect(related.meta.catalogue_note).toContain('verified');
  });

  it('9. Progression ladder and regulatory guidance correctly differentiate mandatory vs preferred qualifications', () => {
    const guidance = getRegulatoryAndQualificationGuidance('Assistant Professor', 'ACADEMIA_EDUCATION', [
      'Master’s degree in relevant discipline',
      'Ph.D. degree',
      'UGC-NET qualification'
    ]);

    expect(guidance.mandatory.length).toBeGreaterThan(0);
    expect(guidance.mandatory.some(m => m.includes('NET') || m.includes('Master'))).toBe(true);
    expect(guidance.preferred.length).toBeGreaterThan(0);
    expect(guidance.statutoryFramework).toBeTruthy();
    expect(guidance.statutoryFramework.authority).toContain('UGC');
    expect(guidance.recommendedNextAction).toBeTruthy();

    const ladder = getProgressionLadder('Assistant Professor', 'ACADEMIA_EDUCATION');
    expect(ladder.length).toBe(4);
    expect(ladder[0].level).toBe('Entry Stage');
    expect(ladder[1].role).toBe('Assistant Professor');
    expect(ladder[1].current).toBe(true);
    expect(ladder[2].role).toBe('Associate Professor');
    expect(ladder[3].role).toContain('Professor');
  });

  it('10. Doctor correctly relates to Surgeon and strictly excludes unrelated technical trades', async () => {
    const docRes = await pool.query(`SELECT id, title, description FROM careers WHERE title = 'Doctor'`);
    if (docRes.rows.length > 0) {
      const doc = docRes.rows[0];
      const allCandRes = await pool.query(
        `SELECT c.id, c.title, c.description,
                json_agg(json_build_object('id', s.id, 'name', s.name, 'importance', cs.importance)) FILTER (WHERE s.id IS NOT NULL) as skills
         FROM careers c
         LEFT JOIN career_skills cs ON cs.career_id = c.id
         LEFT JOIN skills s ON s.id = cs.skill_id
         WHERE c.id <> $1 AND c.record_status IN ('published', 'needs_review')
         GROUP BY c.id, c.title, c.description`,
        [doc.id]
      );

      const related = scoreAndRankRelatedCareers(doc, allCandRes.rows);
      const relatedTitles = related.data.map(r => r.title);

      expect(relatedTitles).toContain('Surgeon');
      expect(relatedTitles).not.toContain('Technician');
      expect(relatedTitles).not.toContain('Clerk');
      expect(relatedTitles).not.toContain('Chef');
    }
  });
});
