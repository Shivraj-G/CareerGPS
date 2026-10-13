import { pool } from '../backend/src/config/database.js';
import { educationTaxonomy, fallbackDegreeTaxonomy } from '../backend/src/modules/skills/educationTaxonomy.js';

export function normalizeSkillKey(name) {
  if (!name || typeof name !== 'string') return '';
  return name.toLowerCase()
    .replace(/\bvisualisation\b/g, 'visualization')
    .replace(/\borganisation\b/g, 'organization')
    .replace(/\bmodelling\b/g, 'modeling')
    .replace(/\bbehaviour\b/g, 'behavior')
    .replace(/\bprogramme\b/g, 'program')
    .replace(/[^a-z0-9]/g, ' ')
    .trim().replace(/\s+/g, ' ');
}

const GENERAL_TRANSFERABLE_SKILLS = new Set([
  'communication', 'documentation', 'problem solving', 'critical thinking',
  'presentation skills', 'teamwork', 'analytical thinking', 'time management',
  'leadership', 'creative thinking', 'customer service', 'negotiation'
]);

async function suggestSkillsEngine({ education = '', career_goal = '', career_id = null }) {
  const activeEducation = education.trim();
  const activeCareerGoal = career_goal.trim();

  const responseSkills = [];
  const seenCanonicalKeys = new Map();

  function addSkill(sk, relationship, isCore) {
    const key = normalizeSkillKey(sk.name);
    if (!key) return;

    if (seenCanonicalKeys.has(key)) {
      // If we already have this skill, maybe update if current one has null category but new one has valid category
      const existingIdx = seenCanonicalKeys.get(key);
      const existing = responseSkills[existingIdx];
      if (!existing.category && sk.category) {
        existing.category = sk.category;
      }
      return;
    }

    const item = {
      id: sk.id,
      name: sk.name,
      category: sk.category,
      origin: sk.origin,
      verification_status: sk.verification_status,
      description: sk.description,
      relationship,
      is_core: isCore
    };

    seenCanonicalKeys.set(key, responseSkills.length);
    responseSkills.push(item);
  }

  // 1. If career goal or career_id provided, fetch official career_skills first
  if (activeCareerGoal || career_id) {
    let career = null;
    if (career_id) {
      const cRes = await pool.query('SELECT id, title FROM careers WHERE id = $1 LIMIT 1', [career_id]);
      career = cRes.rows[0] || null;
    }
    if (!career && activeCareerGoal) {
      const cRes = await pool.query(
        `SELECT id, title FROM careers 
         WHERE lower(trim(title)) = lower(trim($1)) 
            OR title ILIKE $2 
         ORDER BY CASE WHEN lower(trim(title)) = lower(trim($1)) THEN 1 ELSE 2 END, length(title) ASC 
         LIMIT 1`,
        [activeCareerGoal, `%${activeCareerGoal}%`]
      );
      career = cRes.rows[0] || null;
    }

    if (career) {
      const cSkills = await pool.query(`
        SELECT s.id, s.name, s.category, s.origin, s.verification_status, s.description,
               cs.importance
        FROM career_skills cs
        JOIN skills s ON cs.skill_id = s.id
        WHERE cs.career_id = $1 AND s.record_status = 'published'
        ORDER BY CASE cs.importance WHEN 'required' THEN 1 WHEN 'important' THEN 2 ELSE 3 END, s.name ASC
        LIMIT 25
      `, [career.id]);

      for (const cs of cSkills.rows) {
        const normName = normalizeSkillKey(cs.name);
        const isGeneral = GENERAL_TRANSFERABLE_SKILLS.has(normName) || cs.category === 'soft_skill';
        
        let rel = 'supporting';
        let isCore = false;

        if (cs.importance === 'required') {
          rel = 'direct';
          isCore = true;
        } else if (cs.importance === 'important') {
          if (!isGeneral) {
            rel = 'direct';
            isCore = true;
          } else {
            rel = 'supporting';
            isCore = false;
          }
        } else {
          // 'useful'
          rel = 'supporting';
          isCore = false;
        }

        addSkill(cs, rel, isCore);
      }
    }
  }

  // 2. Fetch supporting skills from education
  let mappedCategories = [];
  const primaryKeywords = activeEducation.toLowerCase();
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
  if (mappedCategories.length === 0) {
    for (const mapping of fallbackDegreeTaxonomy) {
      if (mapping.keywords.some(kw => matchesKeyword(primaryKeywords, kw))) {
        mappedCategories.push(...mapping.categories);
      }
    }
  }

  mappedCategories = [...new Set(mappedCategories)];

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
      // If a career goal was present, education skills can ONLY be supporting
      // If NO career goal was present, education core skills can be direct
      const rel = activeCareerGoal ? 'supporting' : (sk.is_core ? 'direct' : 'supporting');
      const isCore = activeCareerGoal ? false : !!sk.is_core;
      addSkill(sk, rel, isCore);
    }
  }

  return responseSkills;
}

async function run() {
  console.log('=== TEST A: Data Analyst (BCA background) ===');
  const da = await suggestSkillsEngine({ education: 'Bachelor of Computer Applications (BCA)', career_goal: 'Data Analyst' });
  const daCore = da.filter(s => s.is_core);
  const daSupp = da.filter(s => !s.is_core);
  console.log('Core count:', daCore.length, 'Supp count:', daSupp.length);
  console.log('Core skills:', daCore.map(s => s.name));
  console.log('Supporting skills (first 10):', daSupp.slice(0, 10).map(s => s.name));

  // Verify Vue.js, Software Testing, CI/CD NOT in core
  const techInCore = daCore.filter(s => ['Vue.js', 'Software Testing', 'CI/CD'].includes(s.name));
  console.log('Unrelated tech in Core Data Analyst:', techInCore.map(s => s.name));
  // Verify Data Visualization deduplication
  const vizSkills = da.filter(s => normalizeSkillKey(s.name) === 'data visualization');
  console.log('Data Visualization occurrences:', vizSkills.map(s => `${s.name} (${s.category})`));

  console.log('\n=== TEST B: Backend Developer ===');
  const be = await suggestSkillsEngine({ education: 'Bachelor of Computer Applications (BCA)', career_goal: 'Backend Developer' });
  const beCore = be.filter(s => s.is_core);
  console.log('Backend Core skills:', beCore.map(s => s.name));

  console.log('\n=== TEST C: Chef ===');
  const ch = await suggestSkillsEngine({ education: 'Higher Secondary School', career_goal: 'Chef' });
  const chCore = ch.filter(s => s.is_core);
  console.log('Chef Core skills:', chCore.map(s => s.name));

  console.log('\n=== TEST D: Lawyer ===');
  const lw = await suggestSkillsEngine({ education: 'Bachelor of Arts (BA)', career_goal: 'Lawyer' });
  const lwCore = lw.filter(s => s.is_core);
  console.log('Lawyer Core skills:', lwCore.map(s => s.name));

  console.log('\n=== TEST E: Assistant Professor ===');
  const ap = await suggestSkillsEngine({ education: 'Master of Arts (MA)', career_goal: 'Assistant Professor' });
  const apCore = ap.filter(s => s.is_core);
  console.log('Assistant Professor Core skills:', apCore.map(s => s.name));

  await pool.end();
}

run().catch(console.error);
