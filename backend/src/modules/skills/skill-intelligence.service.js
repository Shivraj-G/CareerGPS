import { pool } from '../../config/database.js';

export async function getUserSkills(userId) {
  const result = await pool.query(
    `SELECT s.id, s.name, s.description, us.level, us.years_experience, us.verified
     FROM user_skills us JOIN skills s ON s.id = us.skill_id
     WHERE us.user_id = $1 AND s.record_status IN ('published', 'needs_review')
     ORDER BY s.name`, [userId]
  );
  return result.rows;
}

function normalizeString(str) {
  return str.toLowerCase().replace(/[^a-z0-9+#]/g, '');
}

function buildRecommendedAction(prioritySkills) {
  if (!prioritySkills || prioritySkills.length === 0) {
    return 'Explore introductory resources and core role responsibilities to build your foundational development plan.';
  }
  const top = prioritySkills[0].skill;
  const topLower = top.toLowerCase();
  if (topLower.includes('sql')) {
    return 'Practice fundamental relational queries: write SELECT, JOIN, and aggregation queries on sample business tables.';
  }
  if (topLower.includes('excel')) {
    return 'Master intermediate spreadsheet analysis: build a financial workbook using XLOOKUP, pivot tables, and conditional logic.';
  }
  if (topLower.includes('accounting') || topLower.includes('financial')) {
    return 'Review core financial reporting principles: balance sheets, cash flow statements, and general ledger reconciliations.';
  }
  if (topLower.includes('erp')) {
    return 'Study core enterprise resource planning concepts: modular workflows, data schemas, and transactional posting.';
  }
  if (topLower.includes('business analysis')) {
    return 'Document a functional requirements breakdown and process flow diagram for a real-world software integration.';
  }
  return `Start a targeted learning project to develop practical proficiency in ${top}.`;
}

function buildMilestones(prioritySkills) {
  const topSkill = prioritySkills?.[0]?.skill || 'core role competencies';
  return [
    {
      step: 1,
      title: 'Foundational Knowledge & Tooling',
      description: `Acquire core principles, terminology, and standard practices in ${topSkill}.`
    },
    {
      step: 2,
      title: 'Applied Project Scenario',
      description: 'Execute a realistic case study or exercise demonstrating end-to-end task completion.'
    },
    {
      step: 3,
      title: 'Portfolio & Capability Verification',
      description: 'Document your completed work in your profile or earn a verifiable credential.'
    }
  ];
}

export async function calculateSkillGap(userId, careerId) {
  const [userSkills, customSkillsRes, profileRes, careerSkillsRes, careerRes] = await Promise.all([
    getUserSkills(userId),
    pool.query(`SELECT id, name, level FROM user_custom_skills WHERE user_id = $1 ORDER BY name`, [userId]),
    pool.query(`SELECT career_goal, education, experience, current_goal, interests FROM user_profiles WHERE user_id = $1`, [userId]),
    pool.query(`SELECT s.id, s.name, cs.importance, cs.verification_status FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1 AND s.record_status IN ('published', 'needs_review') ORDER BY CASE cs.importance WHEN 'required' THEN 1 WHEN 'important' THEN 2 ELSE 3 END, s.name`, [careerId]),
    pool.query(`SELECT id, title, description, qualifications, responsibilities, entry_routes FROM careers WHERE id = $1`, [careerId])
  ]);

  const career = careerRes.rows[0];
  const careerSkills = careerSkillsRes.rows;
  const userSkillById = new Map(userSkills.map((s) => [s.id, s]));
  const userSkillByName = new Map();
  for (const s of userSkills) userSkillByName.set(normalizeString(s.name), s);
  for (const s of customSkillsRes.rows) {
    userSkillByName.set(normalizeString(s.name), {
      id: s.id,
      name: s.name,
      level: s.level,
      verified: false,
      is_custom: true
    });
  }

  const skillsPresent = [];
  const skillsNeedingDevelopment = [];
  const unverifiedSkills = [];
  const matchedLegacy = [];
  const missingLegacy = [];

  let totalPoints = 0;
  let earnedPoints = 0;

  for (const req of careerSkills) {
    const weight = req.importance === 'required' ? 3 : (req.importance === 'important' ? 2 : 1);
    totalPoints += weight;

    const matched = userSkillById.get(req.id) || userSkillByName.get(normalizeString(req.name));
    if (matched) {
      const isLevelLow = req.importance === 'required' && matched.level === 'beginner';
      const points = isLevelLow ? weight * 0.5 : weight;
      earnedPoints += points;

      const item = {
        skill_id: req.id,
        skill: req.name,
        level: matched.level || 'intermediate',
        importance: req.importance,
        verified: !!matched.verified,
        status: isLevelLow ? 'needs_proficiency_boost' : 'sufficient',
        proficiency_note: isLevelLow
          ? 'Basic familiarity recorded; advancing to intermediate/applied level recommended.'
          : 'Demonstrated in profile.'
      };
      skillsPresent.push(item);
      matchedLegacy.push({
        skill_id: req.id,
        skill: req.name,
        level: matched.level || 'intermediate',
        importance: req.importance
      });

      if (!matched.verified) {
        unverifiedSkills.push({
          skill: req.name,
          level: matched.level,
          reason: 'Self-reported on profile; external credential or assessment verification pending.'
        });
      }
    } else {
      skillsNeedingDevelopment.push({
        skill_id: req.id,
        skill: req.name,
        importance: req.importance,
        evidence_status: 'not_reported',
        reason: req.importance === 'required'
          ? 'Core qualification requirement for role execution.'
          : 'Valued professional capability in standard workflows.'
      });
      missingLegacy.push({
        skill_id: req.id,
        skill: req.name,
        importance: req.importance
      });
    }
  }

  const prioritySkills = [
    ...skillsNeedingDevelopment.filter((s) => s.importance === 'required'),
    ...skillsPresent.filter((s) => s.status === 'needs_proficiency_boost'),
    ...skillsNeedingDevelopment.filter((s) => s.importance === 'important'),
    ...skillsNeedingDevelopment.filter((s) => s.importance === 'useful')
  ].slice(0, 4);

  const matchScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  let readinessLevel = 'Early Exploration';
  if (matchScore >= 75) readinessLevel = 'High Alignment';
  else if (matchScore >= 50) readinessLevel = 'Moderate Alignment';
  else if (matchScore >= 25) readinessLevel = 'Emerging Foundation';

  const scoreExplanation = 'Calculated from documented career prerequisites: Required skills weighted 3x, Important skills 2x, Useful skills 1x. Reflects profile readiness and curriculum alignment, not an employment guarantee.';
  const recommendedNextAction = buildRecommendedAction(prioritySkills);
  const learningMilestones = buildMilestones(prioritySkills);

  return {
    target_career_id: careerId,
    career_title: career?.title || '',
    match_score: matchScore,
    score_explanation: scoreExplanation,
    readiness_level: readinessLevel,
    skills_present: skillsPresent,
    skills_needing_development: skillsNeedingDevelopment,
    unverified_skills: unverifiedSkills,
    priority_skills: prioritySkills,
    recommended_next_action: recommendedNextAction,
    learning_milestones: learningMilestones,
    matched_skills: matchedLegacy,
    missing_skills: missingLegacy
  };
}

export async function calculateAiSkillGap(userId, aiCareerId) {
  const [userSkills, customSkillsRes, careerRes] = await Promise.all([
    getUserSkills(userId),
    pool.query(`SELECT id, name, level FROM user_custom_skills WHERE user_id = $1 ORDER BY name`, [userId]),
    pool.query(`SELECT title, required_skills FROM ai_career_profiles WHERE id = $1 AND status <> 'archived'`, [aiCareerId])
  ]);

  if (!careerRes.rows[0]) throw new Error('AI career not found');

  const aiCareer = careerRes.rows[0];
  const requiredSkills = aiCareer.required_skills || [];

  const userSkillById = new Map(userSkills.map((s) => [s.id, s]));
  const userSkillByName = new Map();
  for (const s of userSkills) userSkillByName.set(normalizeString(s.name), s);
  for (const s of customSkillsRes.rows) {
    userSkillByName.set(normalizeString(s.name), {
      id: s.id,
      name: s.name,
      level: s.level,
      verified: false,
      is_custom: true
    });
  }

  const skillsPresent = [];
  const skillsNeedingDevelopment = [];
  const unverifiedSkills = [];
  const matchedLegacy = [];
  const missingLegacy = [];

  let totalPoints = 0;
  let earnedPoints = 0;

  for (let i = 0; i < requiredSkills.length; i++) {
    const req = requiredSkills[i];
    const importance = req.importance || 'useful';
    const weight = importance === 'required' ? 3 : (importance === 'important' ? 2 : 1);
    totalPoints += weight;

    const matched = userSkillByName.get(normalizeString(req.name));
    if (matched) {
      const isLevelLow = importance === 'required' && matched.level === 'beginner';
      const points = isLevelLow ? weight * 0.5 : weight;
      earnedPoints += points;

      skillsPresent.push({
        skill_id: matched.id || `ai-skill-${i}`,
        skill: req.name,
        level: matched.level || 'intermediate',
        importance,
        verified: !!matched.verified,
        status: isLevelLow ? 'needs_proficiency_boost' : 'sufficient',
        proficiency_note: isLevelLow ? 'Basic familiarity recorded; advancing proficiency recommended.' : 'Demonstrated in profile.'
      });
      matchedLegacy.push({
        skill_id: matched.id || null,
        skill: req.name,
        level: matched.level || 'intermediate',
        importance
      });

      if (!matched.verified) {
        unverifiedSkills.push({
          skill: req.name,
          level: matched.level,
          reason: 'Self-reported on profile; external verification pending.'
        });
      }
    } else {
      skillsNeedingDevelopment.push({
        skill_id: `ai-skill-${i}`,
        skill: req.name,
        importance,
        evidence_status: 'not_reported',
        reason: importance === 'required' ? 'Core qualification requirement.' : 'Valued competence.'
      });
      missingLegacy.push({
        skill_id: null,
        skill: req.name,
        importance
      });
    }
  }

  const prioritySkills = [
    ...skillsNeedingDevelopment.filter((s) => s.importance === 'required'),
    ...skillsPresent.filter((s) => s.status === 'needs_proficiency_boost'),
    ...skillsNeedingDevelopment.filter((s) => s.importance === 'important'),
    ...skillsNeedingDevelopment.filter((s) => s.importance === 'useful')
  ].slice(0, 4);

  const matchScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  let readinessLevel = 'Early Exploration';
  if (matchScore >= 75) readinessLevel = 'High Alignment';
  else if (matchScore >= 50) readinessLevel = 'Moderate Alignment';
  else if (matchScore >= 25) readinessLevel = 'Emerging Foundation';

  const scoreExplanation = 'Calculated from AI-suggested competencies: Required skills weighted 3x, Important skills 2x, Useful skills 1x. Reflects profile readiness, not an employment guarantee.';
  const recommendedNextAction = buildRecommendedAction(prioritySkills);
  const learningMilestones = buildMilestones(prioritySkills);

  return {
    target_ai_career_id: aiCareerId,
    career_title: aiCareer.title,
    match_score: matchScore,
    score_explanation: scoreExplanation,
    readiness_level: readinessLevel,
    skills_present: skillsPresent,
    skills_needing_development: skillsNeedingDevelopment,
    unverified_skills: unverifiedSkills,
    priority_skills: prioritySkills,
    recommended_next_action: recommendedNextAction,
    learning_milestones: learningMilestones,
    ai_generated: true,
    matched_skills: matchedLegacy,
    missing_skills: missingLegacy
  };
}

