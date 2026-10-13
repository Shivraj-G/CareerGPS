import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { profileSchema } from './profile.validation.js';
import { getProfile, updateProfile, calculateCompleteness } from './profile.service.js';
import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';
import { evaluateGoalEligibility } from '../goals/goal.engine.js';
import { evaluateGoalFeasibility } from '../goals/feasibility.engine.js';

const router = Router();
router.use(authenticate);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIRECT_STATES = new Set(['A', 'B', 'C', 'D', 'E']);
const AI_CLASSIFICATIONS = new Set(['GREEN', 'YELLOW', 'RED', 'INVALID_GOAL', 'UNKNOWN']);

function validate(req, res) {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'The request contains invalid fields.', details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) } });
    return null;
  }
  return parsed.data;
}

function normalizeEligibilityStatus(value) {
  const status = String(value ?? '').trim().toUpperCase();
  if (DIRECT_STATES.has(status)) return status;
  // The legacy engine occasionally returns combined labels. Keep the API's
  // direct-route status within the documented A-E vocabulary.
  if (status === 'B/C') return 'B';
  if (status === 'D/C') return 'D';
  return 'E';
}

function cleanStringArray(value, limit = 8) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean))].slice(0, limit);
}

function cleanSuggestedRoutes(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((route) => route && typeof route === 'object' && !Array.isArray(route)).slice(0, 4).map((route) => {
    const rawTitle = route.title || route.name || route.label || 'Suggested route';
    const rawType = route.route_type || route.type || 'exploration';
    const summary = route.summary || route.description || route.note || '';
    const steps = cleanStringArray(route.steps || route.milestones, 6);

    return {
      id: String(route.id || rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')),
      title: String(rawTitle).slice(0, 140),
      label: String(rawTitle).slice(0, 140),
      route_type: String(rawType).slice(0, 50),
      summary: String(summary).slice(0, 600),
      steps,
      feasibility_score: typeof route.feasibility_score === 'number' ? route.feasibility_score : (route.scores?.composite_score ?? 70),
      scores: route.scores && typeof route.scores === 'object' ? route.scores : null,
      time: typeof route.time === 'object' && route.time !== null ? route.time : {
        next_milestone: String(route.time_to_milestone || '2–4 weeks'),
        route_endpoint: String(route.estimated_duration || '6–12 months')
      },
      cost: typeof route.cost === 'object' && route.cost !== null ? route.cost : {
        estimate: String(route.cost || 'Not yet estimated')
      },
      requirements: typeof route.requirements === 'object' && route.requirements !== null ? route.requirements : {
        verified_gates: Array.isArray(route.requirements) ? route.requirements : [String(route.requirements || 'Verify prerequisites')]
      },
      flexibility: String(route.flexibility || 'Standard schedule').slice(0, 200),
      risk: String(route.risk || 'Competitive admission & criteria vary by institution').slice(0, 200),
      evidence_of_progress: String(route.evidence_of_progress || 'Course completion or portfolio evidence').slice(0, 200),
      exit_points: String(route.exit_points || 'Skills transfer to adjacent pathways').slice(0, 200),
      verification_status: route.verification_status || 'AI_SUGGESTED_UNVERIFIED',
      verification_note: 'Verify formal education, admission, licensing, and cycle-specific requirements with the relevant authority before committing.'
    };
  });
}

async function callAI(context, parentSignal) {
  if (!env.AI_SERVICE_URL) return null;
  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) return null;
    parentSignal.addEventListener('abort', relayAbort, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`${env.AI_SERVICE_URL.replace(/\/$/, '')}/internal/v1/profiles/validate-goal`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.INTERNAL_SERVICE_TOKEN ? { 'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN } : {})
      },
      body: JSON.stringify(context),
      signal: controller.signal
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener('abort', relayAbort);
  }
}

