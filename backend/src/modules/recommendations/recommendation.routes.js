import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import {
  getDatabaseRecommendations,
  buildRecommendationContext,
  saveRecommendation,
  calculateGoalRelevance
} from './recommendation.service.js';
import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';

const router = Router();

const requestSchema = z.object({
  goal: z.string().max(500).optional(),
  preferred_locations: z.array(z.string().max(100)).max(20).optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  page: z.coerce.number().int().min(1).optional().default(1)
});

async function callAI(context) {
  if (!env.AI_SERVICE_URL) return null;
  const controller = new AbortController();
  // 10s timeout ensures quick response without hanging user request
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${env.AI_SERVICE_URL.replace(/\/$/, '')}/internal/v1/recommendations/careers`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.INTERNAL_SERVICE_TOKEN ? { 'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN } : {})
      },
      body: JSON.stringify(context),
      signal: controller.signal
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    // Log gracefully, do not bubble error up
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

router.post('/careers', authenticate, async (req, res, next) => {
  try {
    const input = requestSchema.parse(req.body);

    // 1. Database-First Career Retrieval & Deterministic Ranking
    const dbRecs = await getDatabaseRecommendations(req.user.id, input.goal, {
      limit: input.limit,
      page: input.page,
      preferred_locations: input.preferred_locations,
      constraints: input.constraints
    });

    // 2. Build context for AI enrichment if needed
    const context = await buildRecommendationContext(req.user.id, dbRecs.goal, {
      preferred_locations: input.preferred_locations ?? [],
      constraints: input.constraints ?? {}
    });

    let aiResults = null;
    let aiGenerated = false;

    // 3. Attempt AI enrichment gracefully
    try {
      const aiResponse = await callAI(context);
      if (aiResponse && Array.isArray(aiResponse.results) && aiResponse.results.length > 0) {
        aiResults = aiResponse.results;
        aiGenerated = true;
      }
    } catch {
      aiResults = null;
    }

    // 4. Merge AI enrichment with database records if available (with strict goal domain validation)
    const finalResults = [...dbRecs.results];
    const existingCareerIds = new Set(finalResults.map(r => r.career_id).filter(Boolean));
    const existingTitles = new Set(finalResults.map(r => r.title.toLowerCase().trim()));

    if (aiResults) {
      for (const item of aiResults) {
        const itemTitle = (item.title || item.career_title || '').trim();
        if (!itemTitle) continue;
        const normTitle = itemTitle.toLowerCase().replace(/[^a-z0-9+#]/g, '');

        // Evaluate domain and goal relevance
        const goalRel = calculateGoalRelevance(itemTitle, dbRecs.goal);
        if (dbRecs.goal && goalRel.matchType === 'unrelated') {
          // Reject cross-domain contamination from AI
          continue;
        }

        const calculatedMatchType = goalRel.matchType === 'unrelated' ? 'related' : goalRel.matchType;
        const assignedScore = calculatedMatchType === 'direct'
          ? Math.max(75, item.score || item.match_score || 85)
          : (calculatedMatchType === 'related'
            ? Math.max(55, Math.min(85, item.score || item.match_score || 72))
            : Math.min(65, item.score || item.match_score || 55));

        // If AI recommended a database career already in our results, enrich its reasoning
        if (item.career_id && existingCareerIds.has(item.career_id)) {
          const match = finalResults.find(r => r.career_id === item.career_id);
          if (match && item.reasoning && item.reasoning.length > 15) {
            match.reasoning = item.reasoning;
          }
          continue;
        }

        // If AI suggested an external title not in our database list
        if (!existingTitles.has(itemTitle.toLowerCase())) {
          existingTitles.add(itemTitle.toLowerCase());

          // Check if it matches an existing DB career
          const dbHit = await pool.query(
            `SELECT id, title, description FROM careers WHERE record_status = 'published' AND LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9+#]', '', 'g')) = $1 LIMIT 1`,
            [normTitle]
          );

          if (dbHit.rows.length > 0) {
            const dbCareer = dbHit.rows[0];
            if (!existingCareerIds.has(dbCareer.id)) {
              existingCareerIds.add(dbCareer.id);
              finalResults.push({
                career_id: dbCareer.id,
                title: dbCareer.title,
                description: dbCareer.description,
                match_type: calculatedMatchType,
                score: assignedScore,
                match_score: assignedScore,
                reasoning: item.reasoning || `${goalRel.reasons[0] || `Related career identified by CareerGPS engine for ${dbRecs.goal}`}.`,
                missing_skills: item.missing_skills || [],
                matched_skills: [],
                source: 'database',
                verified: true
              });
            }
          } else {
            // Check ai_career_profiles
            const aiDbHit = await pool.query(
              `SELECT id, title, description FROM ai_career_profiles WHERE status <> 'archived' AND normalized_title = $1 LIMIT 1`,
              [normTitle]
            );

            if (aiDbHit.rows.length > 0) {
              const aiCareer = aiDbHit.rows[0];
              finalResults.push({
                career_id: null,
                ai_career_id: aiCareer.id,
                title: aiCareer.title,
                description: aiCareer.description,
                match_type: calculatedMatchType,
                score: assignedScore,
                match_score: assignedScore,
                reasoning: item.reasoning || `${goalRel.reasons[0] || `AI-mapped profile for ${dbRecs.goal}`}.`,
                missing_skills: item.missing_skills || [],
                matched_skills: [],
                source: 'ai_database',
                verified: false
              });
            } else {
              // Real-world AI domain suggestions
              finalResults.push({
                career_id: null,
                ai_career_id: null,
                title: itemTitle,
                description: item.description || '',
                match_type: calculatedMatchType,
                score: assignedScore,
                match_score: assignedScore,
                reasoning: item.reasoning || `${goalRel.reasons[0] || `Career path related to ${dbRecs.goal}`}.`,
                missing_skills: item.missing_skills || [],
                matched_skills: [],
                source: 'ai_general',
                verified: false
              });
            }
          }
        }
      }
    }

    // Re-group merged results
    const directMatches = finalResults.filter(r => r.match_type === 'direct');
    const relatedCareers = finalResults.filter(r => r.match_type === 'related');
    const careerTransitions = finalResults.filter(r => r.match_type === 'transition');
    const alternativePathways = finalResults.filter(r => r.match_type === 'transition' || r.match_type === 'pathway' || r.match_type === 'general');

    const totalCount = finalResults.length;
    const paginatedResults = finalResults.slice((input.page - 1) * input.limit, input.page * input.limit);

    // 5. Persist recommendations
    const saved = await saveRecommendation(
      req.user.id,
      dbRecs.goal,
      { preferred_locations: input.preferred_locations, constraints: input.constraints },
      paginatedResults
    );

    res.status(201).json({
      data: {
        recommendation_id: saved.id,
        goal: dbRecs.goal,
        results: paginatedResults,
        groups: {
          direct_matches: directMatches,
          related_careers: relatedCareers,
          career_transitions: careerTransitions,
          alternative_pathways: alternativePathways
        },
        pagination: {
          page: input.page,
          limit: input.limit,
          total: totalCount,
          total_pages: Math.ceil(totalCount / input.limit) || 1
        },
        ai_generated: aiGenerated,
        fallback_used: !aiGenerated
      }
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:recommendationId', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, goal, preferences, results, status, created_at 
       FROM recommendations 
       WHERE id = $1 AND user_id = $2`,
      [req.params.recommendationId, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recommendation not found.' } });
    }
    res.json({ data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

router.post('/:recommendationId/feedback', authenticate, async (req, res, next) => {
  try {
    const body = z.object({
      rating: z.enum(['helpful', 'not_helpful']),
      comment: z.string().max(1000).optional()
    }).parse(req.body);

    const exists = await pool.query(
      `SELECT id FROM recommendations WHERE id = $1 AND user_id = $2`,
      [req.params.recommendationId, req.user.id]
    );
    if (!exists.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recommendation not found.' } });
    }

    await pool.query(
      `INSERT INTO recommendation_feedback (recommendation_id, user_id, rating, comment) 
       VALUES ($1, $2, $3, $4)`,
      [req.params.recommendationId, req.user.id, body.rating, body.comment ?? null]
    );
    res.status(201).json({ data: { saved: true } });
  } catch (e) {
    next(e);
  }
});

export default router;
