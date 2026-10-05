import { Router } from 'express';
import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { z } from 'zod';

const router = Router();
const suggestSchema = z.object({
  query: z.string().min(1).max(120),
  limit: z.number().int().min(1).max(20).optional()
});
router.get('/', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const queryStr = `SELECT id, name, description, category, origin, verification_status FROM skills WHERE record_status = 'published' AND ($1 = '' OR name ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%' OR category ILIKE '%' || $1 || '%') ORDER BY name, id LIMIT $2 OFFSET $3`;
    const countQuery = `SELECT count(*) FROM skills WHERE record_status = 'published' AND ($1 = '' OR name ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%' OR category ILIKE '%' || $1 || '%')`;

    const [result, countRes] = await Promise.all([
      pool.query(queryStr, [search, limit, offset]),
      pool.query(countQuery, [search])
    ]);
    const total = parseInt(countRes.rows[0].count, 10);

    res.json({ data: result.rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
});

router.post('/suggest', authenticate, async (req, res, next) => {
  try {
    const { query, limit } = suggestSchema.parse(req.body);
    
    // DB matching first
    const dbSearch = `%${query}%`;
    const dbMatch = await pool.query(`SELECT id, name, category, origin, verification_status, description FROM skills WHERE record_status = 'published' AND (name ILIKE $1 OR category ILIKE $1 OR description ILIKE $1) LIMIT 10`, [dbSearch]);
    
    const responseSkills = dbMatch.rows.map(sk => ({
      ...sk,
      ai_source: null
    }));
    
    const knownSkillsRes = await pool.query(`SELECT name FROM skills WHERE record_status = 'published' LIMIT 200`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s wait

    let aiRes;
    try {
      aiRes = await fetch(`${env.AI_SERVICE_URL}/internal/v1/skills/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN
        },
        body: JSON.stringify({ query, limit: limit || 10, known_skills: knownSkillsRes.rows.map(r => r.name) }),
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timeout);
    }
    clearTimeout(timeout);

    if (!aiRes || !aiRes.ok) {
      if (responseSkills.length === 0) {
        const words = query.split(/[\s,]+/).filter(w => w.length > 2);
        if (words.length > 0) {
          const fallbackMatches = await pool.query(`SELECT id, name, category, origin, verification_status, description FROM skills WHERE record_status = 'published' AND (${words.map((w,i) => `name ILIKE $${i+1} OR category ILIKE $${i+1}`).join(' OR ')}) LIMIT 10`, words.map(w => `%${w}%`));
          responseSkills.push(...fallbackMatches.rows.map(sk => ({ ...sk, ai_source: null })));
        }
        if (responseSkills.length === 0) {
          const genericMatches = await pool.query(`SELECT id, name, category, origin, verification_status, description FROM skills WHERE record_status = 'published' LIMIT 15`);
          responseSkills.push(...genericMatches.rows.map(sk => ({ ...sk, ai_source: null })));
        }
      }
      return res.json({ data: responseSkills, status: 'db_fallback' });
    }

    const aiData = await aiRes.json();
    
    if (aiData.skills && Array.isArray(aiData.skills)) {
      for (const sk of aiData.skills) {
        const targetName = sk.matches_catalogue_skill || sk.name;
        if (!targetName || typeof targetName !== 'string') continue;
        
        if (responseSkills.some(s => s.name.toLowerCase() === targetName.toLowerCase())) continue;
        
        let dbSkill = await pool.query(`SELECT id, name, category, origin, verification_status FROM skills WHERE name ILIKE $1`, [targetName]);
        
        if (dbSkill.rows.length > 0) {
           responseSkills.push({
             ...dbSkill.rows[0],
             ai_source: sk.source
           });
        } else {
           import('../../utils/logger.js').then(({ logger }) =>
             logger.debug('[AI Suggestion] Omitted unresolvable skill', { skillName: targetName })
           ).catch(() => {});
        }
      }
    }

    return res.json({ data: responseSkills, status: aiData.status });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: e.errors } });
    }
    next(e);
  }
});

export default router;