async function loadSkillsForValidation(userId, profileContext) {
  const hasExplicitSelection = Array.isArray(profileContext?.skills);
  const chosen = hasExplicitSelection ? profileContext.skills : [];
  const chosenIds = [...new Set(chosen
    .map((item) => typeof item === 'string' ? item : item?.skill_id || item?.id)
    .filter((id) => typeof id === 'string' && UUID_RE.test(id)))];

  if (hasExplicitSelection) {
    let selectedRows = [];
    if (chosenIds.length > 0) {
      const selected = await pool.query(
        `SELECT s.id, s.name, COALESCE(us.level, 'unknown') AS level
         FROM skills s
         LEFT JOIN user_skills us ON us.skill_id = s.id AND us.user_id = $2
         WHERE s.id = ANY($1::uuid[])
         ORDER BY s.name`,
        [chosenIds, userId]
      );
      const requestedLevels = new Map(chosen
        .filter((item) => item && typeof item === 'object' && typeof (item.skill_id || item.id) === 'string')
        .map((item) => [item.skill_id || item.id, typeof item.level === 'string' ? item.level.slice(0, 30) : 'unknown']));
      selectedRows = selected.rows.map((row) => ({
        ...row,
        level: requestedLevels.get(row.id) || row.level || 'unknown'
      }));
    }

    // Accept custom labels as candidate context, but never treat them as verified catalogue skills.
    const customRows = chosen
      .filter((item) => item && typeof item === 'object' && item.is_custom === true && typeof item.name === 'string')
      .map((item) => ({
        id: null,
        name: item.name.trim().replace(/\s+/g, ' ').slice(0, 80),
        level: typeof item.level === 'string' ? item.level.slice(0, 30) : 'unknown',
        is_custom: true
      }))
      .filter((item) => item.name);

    const seen = new Set();
    return [...selectedRows, ...customRows].filter((item) => {
      const key = String(item.name || '').trim().toLocaleLowerCase('en-IN');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 30);
  }

  const saved = await pool.query(
    `SELECT s.id, s.name, us.level
     FROM user_skills us
     JOIN skills s ON us.skill_id = s.id
     WHERE us.user_id = $1
     ORDER BY s.name`,
    [userId]
  );
  return saved.rows;
}

router.get('/me', async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profile not found.' } });
    res.json({ data: profile });
  } catch (e) { next(e); }
});

router.put('/me', async (req, res, next) => {
  try {
    const input = validate(req, res);
    if (!input) return;
    res.json({ data: await updateProfile(req.user.id, input) });
  } catch (e) { next(e); }
});

router.get('/me/completeness', async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profile not found.' } });
    res.json({ data: calculateCompleteness(profile) });
  } catch (e) { next(e); }
});

