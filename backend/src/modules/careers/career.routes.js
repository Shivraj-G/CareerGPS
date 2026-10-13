import crypto from 'crypto';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { exploreRateLimit } from './exploreRateLimit.js';
import { z } from 'zod';
import {
  classifyDomain,
  areDomainsCompatible,
  getProgressionLadder,
  getRegulatoryAndQualificationGuidance,
  scoreAndRankRelatedCareers
} from './occupational-engine.js';
import { enrichCareerSkillsList } from '../skills/skill-learning-engine.js';
import { getUserSkills } from '../skills/skill-intelligence.service.js';

const router = Router();
const inFlightExplores = new Map();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const exploreSchema = z.object({
  query: z.string().optional(),
  search: z.string().optional(),
  goal: z.string().optional()
}).refine(data => {
  const term = (data.query || data.search || data.goal || '').trim();
  return term.length > 0 && term.length <= 150;
}, {
  message: 'Search query must be between 1 and 150 characters'
}).transform(data => ({
  query: (data.query || data.search || data.goal || '').trim()
}));

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
    const where = `WHERE c.record_status IN ('published', 'needs_review') AND ($1 = '' OR c.title ILIKE '%' || $1 || '%' OR c.description ILIKE '%' || $1 || '%')`;
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
    if (!UUID_REGEX.test(req.params.careerId)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Career not found.' } });
    }
    const result = await pool.query(
      `SELECT c.id, c.title, c.description, c.responsibilities, c.qualifications, c.entry_routes,
              c.verification_status, c.origin, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
       FROM careers c WHERE c.id = $1 AND c.record_status IN ('published', 'needs_review')`, [req.params.careerId]
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

    let isEnriched = false;
    if (enrichRes.rows.length > 0) {
      const enrich = enrichRes.rows[0];
      career.description = enrich.description;
      career.keyInformation = enrich.key_information;
      career.responsibilities = enrich.responsibilities;
      career.qualifications = enrich.qualifications;
      career.contentSource = {
        base: 'database',
        enriched: true,
        generated_by: enrich.generated_by,
        is_official_curated: career.origin !== 'ai_generated' && career.verification_status === 'verified'
      };
      isEnriched = true;
    }

    // Retrieve skills for domain intelligence
    const skillsRes = await pool.query(
      `SELECT s.name FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1 AND s.record_status IN ('published', 'needs_review')`,
      [career.id]
    );
    let skills = skillsRes.rows.map(r => r.name);
    if (skills.length === 0 && Array.isArray(career.required_skills)) {
      skills = career.required_skills.map(s => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean);
    }

    if (!isEnriched) {
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
    }

    // Attach domain intelligence, realistic progression ladder, and regulatory guidance
    const domainInfo = classifyDomain(career.title, career.description, skills);
    career.domainInfo = domainInfo;
    career.progressionLadder = getProgressionLadder(career.title, domainInfo.topDomain);
    career.regulatoryGuidance = getRegulatoryAndQualificationGuidance(
      career.title,
      domainInfo.topDomain,
      career.qualifications,
      career.entry_routes || career.entryRoutes
    );

    res.json({ data: career });
  } catch (e) { next(e); }
});

