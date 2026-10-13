import { Router } from 'express';
import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { z } from 'zod';
import { educationTaxonomy, fallbackDegreeTaxonomy } from './educationTaxonomy.js';
import { normalizeSkillKey, deduplicateSkills, GENERAL_TRANSFERABLE_SKILLS } from './skill-canonical.js';

const router = Router();
const suggestSchema = z.object({
  query: z.string().min(1).max(120),
  limit: z.number().int().min(1).max(20).optional()
});
router.get('/', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const queryParams = [search, limit, offset];
    let queryStr = `SELECT id, name, description, category, origin, verification_status FROM skills WHERE record_status = 'published' AND ($1 = '' OR name ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')`;
    let countQuery = `SELECT count(*) FROM skills WHERE record_status = 'published' AND ($1 = '' OR name ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')`;

    if (category) {
      queryParams.push(category);
      const catIdx = queryParams.length;
      queryStr += ` AND category = $${catIdx}`;
      countQuery += ` AND category = $${catIdx}`;
    }

    queryStr += ` ORDER BY name, id LIMIT $2 OFFSET $3`;

    const [result, countRes] = await Promise.all([
      pool.query(queryStr, queryParams),
      pool.query(countQuery, category ? [search, category] : [search])
    ]);
    const total = parseInt(countRes.rows[0].count, 10);

    res.json({ data: result.rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
});

router.post('/suggest', authenticate, async (req, res, next) => {
  try {
    const suggestBodySchema = z.object({
      query: z.string().max(200).optional(),
      education: z.string().max(200).optional(),
      career_goal: z.string().max(200).optional(),
      career_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(30).optional()
    });

    const { query, education, career_goal, career_id, limit } = suggestBodySchema.parse(req.body);
    
    // Load the authenticated user's actual saved education profile and selected skills
    const [profileRes, userSkillsRes] = await Promise.all([
      pool.query(`SELECT education, experience, career_goal, career_id FROM user_profiles WHERE user_id = $1`, [req.user.id]),
      pool.query(`SELECT skill_id FROM user_skills WHERE user_id = $1`, [req.user.id])
    ]);
    const profile = profileRes.rows[0] || {};
    const userSelectedSkillIds = new Set(userSkillsRes.rows.map(r => r.skill_id));
    
    let backendEducationContext = '';
    if (profile.education && Array.isArray(profile.education)) {
       backendEducationContext = profile.education.map(e => {
         let parts = [];
         if (e.level) parts.push(e.level);
         if (e.school_12_stream || e.stream) parts.push(e.school_12_stream || e.stream);
         if (e.current_program || e.degree || e.qualification) parts.push(e.current_program || e.degree || e.qualification);
         if (e.specialization) parts.push(`Specialization: ${e.specialization}`);
         return parts.join(' ');
       }).join('; ');
    }
    if (profile.experience && Array.isArray(profile.experience)) {
       backendEducationContext += ' | Experience: ' + profile.experience.map(e => {
         let parts = [];
         if (e.industry) parts.push(e.industry);
         if (e.role) parts.push(e.role);
         if (e.duration) parts.push(`(${e.duration})`);
         if (!e.industry && !e.role && e.description) parts.push(e.description);
         return parts.join(' ');
       }).join('; ');
    }
    
    const activeEducation = (education || query || '').trim() || backendEducationContext.trim();
    const activeCareerGoal = (career_goal || '').trim() || (profile.career_goal || '').trim();
    const activeCareerId = career_id || profile.career_id || null;
    
    let rawSkills = [];
    let mappedCategories = [];
    let searchKeywords = [];
    let specStr = '';
    let degreeStr = '';
    let streamStr = '';
    let primaryKeywords = '';

    // 1. If an active career goal or career_id is supplied, query official career skills first
    let matchedCareer = null;
    if (activeCareerId || activeCareerGoal) {
      try {
        if (activeCareerId) {
          const cRes = await pool.query('SELECT id, title FROM careers WHERE id = $1 LIMIT 1', [activeCareerId]);
          matchedCareer = cRes.rows[0] || null;
        }
        if (!matchedCareer && activeCareerGoal) {
          const cRes = await pool.query(
            `SELECT id, title FROM careers 
             WHERE lower(trim(title)) = lower(trim($1)) 
                OR title ILIKE $2 
             ORDER BY CASE WHEN lower(trim(title)) = lower(trim($1)) THEN 1 ELSE 2 END, length(title) ASC 
             LIMIT 1`,
            [activeCareerGoal, `%${activeCareerGoal}%`]
          );
          matchedCareer = cRes.rows[0] || null;
        }

        if (matchedCareer) {
          const cSkills = await pool.query(`
            SELECT s.id, s.name, s.category, s.origin, s.verification_status, s.description,
                   cs.importance
            FROM career_skills cs
            JOIN skills s ON cs.skill_id = s.id
            WHERE cs.career_id = $1 AND s.record_status = 'published'
            ORDER BY CASE cs.importance WHEN 'required' THEN 1 WHEN 'important' THEN 2 ELSE 3 END, s.name ASC
            LIMIT 25
          `, [matchedCareer.id]);

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
              rel = 'supporting';
              isCore = false;
            }

            rawSkills.push({
              ...cs,
              ai_source: null,
              relationship: rel,
              is_core: isCore
            });
          }
        }
      } catch (err) {
        console.error('Error querying career_skills for goal:', err);
      }
    }
    
    // 2. Extract education context from saved profile OR incoming education string
    if (profile.education && profile.education.length > 0) {
      const levelRank = { 'postgraduate': 3, 'undergraduate': 2, 'diploma': 1, 'class 12': 0, 'class 10': -1 };
      const sortedEdu = [...profile.education].sort((a, b) => {
        const rankA = levelRank[(a.level || '').toLowerCase()] ?? -2;
        const rankB = levelRank[(b.level || '').toLowerCase()] ?? -2;
        return rankB - rankA;
      });
      
      const primaryEdu = sortedEdu[0];
      specStr = (primaryEdu.specialization || '').toLowerCase();
      degreeStr = (primaryEdu.degree || primaryEdu.current_program || '').toLowerCase();
      streamStr = (primaryEdu.school_12_stream || primaryEdu.stream || '').toLowerCase();
      primaryKeywords = specStr ? specStr : (degreeStr || streamStr);
      searchKeywords.push(...primaryKeywords.split(/[\s,:-]+/).filter(w => w.length > 2));
    }

    if (!primaryKeywords && activeEducation) {
      primaryKeywords = activeEducation.toLowerCase();
      searchKeywords.push(...primaryKeywords.split(/[\s,:-]+/).filter(w => w.length > 2));
    }
    
    const matchesKeyword = (text, kw) => {
      const paddedText = ` ${text.replace(/[^a-z0-9]+/g, ' ')} `;
      const paddedKw = ` ${kw.replace(/[^a-z0-9]+/g, ' ')} `;
      return paddedText.includes(paddedKw);
    };

    if (primaryKeywords) {
      let matched = false;
      for (const mapping of educationTaxonomy) {
        if (mapping.keywords.some(kw => matchesKeyword(primaryKeywords, kw))) {
          mappedCategories.push(...mapping.categories);
          matched = true;
        }
      }
      
      if (!matched) {
        for (const mapping of fallbackDegreeTaxonomy) {
          if (mapping.keywords.some(kw => matchesKeyword(degreeStr || primaryKeywords, kw) || matchesKeyword(streamStr, kw))) {
            mappedCategories.push(...mapping.categories);
          }
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
              AND (m.degree_name ILIKE $2 OR m.degree_name ILIKE $4)
              AND (m.specialization ILIKE $3 OR m.specialization = '' OR $3 = '%%')
        WHERE s.record_status = 'published' 
          AND (s.category = ANY($1) OR m.id IS NOT NULL)
        ORDER BY is_core DESC, s.name ASC
        LIMIT 25
      `, [mappedCategories, `%${degreeStr}%`, `%${specStr}%`, `%${primaryKeywords}%`]);
      
      for (const sk of catMatch.rows) {
        // When a target career goal exists, education skills are strictly supporting/transferable
        // When no career goal exists, education core skills can be highlighted as direct
        const rel = matchedCareer ? 'supporting' : (sk.is_core ? 'direct' : 'supporting');
        const isCore = matchedCareer ? false : !!sk.is_core;

        rawSkills.push({
          ...sk,
          ai_source: null,
          relationship: rel,
          is_core: isCore
        });
      }
    }

    // Fallback search if DB returned very few skills
    if (rawSkills.length < 5 && searchKeywords.length > 0) {
      const fallbackMatches = await pool.query(`
        SELECT id, name, category, origin, verification_status, description 
        FROM skills 
        WHERE record_status = 'published' AND (${searchKeywords.map((w,i) => `name ILIKE $${i+1} OR category ILIKE $${i+1}`).join(' OR ')}) 
        LIMIT 15
      `, searchKeywords.map(w => `%${w}%`));
      
      for (const fs of fallbackMatches.rows) {
        rawSkills.push({ ...fs, ai_source: null, relationship: 'supporting', is_core: false });
      }
    }
    
    let deduplicatedResponse = deduplicateSkills(rawSkills, userSelectedSkillIds);

    const knownSkillsRes = await pool.query(`SELECT name FROM skills WHERE record_status = 'published' LIMIT 500`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s wait

    let aiRes;
    try {
      const payload = { 
        query: activeEducation,
        education: activeEducation,
        career_goal: matchedCareer?.title || activeCareerGoal,
        limit: limit || 15, 
        known_skills: knownSkillsRes.rows.map(r => r.name),
        profile: profile
      };
      
      aiRes = await fetch(`${env.AI_SERVICE_URL}/internal/v1/skills/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timeout);
    }
    clearTimeout(timeout);

    if (!aiRes || !aiRes.ok) {
      return res.json({ data: deduplicatedResponse, status: 'db_fallback' });
    }

    const aiData = await aiRes.json();
    
    if (aiData.skills && Array.isArray(aiData.skills)) {
      for (const sk of aiData.skills) {
        const targetName = sk.matches_catalogue_skill || sk.name;
        if (!targetName || typeof targetName !== 'string') continue;
        
        let dbSkill = await pool.query(`SELECT id, name, category, origin, verification_status, description FROM skills WHERE name ILIKE $1 LIMIT 1`, [targetName]);
        
        if (dbSkill.rows.length > 0) {
          rawSkills.push({
            ...dbSkill.rows[0],
            ai_source: sk.source,
            relationship: 'supporting',
            is_core: false
          });
        }
      }
      deduplicatedResponse = deduplicateSkills(rawSkills, userSelectedSkillIds);
    }

    return res.json({ data: deduplicatedResponse, status: aiData.status || 'ai_supplemented' });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: e.errors } });
    }
    next(e);
  }
});

export default router;
