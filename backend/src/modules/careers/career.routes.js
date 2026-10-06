import { Router } from 'express';
import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { exploreRateLimit } from './exploreRateLimit.js';
import { z } from 'zod';

const router = Router();
const inFlightExplores = new Map();
const exploreSchema = z.object({
  query: z.string().min(1).max(120)
});
function normalizeString(str) { return str.toLowerCase().replace(/[^a-z0-9+#]/g, ''); }
function pagination(req) {
  const page = Math.max(1, Number.parseInt(req.query.page ?? '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit ?? '20', 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

router.get('/', async (req, res, next) => {
  try {
    const { page, limit, offset } = pagination(req);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const values = [search];
    const where = `WHERE c.record_status = 'published' AND ($1 = '' OR c.title ILIKE '%' || $1 || '%' OR c.description ILIKE '%' || $1 || '%')`;
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM careers c ${where}`, values);
    values.push(limit, offset);
    const result = await pool.query(
      `SELECT c.id, c.title, c.description, c.responsibilities, c.qualifications, c.entry_routes,
              c.verification_status, c.origin, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
       FROM careers c ${where} ORDER BY c.title ASC LIMIT $2 OFFSET $3`, values
    );
    const total = count.rows[0].total;
    res.json({ data: result.rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
  } catch (e) { next(e); }
});

router.get('/:careerId', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.description, c.responsibilities, c.qualifications, c.entry_routes,
              c.verification_status, c.origin, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
       FROM careers c WHERE c.id = $1 AND c.record_status = 'published'`, [req.params.careerId]
    );
    
    let career;
    if (!result.rows[0]) {
      const aiResult = await pool.query(
        `SELECT id, id as ai_career_id, title, description, responsibilities, qualifications, entry_routes,
                status as verification_status, 'ai_generated' as origin
         FROM ai_career_profiles WHERE id = $1 AND status <> 'archived'`, [req.params.careerId]
      );
      if (!aiResult.rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Career not found.' } });
      career = aiResult.rows[0];
    } else {
      career = result.rows[0];
    }

    // Check if enriched
    const enrichRes = await pool.query(
      `SELECT description, key_information, responsibilities, qualifications, generated_by
       FROM career_enrichments WHERE career_id = $1`, [career.id]
    );

    if (enrichRes.rows.length > 0) {
      const enrich = enrichRes.rows[0];
      career.description = enrich.description;
      career.keyInformation = enrich.key_information;
      career.responsibilities = enrich.responsibilities;
      career.qualifications = enrich.qualifications;
      career.contentSource = { base: 'database', enriched: true, generated_by: enrich.generated_by };
      return res.json({ data: career });
    }

    // Call AI if not enriched
    const skillsRes = await pool.query(`SELECT s.name FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1`, [career.id]);
    const skills = skillsRes.rows.map(r => r.name);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const aiRes = await fetch(`${env.AI_SERVICE_URL}/internal/v1/careers/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN },
        body: JSON.stringify({
          career: { id: career.id, title: career.title, description: career.description },
          responsibilities: career.responsibilities,
          qualifications: career.qualifications,
          entry_routes: career.entry_routes,
          skills
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        if (aiData.status === 'ai_generated' && aiData.enrichment) {
           const e = aiData.enrichment;
           await pool.query(
             `INSERT INTO career_enrichments (career_id, description, key_information, responsibilities, qualifications)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (career_id) DO NOTHING`,
             [career.id, e.description, JSON.stringify(e.key_information), JSON.stringify(e.responsibilities), JSON.stringify(e.qualifications)]
           );
           
           career.description = e.description;
           career.keyInformation = e.key_information;
           career.responsibilities = e.responsibilities;
           career.qualifications = e.qualifications;
           career.contentSource = { base: 'database', enriched: true, generated_by: 'ai_service' };
        } else {
           career.contentSource = { base: 'database', enriched: false };
        }
      } else {
         career.contentSource = { base: 'database', enriched: false };
      }
    } catch (err) {
      console.error('[AI Enrichment]', err);
      career.contentSource = { base: 'database', enriched: false };
    }

    res.json({ data: career });
  } catch (e) { next(e); }
});

router.get('/:careerId/skills', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT s.id, s.name, s.description, cs.importance, cs.origin, cs.verification_status FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1 AND s.record_status = 'published' ORDER BY CASE cs.importance WHEN 'required' THEN 1 WHEN 'important' THEN 2 ELSE 3 END, s.name`, [req.params.careerId]);
    
    if (result.rows.length === 0) {
      const aiResult = await pool.query(`SELECT required_skills FROM ai_career_profiles WHERE id = $1`, [req.params.careerId]);
      if (aiResult.rows.length > 0 && Array.isArray(aiResult.rows[0].required_skills) && aiResult.rows[0].required_skills.length > 0) {
        const mappedSkills = aiResult.rows[0].required_skills.map((s, index) => ({
          id: `ai-skill-fallback-${index}`,
          name: s.name,
          description: null,
          importance: s.importance || 'useful',
          origin: 'ai_generated',
          verification_status: 'unverified'
        })).sort((a, b) => {
          const w = { 'required': 1, 'important': 2, 'useful': 3 };
          return (w[a.importance] || 3) - (w[b.importance] || 3) || a.name.localeCompare(b.name);
        });
        return res.json({ data: mappedSkills });
      }
    }
    
    res.json({ data: result.rows });
  } catch (e) { next(e); }
});

router.get('/:careerId/courses', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT 
        c2.id AS "courseId", 
        c2.title AS "courseName", 
        c2.qualification AS "level", 
        c2.duration_text AS "duration", 
        i.id AS "institutionId", 
        i.name AS "institutionName", 
        i.location AS "location", 
        i.website_url AS "officialWebsite"
      FROM courses c1
      JOIN courses c2 ON (
        c1.title ILIKE c2.title OR 
        c1.subject ILIKE c2.title OR 
        c1.title ILIKE c2.subject OR 
        (c1.subject IS NOT NULL AND c2.subject IS NOT NULL AND c1.subject ILIKE c2.subject)
      )
      JOIN institutions i ON i.id = c2.institution_id 
      WHERE c2.record_status = 'published' AND (
        EXISTS (SELECT 1 FROM course_careers cc WHERE cc.course_id = c1.id AND cc.career_id = $1)
        OR EXISTS (
          SELECT 1 FROM careers cr, jsonb_array_elements_text(cr.qualifications) q
          WHERE cr.id = $1 AND (c1.title ILIKE q OR q ILIKE c1.title OR c1.subject ILIKE q OR q ILIKE c1.subject)
        )
        OR EXISTS (
          SELECT 1 FROM ai_career_profiles ai, jsonb_array_elements_text(ai.qualifications) q
          WHERE ai.id = $1 AND (c1.title ILIKE q OR q ILIKE c1.title OR c1.subject ILIKE q OR q ILIKE c1.subject)
        )
      )
      ORDER BY c2.title, i.name
    `, [req.params.careerId]);
    res.json({ data: result.rows });
  } catch (e) { next(e); }
});

router.get('/:careerId/pathways', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT p.id, p.title, p.description, p.record_status, p.verification_status, p.origin, p.source_url, p.verified_at FROM pathways p WHERE p.career_id = $1 AND p.record_status = 'published' ORDER BY p.title`, [req.params.careerId]);
    res.json({ data: result.rows });
  } catch (e) { next(e); }
});

router.get('/:careerId/opportunities', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT o.id, o.title, o.organization, o.location, o.opportunity_type, o.status, o.application_deadline, o.verification_status, o.source_url, o.verified_at FROM career_opportunities co JOIN opportunities o ON o.id = co.opportunity_id WHERE co.career_id = $1 AND o.record_status = 'published' ORDER BY o.application_deadline NULLS LAST, o.title`, [req.params.careerId]);
    res.json({ data: result.rows });
  } catch (e) { next(e); }
});

router.get('/:careerId/related', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT DISTINCT c2.id, c2.title, c2.description FROM career_skills cs1 JOIN career_skills cs2 ON cs1.skill_id = cs2.skill_id AND cs2.career_id <> cs1.career_id JOIN careers c2 ON c2.id = cs2.career_id WHERE cs1.career_id = $1 AND c2.record_status = 'published' ORDER BY c2.title LIMIT 20`, [req.params.careerId]);
    res.json({ data: result.rows });
  } catch (e) { next(e); }
});

