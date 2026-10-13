const fs = require('fs');

const routeCode = `
import { evaluateGoalEligibility } from '../goals/goal.engine.js';

async function callAI(context) {
  if (!env.AI_SERVICE_URL) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(\`\${env.AI_SERVICE_URL.replace(/\\/$/, '')}/internal/v1/profiles/validate-goal\`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(env.INTERNAL_SERVICE_TOKEN ? { 'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN } : {}) },
      body: JSON.stringify(context),
      signal: controller.signal
    });
    if (!response.ok) return null;
    return response.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

router.post('/me/validate-goal', async (req, res, next) => {
  try {
    const { goal, profileContext } = req.body;
    if (!goal) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Goal is required.' } });
    
    let profile = await getProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Profile not found.' } });

    if (profileContext) {
      profile = { ...profile, ...profileContext };
    }

    const normalizedInput = goal.trim().toLowerCase().replace(/\\s+/g, ' ');
    
    // Exact or ILIKE match
    let exactMatch = await pool.query('SELECT id, title FROM careers WHERE lower(title) = $1 LIMIT 1', [normalizedInput]);
    let matchedCareer = exactMatch.rows[0];
    let resolutionState = matchedCareer ? 'matched' : 'unsupported_or_unmatched';
    let canonicalTitle = matchedCareer ? matchedCareer.title : goal;
    let canonicalId = matchedCareer ? matchedCareer.id : null;

    if (!matchedCareer) {
       const fuzzyMatch = await pool.query('SELECT id, title FROM careers WHERE title ILIKE $1 LIMIT 1', [\`%\${normalizedInput}%\`]);
       if (fuzzyMatch.rows.length > 0) {
         matchedCareer = fuzzyMatch.rows[0];
         canonicalTitle = matchedCareer.title;
         canonicalId = matchedCareer.id;
         resolutionState = 'clarification_required';
       }
    }

    if (!matchedCareer) {
      return res.json({
        data: {
          goal: goal,
          goal_type: "unknown",
          resolution: resolutionState,
          direct_route_status: 'E',
          pathway_status: 'INVALID_GOAL',
          reason: \`The goal "\${goal}" was not found in our catalogue.\`,
          action: "Please clarify your goal or choose a supported career.",
          canonical_id: null,
          profile_gaps: [],
          suggested_goals: [],
          formal_barriers: [],
          missing_requirements: [],
          skill_gaps: [],
          allow_continue: false,
          ai_generated: false
        }
      });
    }

    // Deterministic direct-route eligibility
    const evaluation = evaluateGoalEligibility(profile, { title: canonicalTitle });
    const directRouteStatus = evaluation.status; // 'A', 'B', 'C', 'D', 'E'
    const deterministicReason = evaluation.decision;
    const actionPlan = evaluation.action;

    // Get user skills for AI context
    const skillsRes = await pool.query(\`
      SELECT s.id, s.name, p.level 
      FROM profile_skills p 
      JOIN skills s ON p.skill_id = s.id 
      WHERE p.user_id = $1
    \`, [req.user.id]);

    // Request AI analysis
    const aiResponse = await callAI({
      goal: canonicalTitle,
      profile: profile,
      skills: skillsRes.rows,
      careers: [{ id: canonicalId, title: canonicalTitle }] // passing matched career for context
    });

    let pathwayStatus = 'UNKNOWN';
    let aiReason = deterministicReason;
    let missingReqs = [];
    let skillGaps = [];
    let formalBarriers = [];
    let aiGenerated = false;

    if (aiResponse) {
      pathwayStatus = aiResponse.classification; // GREEN, YELLOW, RED
      aiReason = aiResponse.reason || aiReason;
      missingReqs = aiResponse.missing_requirements || [];
      skillGaps = aiResponse.skill_gaps || [];
      formalBarriers = aiResponse.formal_barriers || [];
      aiGenerated = true;
    }

    // Adapt API contract for frontend
    res.json({ 
      data: {
        goal: canonicalTitle,
        original_input: goal,
        resolution: resolutionState,
        canonical_id: canonicalId,
        direct_route_status: directRouteStatus,
        pathway_status: pathwayStatus,
        reason: aiReason,
        action: actionPlan,
        formal_barriers: formalBarriers,
        missing_requirements: missingReqs,
        skill_gaps: skillGaps,
        profile_gaps: [],
        suggested_goals: [],
        allow_continue: true,
        ai_generated: aiGenerated
      }
    });
  } catch (e) {
    next(e);
  }
});

export default router;
`;

let code = fs.readFileSync('backend/src/modules/profiles/profile.routes.js', 'utf8');
// Slice up to the import of evaluateGoalEligibility
const importIndex = code.indexOf("import { evaluateGoalEligibility }");
code = code.substring(0, importIndex) + routeCode;
fs.writeFileSync('backend/src/modules/profiles/profile.routes.js', code);