router.get('/:careerId/skills', async (req, res, next) => {
  try {
    const careerId = req.params.careerId;

    // 1. Optional user authentication for profile personalization
    let userId = null;
    let userSkills = [];
    let customSkills = [];
    let userProfile = {};

    const authHeader = req.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7).trim();
        const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
        if (payload?.sub) {
          userId = payload.sub;
          const [uSkills, cSkillsRes, pRes] = await Promise.all([
            getUserSkills(userId),
            pool.query(`SELECT id, name, level FROM user_custom_skills WHERE user_id = $1 ORDER BY name`, [userId]),
            pool.query(`SELECT career_goal, education, experience, current_goal, interests FROM user_profiles WHERE user_id = $1`, [userId])
          ]);
          userSkills = uSkills || [];
          customSkills = cSkillsRes.rows || [];
          userProfile = pRes.rows[0] || {};
        }
      } catch {
        // Non-fatal if token invalid or expired; proceed with public view
      }
    }

    // 2. Fetch career context
    let career = null;
    const careerRes = await pool.query(
      `SELECT id, title, description FROM careers WHERE id = $1 AND record_status IN ('published', 'needs_review')`,
      [careerId]
    );
    if (careerRes.rows[0]) {
      career = careerRes.rows[0];
    } else {
      const aiRes = await pool.query(
        `SELECT id, title, description FROM ai_career_profiles WHERE id = $1 AND status <> 'archived'`,
        [careerId]
      );
      career = aiRes.rows[0] || { id: careerId, title: 'Career Guide' };
    }

    // 3. Retrieve skills from career_skills
    const result = await pool.query(
      `SELECT s.id, s.name, s.description, s.learning_level, s.learning_metadata,
              cs.importance, cs.origin, cs.verification_status
       FROM career_skills cs
       JOIN skills s ON s.id = cs.skill_id
       WHERE cs.career_id = $1 AND s.record_status IN ('published', 'needs_review')
       ORDER BY CASE cs.importance WHEN 'required' THEN 1 WHEN 'important' THEN 2 ELSE 3 END, s.name`,
      [careerId]
    );

    let rawSkills = result.rows;

    // Fallback if no skills mapped in career_skills
    if (rawSkills.length === 0) {
      const aiResult = await pool.query(
        `SELECT required_skills FROM ai_career_profiles WHERE id = $1`,
        [careerId]
      );
      if (aiResult.rows.length > 0 && Array.isArray(aiResult.rows[0].required_skills) && aiResult.rows[0].required_skills.length > 0) {
        rawSkills = aiResult.rows[0].required_skills.map((s, index) => ({
          id: `ai-skill-fallback-${index}`,
          name: s.name,
          description: null,
          importance: s.importance || 'useful',
          origin: 'ai_generated',
          verification_status: 'unverified'
        }));
      } else {
        // Query domain-compatible skills from skills table based on career title/domain
        const domainClassification = classifyDomain(career.title, career.description || '', []);
        const domain = domainClassification.topDomain;
        
        let domainQuery = `SELECT id, name, description, learning_level, learning_metadata, 'important' as importance, 'curated' as origin, 'verified' as verification_status FROM skills WHERE record_status IN ('published', 'needs_review')`;
        let domainParams = [];

        if (domain === 'healthcare') {
          domainQuery += ` AND (name ILIKE '%clinical%' OR name ILIKE '%anatomy%' OR name ILIKE '%physiology%' OR name ILIKE '%medical%') LIMIT 8`;
        } else if (domain === 'education') {
          domainQuery += ` AND (name ILIKE '%teach%' OR name ILIKE '%curriculum%' OR name ILIKE '%education%' OR name ILIKE '%pedagogy%' OR name ILIKE '%communication%') LIMIT 8`;
        } else if (domain === 'law_public_safety') {
          domainQuery += ` AND (name ILIKE '%law%' OR name ILIKE '%fitness%' OR name ILIKE '%communication%' OR name ILIKE '%problem solving%') LIMIT 8`;
        } else if (domain === 'finance_business') {
          domainQuery += ` AND (name ILIKE '%accounting%' OR name ILIKE '%excel%' OR name ILIKE '%finance%' OR name ILIKE '%business%') LIMIT 8`;
        } else {
          // General fallback: never return AI Engineer specific tech skills like RAG / LLM Concepts
          domainQuery += ` AND name IN ('Problem Solving', 'Communication', 'Teamwork', 'Critical Thinking', 'Presentation Skills') LIMIT 6`;
        }

        const fallbackDomainSkills = await pool.query(domainQuery, domainParams);
        rawSkills = fallbackDomainSkills.rows;
      }
    }

    // 4. Enrich skills using the 3-level learning engine
    const enrichedResult = enrichCareerSkillsList({
      skills: rawSkills,
      career: career,
      userSkills,
      customSkills,
      userProfile
    });

    res.json({
      data: enrichedResult.skills,
      summary: enrichedResult.summary
    });
  } catch (e) {
    next(e);
  }
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
      WHERE c2.record_status IN ('published', 'needs_review') AND (
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
    const result = await pool.query(`
      SELECT p.id, p.title, p.description, p.record_status, p.verification_status, p.origin, p.source_url, p.verified_at,
             COALESCE(
               (SELECT jsonb_agg(jsonb_build_object('order', ps.step_order, 'title', ps.title)) 
                FROM pathway_steps ps WHERE ps.pathway_id = p.id), '[]'::jsonb
             ) AS steps
      FROM pathways p 
      WHERE p.career_id = $1 
        AND p.record_status != 'archived'
        AND p.pathway_type = 'template'
      ORDER BY CASE WHEN p.record_status = 'published' THEN 0 ELSE 1 END, p.title
    `, [req.params.careerId]);

    const distinct = [];
    const seenTitles = new Set();
    const seenStepSignatures = new Set();

    for (const pw of result.rows) {
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

    res.json({ data: distinct });
  } catch (e) { next(e); }
});

