import { pool } from '../backend/src/config/database.js';
import { educationTaxonomy } from '../backend/src/modules/skills/educationTaxonomy.js';

async function simulateSuggest(education, career_goal) {
  let responseSkills = [];
  const activeCareerGoal = (career_goal || '').trim();
  const activeEducation = (education || '').trim();

  if (activeCareerGoal) {
    const careerRes = await pool.query(
      `SELECT id, title FROM careers WHERE lower(trim(title)) = lower(trim($1)) OR title ILIKE $2 LIMIT 1`,
      [activeCareerGoal, `%${activeCareerGoal}%`]
    );
    if (careerRes.rows.length > 0) {
      const cId = careerRes.rows[0].id;
      const cSkills = await pool.query(`
        SELECT s.id, s.name, s.category, s.origin, s.verification_status, s.description,
               cs.importance, true as is_core
        FROM career_skills cs
        JOIN skills s ON cs.skill_id = s.id
        WHERE cs.career_id = $1 AND s.record_status = 'published'
        ORDER BY CASE cs.importance WHEN 'required' THEN 1 WHEN 'important' THEN 2 ELSE 3 END, s.name ASC
        LIMIT 15
      `, [cId]);

      for (const cs of cSkills.rows) {
        responseSkills.push({
          ...cs,
          ai_source: null,
          relationship: cs.importance === 'required' ? 'direct' : 'supporting'
        });
      }
    }
  }

  let mappedCategories = [];
  let primaryKeywords = activeEducation.toLowerCase();
  const matchesKeyword = (text, kw) => {
    const paddedText = ` ${text.replace(/[^a-z0-9]+/g, ' ')} `;
    const paddedKw = ` ${kw.replace(/[^a-z0-9]+/g, ' ')} `;
    return paddedText.includes(paddedKw);
  };

  for (const mapping of educationTaxonomy) {
    if (mapping.keywords.some(kw => matchesKeyword(primaryKeywords, kw))) {
      mappedCategories.push(...mapping.categories);
    }
  }

  if (mappedCategories.length > 0 || primaryKeywords.length > 0) {
    const catMatch = await pool.query(`
      SELECT DISTINCT s.id, s.name, s.category, s.origin, s.verification_status, s.description,
             COALESCE(m.is_core, false) as is_core
      FROM skills s
      LEFT JOIN skill_education_mappings m 
             ON s.id = m.skill_id 
            AND (m.degree_name ILIKE $2)
      WHERE s.record_status = 'published' 
        AND (s.category = ANY($1) OR m.id IS NOT NULL)
      ORDER BY is_core DESC, s.name ASC
      LIMIT 25
    `, [mappedCategories, `%${activeEducation}%`]);
    
    for (const sk of catMatch.rows) {
      if (!responseSkills.some(s => s.id === sk.id || s.name.toLowerCase() === sk.name.toLowerCase())) {
        responseSkills.push({
          ...sk,
          ai_source: null,
          relationship: sk.is_core ? 'direct' : 'supporting'
        });
      }
    }
  }

  return responseSkills;
}

async function run() {
  console.log('--- TEST 1: NO GOAL, BCA (Step 3 in old flow) ---');
  const res1 = await simulateSuggest('Bachelor of Computer Applications (BCA)', '');
  console.log('Skills count:', res1.length);
  res1.slice(0, 10).forEach(s => console.log('  ', s.relationship, ':', s.name, `(${s.category})`));

  console.log('\n--- TEST 2: GOAL = Data Analyst, BCA ---');
  const res2 = await simulateSuggest('Bachelor of Computer Applications (BCA)', 'Data Analyst');
  console.log('Skills count:', res2.length);
  console.log('Direct/Core skills:');
  res2.filter(s => s.relationship === 'direct' || s.is_core).forEach(s => console.log('  [core]', s.name, `(${s.category})`));
  console.log('Supporting skills:');
  res2.filter(s => s.relationship === 'supporting' && !s.is_core).slice(0, 8).forEach(s => console.log('  [supp]', s.name, `(${s.category})`));

  await pool.end();
}

run().catch(console.error);