router.post('/me/validate-goal', async (req, res, next) => {
  const reqController = new AbortController();
  const abortIfClientDisconnected = () => {
    // IncomingMessage 'close' also fires after a request body was read. Only
    // abort downstream work when the HTTP response is actually abandoned.
    if (!res.writableEnded) reqController.abort();
  };
  const abortIncompleteRequest = () => reqController.abort();
  req.once('aborted', abortIncompleteRequest);
  res.once('close', abortIfClientDisconnected);

  try {
    const rawGoal = req.body?.goal;
    if (typeof rawGoal !== 'string' || !rawGoal.trim()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Enter a career or other goal to evaluate.' } });
    }
    if (rawGoal.trim().length > 160) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Goal must be 160 characters or fewer.' } });
    }

    const goal = rawGoal.trim().replace(/\s+/g, ' ');
    const profileContext = req.body?.profileContext && typeof req.body.profileContext === 'object' && !Array.isArray(req.body.profileContext)
      ? req.body.profileContext
      : null;

    let profile = await getProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profile not found.' } });
    if (profileContext) profile = { ...profile, ...profileContext };

    const normalizedInput = goal.toLocaleLowerCase('en-IN');
    const exactRes = await pool.query(
      `SELECT id, title, description, qualifications, entry_routes, responsibilities
       FROM careers WHERE lower(trim(title)) = $1 LIMIT 1`,
      [normalizedInput]
    );
    const matchedCareer = exactRes.rows[0] || null;
    let catalogueCandidates = [];
    if (!matchedCareer && goal.length >= 3) {
      const candidateRes = await pool.query(
        `SELECT id, title FROM careers
         WHERE title ILIKE $1
         ORDER BY length(title), title
         LIMIT 5`,
        [`%${goal.replace(/[\\%_]/g, '\\$&')}%`]
      );
      catalogueCandidates = candidateRes.rows;
    }

    // The goal remains evaluable even when it is not already in the seeded
    // careers catalogue. AI is allowed to recognize it and propose clearly
    // labelled candidate routes; absence from the DB is not proof of invalidity.
    const canonicalTitle = matchedCareer?.title || goal;
    const canonicalId = matchedCareer?.id || null;
    const evaluation = evaluateGoalEligibility(profile, { title: canonicalTitle });
    const feasibility = evaluateGoalFeasibility(profile, { title: canonicalTitle, id: canonicalId });
    const directRouteStatus = normalizeEligibilityStatus(feasibility.evaluation?.direct_route_status || evaluation.status);
    const skills = await loadSkillsForValidation(req.user.id, profileContext || {});
    const aiResponse = await callAI({
      goal: canonicalTitle,
      profile,
      skills,
      careers: matchedCareer ? [matchedCareer] : catalogueCandidates
    }, reqController.signal);

    const rawAiClassification = String(aiResponse?.classification || '').trim().toUpperCase();
    const aiClassification = AI_CLASSIFICATIONS.has(rawAiClassification) ? rawAiClassification : 'UNKNOWN';
    const aiGoalResolution = String(aiResponse?.goal_resolution || aiResponse?.career_resolution || '').trim().toUpperCase();
    const aiGoalValidity = String(aiResponse?.goal_validity || '').trim().toUpperCase();

    let resolution;
    let goalValidity;
    if (matchedCareer) {
      resolution = 'matched';
      goalValidity = 'VALID';
    } else if (['VALID', 'KNOWN', 'AI_SUGGESTED'].includes(aiGoalResolution) || aiGoalValidity === 'VALID') {
      resolution = 'ai_resolved';
      goalValidity = 'VALID';
    } else if (aiGoalResolution === 'CLARIFICATION_REQUIRED' || aiGoalValidity === 'CLARIFICATION_REQUIRED') {
      resolution = 'clarification_required';
      goalValidity = 'CLARIFICATION_REQUIRED';
    } else if (['UNSUPPORTED', 'INVALID', 'INVALID_GOAL'].includes(aiGoalResolution) || aiGoalValidity === 'INVALID' || aiClassification === 'INVALID_GOAL') {
      resolution = 'unsupported_or_unmatched';
      goalValidity = 'INVALID';
    } else {
      resolution = 'verification_pending';
      goalValidity = 'UNVERIFIED';
    }

    // A catalogue goal is valid even if an LLM is uncertain. An AI-recognized
    // ambition remains user-owned; formal eligibility is reported separately.
    const allowContinue = ['matched', 'ai_resolved', 'verification_pending'].includes(resolution);
    const aiFit = String(aiResponse?.profile_fit || '').trim().toUpperCase();
    const reason = String(aiResponse?.reason || '').trim();
    const aiMissing = cleanStringArray(aiResponse?.additional_steps || aiResponse?.next_steps, 8);
    const aiSkillGaps = cleanStringArray(aiResponse?.skill_gaps, 8);
    const aiFormalBarriers = cleanStringArray(aiResponse?.career_requirements || aiResponse?.formal_barriers, 8);
    const aiRoutes = cleanSuggestedRoutes(aiResponse?.suggested_routes || aiResponse?.routes);
    const aiNextSteps = cleanStringArray(aiResponse?.next_steps, 6);

    // Merge deterministic routes with AI candidate routes
    const combinedRoutes = aiRoutes.length > 0
      ? aiRoutes
      : cleanSuggestedRoutes(feasibility.routes);

    const feasibilityFormalReason = feasibility.four_dimensions?.formal_eligibility?.reason || feasibility.summary;
    const fallbackReason = resolution === 'unsupported_or_unmatched'
      ? String(aiResponse?.reason || `CareerGPS could not confidently identify "${goal}" as a supported goal. Rephrase it or clarify what you want to do.`)
      : resolution === 'clarification_required'
        ? String(aiResponse?.reason || 'Please clarify the exact role, programme, or goal you mean.')
        : (feasibilityFormalReason || `${canonicalTitle} has been kept as your goal. Formal eligibility for a specific route still needs verification.`);

    const chosenNextAction = aiResponse?.next_action?.title
      || aiNextSteps[0]
      || aiMissing[0]
      || feasibility.next_action?.title
      || (evaluation.decision !== 'Verification Pending' ? evaluation.action : 'Confirm the relevant route requirements and choose one practical first step.');

    const fourDimensions = {
      ambition: feasibility.four_dimensions?.ambition || {
        selected_goal: canonicalTitle,
        canonical_id: canonicalId,
        goal_type: String(aiResponse?.goal_type || 'career'),
        owner: 'user',
        preserved: true
      },
      formal_eligibility: feasibility.four_dimensions?.formal_eligibility || {
        status: directRouteStatus,
        decision: String(evaluation.decision || (directRouteStatus === 'A' ? 'Directly Eligible' : directRouteStatus === 'D' ? 'Direct Route Restricted' : 'Verification Required')),
        reason: feasibilityFormalReason || evaluation.reason || '',
        mandatory_gates: aiFormalBarriers,
        barriers: aiFormalBarriers,
        bridge_possible: false,
        cited_authorities: []
      },
      readiness: aiResponse?.four_dimensions?.readiness || feasibility.four_dimensions?.readiness || {
        score: 60,
        demonstrated_skills: skills.map(s => s.name || s),
        confirmed_gaps: aiSkillGaps
      },
      practical_feasibility: feasibility.four_dimensions?.practical_feasibility || {
        score: 70,
        delivery_mode_conflict: false,
        obstacles: []
      }
    };

    const overallFeasibility = feasibility.overall_feasibility || {
      status: directRouteStatus === 'A' ? 'HIGH_FEASIBILITY' : directRouteStatus === 'D' ? 'FORMAL_GATE_RESTRICTED' : 'NEEDS_VERIFICATION',
      label: directRouteStatus === 'A' ? 'Practical route available' : 'Route needs verification',
      tone: directRouteStatus === 'A' ? 'positive' : 'warning',
      score: fourDimensions.practical_feasibility.score
    };

    const directRouteDecision = String(
      fourDimensions.formal_eligibility.decision
      || evaluation.decision
      || (directRouteStatus === 'A' ? 'Directly Eligible' : directRouteStatus === 'D' ? 'Direct Route Restricted' : 'Verification Required')
    );

    // If deterministic feasibility provided a specific verified formal reason, use it so status and text never contradict
    const finalReason = resolution === 'unsupported_or_unmatched' || resolution === 'clarification_required'
      ? fallbackReason
      : (feasibilityFormalReason || (reason && !reason.includes('temporarily unavailable') ? reason : fallbackReason));

    res.json({
      data: {
        goal: canonicalTitle,
        original_input: goal,
        goal_type: String(aiResponse?.goal_type || feasibility.goal_type || (matchedCareer ? 'career' : 'unknown')),
        goal_valid: goalValidity === 'VALID',
        goal_validity: goalValidity,
        resolution,
        canonical_id: canonicalId,
        career_id: canonicalId,
        // `classification` remains an A-E compatibility field for existing UI consumers
        classification: directRouteStatus,
        direct_route_status: directRouteStatus,
        direct_route_decision: directRouteDecision,
        pathway_status: aiClassification !== 'UNKNOWN' ? aiClassification : (directRouteStatus === 'A' ? 'GREEN' : directRouteStatus === 'D' ? 'RED' : 'YELLOW'),
        ai_classification: aiClassification,
        profile_fit: aiFit || (aiClassification === 'GREEN' ? 'STRONG_START' : aiClassification === 'YELLOW' ? 'BRIDGE_NEEDED' : 'UNKNOWN'),
        overall_feasibility: overallFeasibility,
        four_dimensions: fourDimensions,
        reason: finalReason,
        action: chosenNextAction,
        next_action: aiResponse?.next_action || feasibility.next_action,
        next_steps: aiNextSteps.length ? aiNextSteps : (feasibility.milestones?.length ? feasibility.milestones.map(m => m.title) : aiMissing),
        milestones: aiResponse?.milestones?.length ? aiResponse.milestones : feasibility.milestones,
        formal_barriers: aiFormalBarriers.length ? aiFormalBarriers : (fourDimensions.formal_eligibility.barriers || []),
        missing_requirements: aiMissing,
        skill_gaps: aiSkillGaps.length ? aiSkillGaps : (fourDimensions.readiness.confirmed_gaps || []),
        suggested_routes: combinedRoutes,
        routes: combinedRoutes,
        sources: feasibility.sources || [],
        clarification_question: String(aiResponse?.clarification_question || ''),
        confidence: String(aiResponse?.confidence || (aiResponse ? 'medium' : feasibility.evaluation.confidence || 'low')),
        rule_verification: directRouteStatus === 'E' ? 'not_verified_for_exact_route' : 'preliminary_rule_mapping',
        profile_gaps: cleanStringArray(aiResponse?.profile_gaps, 8),
        suggested_goals: [],
        allow_continue: allowContinue,
        ai_generated: Boolean(aiResponse)
      }
    });
  } catch (e) {
    next(e);
  } finally {
    req.removeListener('aborted', abortIncompleteRequest);
    res.removeListener('close', abortIfClientDisconnected);
  }
});

export default router;