router.get('/:careerId/sources', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT se.field_name, sd.source_url, sd.document_url AS source_document_url, se.evidence_text, se.reference_locator, se.review_status, se.created_at FROM source_evidence se JOIN source_documents sd ON sd.id = se.source_document_id WHERE se.entity_type = 'career' AND se.entity_id = $1 ORDER BY se.created_at DESC`, [req.params.careerId]);
    res.json({ data: result.rows });
  } catch (e) { next(e); }
});

router.post('/explore', authenticate, exploreRateLimit, async (req, res, next) => {
  try {
    const { query } = exploreSchema.parse(req.body);
    
    // 1. Search DB first
    const dbHit = await pool.query(
      `SELECT c.id, c.title, c.description, c.responsibilities, c.qualifications, c.entry_routes,
              c.verification_status, c.origin, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
       FROM careers c WHERE c.record_status = 'published' AND c.title ILIKE $1 LIMIT 1`,
      [query]
    );
    if (dbHit.rows.length > 0) {
      return res.json({ data: dbHit.rows[0] });
    }

    const normalizedQuery = normalizeString(query);
    const aiDbHit = await pool.query(
      `SELECT id as ai_career_id, title, description, responsibilities, qualifications, entry_routes,
              required_skills, related_careers, goa_relevance, status, pathway_draft
       FROM ai_career_profiles WHERE status <> 'archived' AND (normalized_title = $1 OR title ILIKE $2) LIMIT 1`,
      [normalizedQuery, query]
    );
    if (aiDbHit.rows.length > 0) {
       return res.json({
         data: {
           ...aiDbHit.rows[0],
           origin: 'ai_generated',
           verified: false,
           disclaimer: 'This career was generated by AI and has not been verified.'
         }
       });
    }

    // 2. Call AI service
    if (inFlightExplores.has(normalizedQuery)) {
      try {
        const resultData = await inFlightExplores.get(normalizedQuery);
        return res.json(resultData);
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: { code: e.code, message: e.message } });
        throw e;
      }
    }

    const genPromise = (async () => {
      const knownCareersRes = await pool.query(`SELECT id, title FROM careers WHERE record_status = 'published' LIMIT 60`);
      const knownSkillsRes = await pool.query(`SELECT name FROM skills WHERE record_status = 'published' LIMIT 200`);
      const userSkillsRes = await pool.query(`SELECT s.name FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = $1`, [req.user.id]);
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      
      let aiRes;
      try {
        aiRes = await fetch(`${env.AI_SERVICE_URL}/internal/v1/careers/explore`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN
          },
          body: JSON.stringify({
            query,
            known_careers: knownCareersRes.rows,
            known_skills: knownSkillsRes.rows.map(r => r.name),
            user_skill_names: [
               ...userSkillsRes.rows.map(r => r.name),
               ...(await pool.query(`SELECT name FROM user_custom_skills WHERE user_id = $1`, [req.user.id])).rows.map(r => r.name)
            ]
          }),
          signal: controller.signal
        });
      } catch (err) {
        clearTimeout(timeout);
        console.error('[AI] Fetch error in /careers/explore:', err);
        const error = new Error('The AI service is currently unavailable.');
        error.status = 503; error.code = 'AI_UNAVAILABLE';
        throw error;
      }
      clearTimeout(timeout);

      if (!aiRes.ok) {
        const body = await aiRes.text();
        console.error(`[AI] AI service returned HTTP ${aiRes.status}:`, body);
        const error = new Error('The AI service returned an error.');
        error.status = 503; error.code = 'AI_UNAVAILABLE';
        throw error;
      }

      const aiData = await aiRes.json();
      if (aiData.status === 'not_a_career') {
        return { status: 'not_a_career', reason: aiData.reason };
      }
      if (aiData.status === 'unavailable') {
        const error = new Error('AI generation is currently unavailable.');
        error.status = 503; error.code = 'AI_UNAVAILABLE';
        throw error;
      }
      if (aiData.status === 'catalogue_match' && aiData.matched_catalogue) {
        const matchDb = await pool.query(
          `SELECT c.id, c.title, c.description, c.responsibilities, c.qualifications, c.entry_routes,
                  c.verification_status, c.origin, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
           FROM careers c WHERE c.id = $1`,
          [aiData.matched_catalogue.career_id]
        );
        if (matchDb.rows[0]) return { data: matchDb.rows[0] };
      }

      if (aiData.status === 'ai_generated' && aiData.career) {
         const aiCareerSchema = z.object({
            title: z.string().max(80),
            description: z.string().max(520),
            responsibilities: z.array(z.string()).max(5),
            qualifications: z.array(z.string()).max(4),
            entry_routes: z.array(z.string()).max(4),
            required_skills: z.array(z.object({ name: z.string(), importance: z.string() })).min(3).max(10),
            related_careers: z.array(z.string()).max(4).optional().default([]),
            goa_relevance: z.string().max(300).optional().nullable()
         });
         
         const validData = aiCareerSchema.parse(aiData.career);
         const generatedNormalizedTitle = normalizeString(validData.title);
         
         let finalAiCareer;
         const client = await pool.connect();
         try {
           await client.query('BEGIN');
           const exist = await client.query(
             `SELECT id as ai_career_id, title, description, responsibilities, qualifications, entry_routes,
                     required_skills, related_careers, goa_relevance, status, pathway_draft
              FROM ai_career_profiles WHERE normalized_title = $1`,
             [generatedNormalizedTitle]
           );
           if (exist.rows.length > 0) {
             finalAiCareer = exist.rows[0];
           } else {
             const cRes = await client.query(
               `INSERT INTO careers (title, description, responsibilities, qualifications, entry_routes, origin, verification_status, record_status)
                VALUES ($1, $2, $3, $4, $5, 'ai_generated', 'unverified', 'published')
                RETURNING id`,
               [validData.title, validData.description, JSON.stringify(validData.responsibilities), JSON.stringify(validData.qualifications), JSON.stringify(validData.entry_routes)]
             );
             const cId = cRes.rows[0].id;

             await client.query(
               `INSERT INTO ai_career_profiles (id, title, normalized_title, description, responsibilities, qualifications, entry_routes, required_skills, related_careers, goa_relevance)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
               [cId, validData.title, generatedNormalizedTitle, validData.description, JSON.stringify(validData.responsibilities), JSON.stringify(validData.qualifications), JSON.stringify(validData.entry_routes), JSON.stringify(validData.required_skills), JSON.stringify(validData.related_careers), validData.goa_relevance]
             );

             for (const sk of validData.required_skills) {
                const normSkill = normalizeString(sk.name);
                if (!normSkill) continue;
                let skId;
                const skRes = await client.query(`SELECT id FROM skills WHERE name ILIKE $1 AND record_status = 'published'`, [sk.name]);
                if (skRes.rows.length > 0) {
                    skId = skRes.rows[0].id;
                } else {
                    const newSk = await client.query(
                      `INSERT INTO skills (name, description, origin, verification_status, record_status) VALUES ($1, $2, 'ai_generated', 'unverified', 'published') RETURNING id`, 
                      [sk.name, 'AI generated skill']
                    );
                    skId = newSk.rows[0].id;
                }
                const validImportance = ['required', 'important', 'useful'].includes(sk.importance?.toLowerCase()) ? sk.importance.toLowerCase() : 'useful';
                await client.query(
                  `INSERT INTO career_skills (career_id, skill_id, importance, origin, verification_status) VALUES ($1, $2, $3, 'ai_generated', 'unverified') ON CONFLICT (career_id, skill_id) DO NOTHING`, 
                  [cId, skId, validImportance]
                );
             }

             const inserted = await client.query(
               `SELECT id as ai_career_id, title, description, responsibilities, qualifications, entry_routes,
                       required_skills, related_careers, goa_relevance, status, pathway_draft
                FROM ai_career_profiles WHERE id = $1`,
               [cId]
             );
             finalAiCareer = inserted.rows[0];
           }
           await client.query('COMMIT');
         } catch (e) {
           await client.query('ROLLBACK');
           throw e;
         } finally {
           client.release();
         }
         
         return {
           data: {
             ...finalAiCareer,
             origin: 'ai_generated',
             verified: false,
             disclaimer: 'This career was generated by AI and has not been verified.'
           }
         };
      }

      const error = new Error('Unexpected AI response status');
      error.status = 500; error.code = 'UNKNOWN_ERROR';
      throw error;
    })();

    inFlightExplores.set(normalizedQuery, genPromise);
    try {
      const resultData = await genPromise;
      return res.json(resultData);
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: { code: e.code, message: e.message } });
      throw e;
    } finally {
      inFlightExplores.delete(normalizedQuery);
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: e.errors } });
    }
    next(e);
  }
});

export default router;