router.get('/:careerId/opportunities', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT o.id, o.title, o.organization, o.location, o.opportunity_type, o.status, o.application_deadline, o.verification_status, o.source_url, o.verified_at FROM career_opportunities co JOIN opportunities o ON o.id = co.opportunity_id WHERE co.career_id = $1 AND o.record_status IN ('published', 'needs_review') ORDER BY o.application_deadline NULLS LAST, o.title`, [req.params.careerId]);
    res.json({ data: result.rows });
  } catch (e) { next(e); }
});

router.get('/:careerId/related', async (req, res, next) => {
  try {
    const careerId = req.params.careerId;
    const { page, limit, offset } = pagination(req);

    // Optional user authentication for personalized match
    let userId = null;
    const authHeader = req.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7).trim();
        const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
        if (payload?.sub) userId = payload.sub;
      } catch {
        // Non-blocking for unauthenticated visitors
      }
    }

    // 1. Identify source career
    let srcRes = await pool.query(
      `SELECT id, title, description FROM careers WHERE id = $1 AND record_status IN ('published', 'needs_review')`,
      [careerId]
    );
    let srcCareer = srcRes.rows[0];
    let isAiSource = false;
    if (!srcCareer) {
      const aiSrc = await pool.query(`SELECT id, title, description, required_skills FROM ai_career_profiles WHERE id = $1 AND status <> 'archived'`, [careerId]);
      if (aiSrc.rows[0]) {
        srcCareer = aiSrc.rows[0];
        isAiSource = true;
      }
    }
    if (!srcCareer) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Career not found.' } });
    }

    // 2. Retrieve source skills
    let srcSkills = [];
    if (!isAiSource) {
      const srcSkillsRes = await pool.query(
        `SELECT s.id, s.name, cs.importance 
         FROM career_skills cs 
         JOIN skills s ON s.id = cs.skill_id 
         WHERE cs.career_id = $1 AND s.record_status IN ('published', 'needs_review')`,
        [careerId]
      );
      srcSkills = srcSkillsRes.rows;
    } else if (Array.isArray(srcCareer.required_skills)) {
      srcSkills = srcCareer.required_skills;
    }
    srcCareer.skills = srcSkills;

    // 3. User skills if authenticated
    let userSkillNames = new Set();
    let userSkillIds = new Set();
    if (userId) {
      const [uSkills, uCustom] = await Promise.all([
        pool.query(`SELECT s.id, s.name FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = $1`, [userId]),
        pool.query(`SELECT name FROM user_custom_skills WHERE user_id = $1`, [userId])
      ]);
      for (const r of uSkills.rows) {
        userSkillIds.add(r.id);
        userSkillNames.add(normalizeString(r.name));
      }
      for (const r of uCustom.rows) {
        userSkillNames.add(normalizeString(r.name));
      }
    }

    // 4. Candidate careers from PostgreSQL
    const candidatesRes = await pool.query(`
      SELECT c.id, c.title, c.description, c.verification_status, c.origin,
             json_agg(
               json_build_object(
                 'id', s.id,
                 'name', s.name,
                 'importance', cs.importance
               )
             ) FILTER (WHERE s.id IS NOT NULL) as skills
      FROM careers c
      LEFT JOIN career_skills cs ON cs.career_id = c.id
      LEFT JOIN skills s ON s.id = cs.skill_id AND s.record_status IN ('published', 'needs_review')
      WHERE c.id <> $1 AND c.record_status IN ('published', 'needs_review')
      GROUP BY c.id, c.title, c.description, c.verification_status, c.origin
    `, [careerId]);

    // Also include verified non-archived ai_career_profiles as potential candidates if they match real records
    const aiCandidates = await pool.query(`
      SELECT id, title, description, 'unverified' as verification_status, 'ai_generated' as origin,
             required_skills as skills
      FROM ai_career_profiles
      WHERE id <> $1 AND status <> 'archived'
    `, [careerId]);

    const allCandidates = [...candidatesRes.rows];
    const existingTitles = new Set(candidatesRes.rows.map(c => normalizeString(c.title)));
    for (const a of aiCandidates.rows) {
      if (!existingTitles.has(normalizeString(a.title))) {
        allCandidates.push(a);
        existingTitles.add(normalizeString(a.title));
      }
    }

    // 5. Score and rank using Occupational Relationship Engine
    const result = scoreAndRankRelatedCareers(srcCareer, allCandidates, {
      userId,
      userSkillIds,
      userSkillNames,
      limit,
      offset
    });

    res.json({
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        total_pages: Math.ceil(result.total / limit)
      },
      meta: result.meta
    });
  } catch (e) { next(e); }
});

router.get('/:careerId/sources', async (req, res, next) => {
  try {
    if (!UUID_REGEX.test(req.params.careerId)) {
      return res.json({ data: [] });
    }
    const result = await pool.query(
      `SELECT se.field_name, sd.source_url, sd.document_url AS source_document_url, se.evidence_text, se.reference_locator, se.review_status, se.created_at 
       FROM source_evidence se 
       JOIN source_documents sd ON sd.id = se.source_document_id 
       WHERE se.entity_type = 'career' AND se.entity_id = $1 
       ORDER BY se.created_at DESC`,
      [req.params.careerId]
    );
    res.json({ data: result.rows });
  } catch (e) { next(e); }
});

router.post('/explore', authenticate, exploreRateLimit, async (req, res, next) => {
  const correlationId = req.headers['x-request-id'] || req.id || req.requestId || crypto.randomUUID();
  try {
    const { query: rawQuery } = exploreSchema.parse(req.body);
    const query = rawQuery.trim();
    const normalizedQuery = normalizeString(query);

    // 1. Search DB first: exact or substring match in careers catalogue
    const dbHit = await pool.query(
      `SELECT c.id, c.title, c.description, c.responsibilities, c.qualifications, c.entry_routes,
              c.verification_status, c.origin, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
       FROM careers c 
       WHERE c.record_status IN ('published', 'needs_review') 
         AND (c.title ILIKE $1 OR c.title ILIKE '%' || $1 || '%' OR $1 ILIKE '%' || c.title || '%')
       ORDER BY 
         CASE WHEN c.title ILIKE $1 THEN 0 
              WHEN c.title ILIKE $1 || '%' THEN 1 
              ELSE 2 END,
         LENGTH(c.title) ASC
       LIMIT 1`,
      [query]
    );
    if (dbHit.rows.length > 0) {
      return res.json({ data: dbHit.rows[0] });
    }

    // 2. Search AI career profiles table for previous generations
    const aiDbHit = await pool.query(
      `SELECT id as ai_career_id, id, title, description, responsibilities, qualifications, entry_routes,
              required_skills, related_careers, goa_relevance, status, pathway_draft
       FROM ai_career_profiles 
       WHERE status <> 'archived' 
         AND (normalized_title = $1 OR title ILIKE $2 OR title ILIKE '%' || $2 || '%' OR $2 ILIKE '%' || title || '%')
       ORDER BY 
         CASE WHEN normalized_title = $1 THEN 0 
              WHEN title ILIKE $2 THEN 1 
              ELSE 2 END,
         LENGTH(title) ASC
       LIMIT 1`,
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

    // 3. Keyword/description match in published catalogue
    const keywordDbHit = await pool.query(
      `SELECT c.id, c.title, c.description, c.responsibilities, c.qualifications, c.entry_routes,
              c.verification_status, c.origin, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
       FROM careers c 
       WHERE c.record_status IN ('published', 'needs_review') 
         AND c.description ILIKE '%' || $1 || '%'
       LIMIT 1`,
      [query]
    );
    if (keywordDbHit.rows.length > 0) {
      return res.json({ data: keywordDbHit.rows[0] });
    }

    // 4. Call AI service with deduplication
    if (inFlightExplores.has(normalizedQuery)) {
      try {
        const resultData = await inFlightExplores.get(normalizedQuery);
        return res.json(resultData);
      } catch (e) {
        const status = e.statusCode || e.status || 500;
        return res.status(status).json({
          error: {
            code: e.code || 'AI_ERROR',
            message: e.message || 'Error processing career exploration.',
            correlation_id: correlationId
          }
        });
      }
    }

    const genPromise = (async () => {
      const knownCareersRes = await pool.query(`SELECT id, title FROM careers WHERE record_status IN ('published', 'needs_review') LIMIT 60`);
      const knownSkillsRes = await pool.query(`SELECT name FROM skills WHERE record_status IN ('published', 'needs_review') LIMIT 200`);
      const userSkillsRes = await pool.query(`SELECT s.name FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = $1`, [req.user.id]);
      
      const customSkillsRes = await pool.query(`SELECT name FROM user_custom_skills WHERE user_id = $1`, [req.user.id]).catch(() => ({ rows: [] }));

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
               ...customSkillsRes.rows.map(r => r.name)
            ]
          }),
          signal: controller.signal
        });
      } catch (err) {
        clearTimeout(timeout);
        console.error(`[AI][${correlationId}] Fetch error in /careers/explore:`, err.message);
        
        // Resilient fallback: check if any query keyword matches existing catalogue
        const tokens = query.split(/\s+/).filter(t => t.length > 2);
        for (const token of tokens) {
          const tokenHit = await pool.query(
            `SELECT c.id, c.title, c.description, c.responsibilities, c.qualifications, c.entry_routes,
                    c.verification_status, c.origin, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
             FROM careers c 
             WHERE c.record_status IN ('published', 'needs_review') 
               AND (c.title ILIKE '%' || $1 || '%' OR c.description ILIKE '%' || $1 || '%')
             LIMIT 1`,
            [token]
          ).catch(() => ({ rows: [] }));
          if (tokenHit.rows.length > 0) {
            return { data: tokenHit.rows[0] };
          }
        }
        const error = new Error('The AI career exploration service is currently unavailable. Please try again later.');
        error.status = 503;
        error.statusCode = 503;
        error.code = 'AI_UNAVAILABLE';
        throw error;
      }
      clearTimeout(timeout);

      if (!aiRes.ok) {
        const body = await aiRes.text().catch(() => '');
        console.error(`[AI][${correlationId}] AI service returned HTTP ${aiRes.status}:`, body);
        const tokens = query.split(/\s+/).filter(t => t.length > 2);
        for (const token of tokens) {
          const tokenHit = await pool.query(
            `SELECT c.id, c.title, c.description, c.responsibilities, c.qualifications, c.entry_routes,
                    c.verification_status, c.origin, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
             FROM careers c 
             WHERE c.record_status IN ('published', 'needs_review') 
               AND (c.title ILIKE '%' || $1 || '%' OR c.description ILIKE '%' || $1 || '%')
             LIMIT 1`,
            [token]
          ).catch(() => ({ rows: [] }));
          if (tokenHit.rows.length > 0) {
            return { data: tokenHit.rows[0] };
          }
        }
        const error = new Error('The AI career exploration service returned an error. Please try again later.');
        error.status = 503;
        error.statusCode = 503;
        error.code = 'AI_UNAVAILABLE';
        throw error;
      }

      const aiData = await aiRes.json();
      if (aiData.status === 'not_a_career') {
        return { status: 'not_a_career', reason: aiData.reason || 'This search term does not represent a recognized career.' };
      }
      if (aiData.status === 'unavailable') {
        const error = new Error(aiData.reason || 'AI generation is currently unavailable.');
        error.status = 503;
        error.statusCode = 503;
        error.code = 'AI_UNAVAILABLE';
        throw error;
      }
      if (aiData.status === 'catalogue_match' && aiData.matched_catalogue) {
        // Try to match by career_id first
        if (aiData.matched_catalogue.career_id) {
          const matchDb = await pool.query(
            `SELECT c.id, c.title, c.description, c.responsibilities, c.qualifications, c.entry_routes,
                    c.verification_status, c.origin, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
             FROM careers c WHERE c.id = $1 AND c.record_status IN ('published', 'needs_review')`,
            [aiData.matched_catalogue.career_id]
          ).catch(() => ({ rows: [] }));
          if (matchDb.rows[0]) return { data: matchDb.rows[0] };
        }
        // Fallback: match by title
        if (aiData.matched_catalogue.title) {
          const matchByTitle = await pool.query(
            `SELECT c.id, c.title, c.description, c.responsibilities, c.qualifications, c.entry_routes,
                    c.verification_status, c.origin, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
             FROM careers c WHERE c.title ILIKE $1 AND c.record_status IN ('published', 'needs_review') LIMIT 1`,
            [aiData.matched_catalogue.title]
          ).catch(() => ({ rows: [] }));
          if (matchByTitle.rows[0]) return { data: matchByTitle.rows[0] };
        }
      }

      if (aiData.status === 'ai_generated' && aiData.career) {
         const rawCareer = aiData.career;
         const title = typeof rawCareer.title === 'string' && rawCareer.title.trim() ? rawCareer.title.trim().slice(0, 100) : query;
         const description = typeof rawCareer.description === 'string' && rawCareer.description.trim() ? rawCareer.description.trim().slice(0, 1000) : `${title} career profile.`;
         const responsibilities = Array.isArray(rawCareer.responsibilities) ? rawCareer.responsibilities.slice(0, 8).map(String) : [];
         const qualifications = Array.isArray(rawCareer.qualifications) ? rawCareer.qualifications.slice(0, 6).map(String) : [];
         const entry_routes = Array.isArray(rawCareer.entry_routes) ? rawCareer.entry_routes.slice(0, 6).map(String) : [];
         const related_careers = Array.isArray(rawCareer.related_careers) ? rawCareer.related_careers.slice(0, 6).map(String) : [];
         const goa_relevance = typeof rawCareer.goa_relevance === 'string' ? rawCareer.goa_relevance.slice(0, 500) : null;
         const required_skills = Array.isArray(rawCareer.required_skills) 
           ? rawCareer.required_skills.filter(s => s && (s.name || typeof s === 'string')).slice(0, 12).map(s => ({
               name: String(s.name || s).trim(),
               importance: ['required', 'important', 'useful'].includes(String(s.importance || '').toLowerCase()) ? String(s.importance).toLowerCase() : 'important'
             }))
           : [];

         const generatedNormalizedTitle = normalizeString(title);
         
         let finalAiCareer;
         const client = await pool.connect();
         try {
           await client.query('BEGIN');
           const exist = await client.query(
             `SELECT id as ai_career_id, id, title, description, responsibilities, qualifications, entry_routes,
                     required_skills, related_careers, goa_relevance, status, pathway_draft
              FROM ai_career_profiles WHERE normalized_title = $1`,
             [generatedNormalizedTitle]
           );
           if (exist.rows.length > 0) {
             finalAiCareer = exist.rows[0];
           } else {
             // Check if career already exists in careers table
             let cId;
             const existingCareer = await client.query(
               `SELECT id FROM careers WHERE title ILIKE $1 LIMIT 1`,
               [title]
             );
             if (existingCareer.rows.length > 0) {
               cId = existingCareer.rows[0].id;
               await client.query(
                 `UPDATE careers SET record_status = 'published' WHERE id = $1`,
                 [cId]
               );
             } else {
               const cRes = await client.query(
                 `INSERT INTO careers (title, description, responsibilities, qualifications, entry_routes, origin, verification_status, record_status)
                  VALUES ($1, $2, $3, $4, $5, 'ai_generated', 'unverified', 'published')
                  ON CONFLICT (title) DO UPDATE SET record_status = 'published'
                  RETURNING id`,
                 [title, description, JSON.stringify(responsibilities), JSON.stringify(qualifications), JSON.stringify(entry_routes)]
               );
               cId = cRes.rows[0].id;
             }

             await client.query(
               `INSERT INTO ai_career_profiles (id, title, normalized_title, description, responsibilities, qualifications, entry_routes, required_skills, related_careers, goa_relevance)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (normalized_title) DO UPDATE SET
                  description = EXCLUDED.description,
                  responsibilities = EXCLUDED.responsibilities,
                  qualifications = EXCLUDED.qualifications,
                  entry_routes = EXCLUDED.entry_routes,
                  required_skills = EXCLUDED.required_skills,
                  related_careers = EXCLUDED.related_careers,
                  goa_relevance = EXCLUDED.goa_relevance`,
               [cId, title, generatedNormalizedTitle, description, JSON.stringify(responsibilities), JSON.stringify(qualifications), JSON.stringify(entry_routes), JSON.stringify(required_skills), JSON.stringify(related_careers), goa_relevance]
             );

             for (const sk of required_skills) {
                const normSkill = normalizeString(sk.name);
                if (!normSkill) continue;
                let skId;
                const skRes = await client.query(`SELECT id FROM skills WHERE name ILIKE $1 LIMIT 1`, [sk.name]);
                if (skRes.rows.length > 0) {
                    skId = skRes.rows[0].id;
                } else {
                    const newSk = await client.query(
                      `INSERT INTO skills (name, description, origin, verification_status, record_status)
                       VALUES ($1, $2, 'ai_generated', 'unverified', 'published')
                       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                       RETURNING id`, 
                      [sk.name, 'AI generated skill']
                    );
                    skId = newSk.rows[0].id;
                }
                const validImportance = ['required', 'important', 'useful'].includes(sk.importance) ? sk.importance : 'useful';
                await client.query(
                  `INSERT INTO career_skills (career_id, skill_id, importance, origin, verification_status)
                   VALUES ($1, $2, $3, 'ai_generated', 'unverified')
                   ON CONFLICT (career_id, skill_id) DO NOTHING`, 
                  [cId, skId, validImportance]
                );
             }

             const inserted = await client.query(
               `SELECT id as ai_career_id, id, title, description, responsibilities, qualifications, entry_routes,
                       required_skills, related_careers, goa_relevance, status, pathway_draft
                FROM ai_career_profiles WHERE id = $1`,
               [cId]
             );
             finalAiCareer = inserted.rows[0] || {
               ai_career_id: cId,
               id: cId,
               title,
               description,
               responsibilities,
               qualifications,
               entry_routes,
               required_skills,
               related_careers,
               goa_relevance,
               status: 'unverified'
             };
           }
           await client.query('COMMIT');
         } catch (e) {
           await client.query('ROLLBACK');
           console.error(`[AI][${correlationId}] Database transaction error during explore persistence:`, e.message);
           // Resilient in-memory return so the search never 500s on DB constraint anomalies
           finalAiCareer = {
             ai_career_id: crypto.randomUUID(),
             title,
             description,
             responsibilities,
             qualifications,
             entry_routes,
             required_skills,
             related_careers,
             goa_relevance,
             status: 'unverified'
           };
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

      // Check resilient keyword fallback before throwing
      const tokens = query.split(/\s+/).filter(t => t.length > 2);
      for (const token of tokens) {
        const tokenHit = await pool.query(
          `SELECT c.id, c.title, c.description, c.responsibilities, c.qualifications, c.entry_routes,
                  c.verification_status, c.origin, c.source_url, c.source_document_url, c.source_last_checked_at, c.verified_at
           FROM careers c 
           WHERE c.record_status IN ('published', 'needs_review') 
             AND (c.title ILIKE '%' || $1 || '%' OR c.description ILIKE '%' || $1 || '%')
           LIMIT 1`,
          [token]
        ).catch(() => ({ rows: [] }));
        if (tokenHit.rows.length > 0) {
          return { data: tokenHit.rows[0] };
        }
      }

      const error = new Error('The AI career exploration service is currently unavailable. Please try again later.');
      error.status = 503;
      error.statusCode = 503;
      error.code = 'AI_UNAVAILABLE';
      throw error;
    })();

    inFlightExplores.set(normalizedQuery, genPromise);
    try {
      const resultData = await genPromise;
      return res.json(resultData);
    } catch (e) {
      const status = e.statusCode || e.status || 503;
      const code = e.code || 'AI_UNAVAILABLE';
      return res.status(status).json({
        error: {
          code,
          message: e.message || 'The career exploration service could not process your request.',
          correlation_id: correlationId
        }
      });
    } finally {
      inFlightExplores.delete(normalizedQuery);
    }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid search input. Please enter a valid career title or keyword.',
          details: e.errors,
          correlation_id: correlationId
        }
      });
    }
    next(e);
  }
});

export default router;
