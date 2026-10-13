import { pool } from '../../config/database.js';
import { classifyCareerDomain, OCCUPATIONAL_DOMAINS } from '../careers/domain-taxonomy.js';

// Recognized career synonyms and aliases for accurate goal mapping
export const CAREER_SYNONYMS = {
  'data analyst': [
    'data analyst', 'data analytics', 'business data analyst', 'bi analyst',
    'business intelligence analyst', 'reporting analyst', 'product analyst',
    'analytics specialist', 'data analytics specialist', 'quantitative analyst',
    'data analysis', 'analytics associate'
  ],
  'data scientist': [
    'data scientist', 'machine learning engineer', 'ml engineer', 'data science',
    'ai specialist', 'applied scientist', 'statistician', 'ml scientist'
  ],
  'data engineer': [
    'data engineer', 'big data engineer', 'etl developer', 'data platform engineer',
    'analytics engineer', 'database engineer'
  ],
  'business analyst': [
    'business analyst', 'business systems analyst', 'requirements analyst',
    'process analyst', 'functional analyst', 'operations analyst', 'ba'
  ],
  'cybersecurity analyst': [
    'cybersecurity analyst', 'information security analyst', 'security analyst',
    'infosec analyst', 'cyber security', 'soc analyst', 'security engineer'
  ],
  'backend developer': [
    'backend developer', 'backend engineer', 'server-side developer',
    'api developer', 'java developer', 'python developer', 'node.js developer',
    'backend software engineer'
  ],
  'frontend developer': [
    'frontend developer', 'frontend engineer', 'ui developer', 'web developer',
    'react developer', 'javascript developer', 'frontend software engineer'
  ],
  'full stack developer': [
    'full stack developer', 'full stack engineer', 'software engineer',
    'software developer', 'application developer', 'full stack web developer'
  ],
  'doctor': [
    'doctor', 'physician', 'medical practitioner', 'general practitioner',
    'medical doctor', 'mbbs doctor', 'clinical doctor', 'medical officer'
  ],
  'surgeon': [
    'surgeon', 'general surgeon', 'orthopedic surgeon', 'surgical specialist'
  ],
  'nurse': [
    'nurse', 'registered nurse', 'staff nurse', 'clinical nurse', 'nursing officer',
    'healthcare nurse', 'nursing specialist'
  ],
  'clerk': [
    'clerk', 'office assistant', 'administrative clerk', 'data entry clerk',
    'office executive', 'administrative assistant', 'junior clerk'
  ],
  'technician': [
    'technician', 'hardware technician', 'maintenance technician',
    'technical support specialist', 'field technician', 'lab technician', 'electronics technician'
  ],
  'chef': [
    'chef', 'cook', 'culinary artist', 'sous chef', 'head chef', 'pastry chef',
    'executive chef', 'kitchen manager', 'line cook'
  ],
  'police officer': [
    'police officer', 'sub-inspector', 'constable', 'law enforcement officer',
    'police inspector', 'traffic police'
  ],
  'assistant professor': [
    'assistant professor', 'lecturer', 'college professor', 'academic teacher',
    'faculty member', 'professor', 'associate professor'
  ],
  'teacher': [
    'teacher', 'school teacher', 'educator', 'instructor', 'high school teacher',
    'primary teacher', 'tutor', 'pedagogue'
  ],
  'lawyer': [
    'lawyer', 'advocate', 'attorney', 'legal counsel', 'legal associate',
    'solicitor', 'barrister', 'legal consultant', 'corporate counsel',
    'legal researcher', 'prosecutor', 'public defender', 'litigator', 'paralegal',
    'contract specialist', 'compliance officer'
  ],
  'accountant': [
    'accountant', 'chartered accountant', 'ca', 'auditor', 'tax consultant',
    'cost accountant', 'bookkeeper', 'financial accountant', 'accounting specialist'
  ],
  'ai engineer': [
    'ai engineer', 'artificial intelligence engineer', 'deep learning engineer',
    'nlp engineer', 'ai researcher', 'genai engineer'
  ],
  'cloud / devops engineer': [
    'cloud / devops engineer', 'devops engineer', 'cloud engineer',
    'site reliability engineer', 'sre', 'cloud infrastructure engineer', 'cloud architect'
  ],
  'finance technology analyst': [
    'finance technology analyst', 'fintech analyst', 'financial technology',
    'financial analyst', 'finance systems analyst', 'finance technology'
  ],
  'marketing specialist': [
    'marketing specialist', 'digital marketer', 'marketing manager', 'growth marketer',
    'seo specialist', 'brand manager', 'content strategist'
  ],
  'erp specialist': [
    'erp specialist', 'erp consultant', 'sap consultant', 'erp administrator'
  ],
  'geo analyst': [
    'geo analyst', 'geospatial analyst', 'gis analyst', 'gis specialist',
    'geographic information systems analyst', 'remote sensing analyst',
    'spatial analyst', 'geoinformatics specialist', 'cartographer', 'geographer'
  ]
};

// Domain clusters grouping related roles
export const DOMAIN_CLUSTERS = {
  data: [
    'data analyst', 'data scientist', 'data engineer', 'business analyst',
    'finance technology analyst', 'ai engineer'
  ],
  geospatial: [
    'geo analyst'
  ],
  software: [
    'backend developer', 'frontend developer', 'full stack developer',
    'cloud / devops engineer', 'erp specialist', 'ai engineer', 'cybersecurity analyst'
  ],
  healthcare: [
    'doctor', 'surgeon', 'nurse', 'medical officer', 'clinical researcher'
  ],
  education: [
    'teacher', 'assistant professor'
  ],
  law: [
    'lawyer', 'police officer'
  ],
  finance: [
    'finance technology analyst', 'finance technology', 'business analyst',
    'financial analyst', 'accountant', 'clerk', 'erp specialist'
  ],
  public_service: [
    'police officer', 'clerk', 'assistant professor', 'teacher'
  ],
  hospitality: [
    'chef', 'catering services manager', 'restaurant manager'
  ]
};

export const ADJACENT_DOMAINS = {
  software_engineering_it: new Set(['data_engineering', 'data_ai']),
  data_engineering: new Set(['software_engineering_it', 'data_ai']),
  data_ai: new Set(['data_engineering', 'software_engineering_it', 'business_finance_operations']),
  business_finance_operations: new Set(['data_ai']),
  education_teaching: new Set(),
  culinary_hospitality: new Set(),
  law_public_policy: new Set(),
  healthcare_medicine: new Set(),
  geography_gis_environment: new Set(['data_ai']),
  engineering_physical: new Set(),
  marketing_communications: new Set(['business_finance_operations']),
  design_creative: new Set(['software_engineering_it']),
  general_professional: new Set()
};

const GENERIC_SOFT_SKILLS = new Set([
  'communication', 'problem solving', 'critical thinking', 'teamwork',
  'time management', 'adaptability', 'interpersonal skills', 'work ethic',
  'leadership', 'creativity', 'attention to detail', 'organization'
]);

function normalizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().replace(/\s+/g, ' ');
}

function extractTokens(str) {
  const norm = normalizeText(str);
  if (!norm) return new Set();
  return new Set(norm.split(' ').filter(w => w.length >= 3));
}

export function resolveUserGoal(profile, explicitGoal) {
  if (explicitGoal && typeof explicitGoal === 'string' && explicitGoal.trim()) {
    return explicitGoal.trim();
  }
  const currentGoal = profile?.current_goal;
  if (currentGoal) {
    if (typeof currentGoal === 'object' && currentGoal?.title) {
      return String(currentGoal.title).trim();
    }
    if (typeof currentGoal === 'string') {
      try {
        const parsed = JSON.parse(currentGoal);
        if (parsed?.title) return String(parsed.title).trim();
      } catch {
        if (currentGoal.trim()) return currentGoal.trim();
      }
    }
  }
  if (profile?.career_goal && typeof profile.career_goal === 'string' && profile.career_goal.trim()) {
    return profile.career_goal.trim();
  }
  return null;
}

export function calculateGoalRelevance(careerTitle, goal) {
  if (!goal) {
    return { score: 50, matchType: 'general', reasons: ['General catalogue role evaluated for your profile'] };
  }
  const normTitle = normalizeText(careerTitle);
  const normGoal = normalizeText(goal);

  if (normTitle === normGoal) {
    return {
      score: 100,
      matchType: 'direct',
      reasons: [`Exact match for your primary ambition of ${goal}`]
    };
  }

  // Check synonym dictionaries
  for (const [key, aliases] of Object.entries(CAREER_SYNONYMS)) {
    const normKey = normalizeText(key);
    const normAliases = aliases.map(normalizeText);
    const titleInGroup = normTitle === normKey || normAliases.includes(normTitle);
    const goalInGroup = normGoal === normKey || normAliases.includes(normGoal);

    if (titleInGroup && goalInGroup) {
      return {
        score: 95,
        matchType: 'direct',
        reasons: [`Direct equivalent for your target career of ${goal}`]
      };
    }
  }

  // Substring containment for direct specializations (e.g. "Data Analyst" vs "Analyst")
  if (normTitle.includes(normGoal) || normGoal.includes(normTitle)) {
    return {
      score: 85,
      matchType: 'direct',
      reasons: [`Direct specialization of your target career of ${goal}`]
    };
  }

  // Strict domain classification
  const goalDomain = classifyCareerDomain(goal);
  const careerDomain = classifyCareerDomain(careerTitle);

  // Exact same occupational domain
  if (goalDomain.id === careerDomain.id) {
    const titleTokens = extractTokens(careerTitle);
    const goalTokens = extractTokens(goal);
    const commonTokens = [...titleTokens].filter(t => goalTokens.has(t));
    const isClose = commonTokens.length > 0;
    return {
      score: isClose ? 78 : 72,
      matchType: 'related',
      reasons: [`Related occupation in ${goalDomain.label} sharing core competencies with ${goal}`]
    };
  }

  // Predefined cluster check
  for (const [clusterName, clusterRoles] of Object.entries(DOMAIN_CLUSTERS)) {
    const normCluster = clusterRoles.map(normalizeText);
    const titleInCluster = normCluster.some(r => r === normTitle || normTitle.includes(r) || r.includes(normTitle));
    const goalInCluster = normCluster.some(r => r === normGoal || normGoal.includes(r) || r.includes(normGoal));

    if (titleInCluster && goalInCluster) {
      return {
        score: 65,
        matchType: 'related',
        reasons: [`Related career within the ${clusterName} domain sharing core competencies with ${goal}`]
      };
    }
  }

  // Valid cross-domain adjacent transition
  const adjacentTargets = ADJACENT_DOMAINS[goalDomain.id] || new Set();
  if (adjacentTargets.has(careerDomain.id)) {
    return {
      score: 40,
      matchType: 'transition',
      reasons: [`Transferable cross-domain career transition from ${goalDomain.label} into ${careerDomain.label}`]
    };
  }

  return {
    score: 0,
    matchType: 'unrelated',
    reasons: [`Different professional domain (${careerDomain.label}) from ${goal}`]
  };
}

export function calculateSkillRelevance(requiredSkills, userSkills) {
  if (!requiredSkills || requiredSkills.length === 0) {
    return {
      skillScore: 50,
      matchedSkills: [],
      missingSkills: []
    };
  }

  const userSkillIds = new Set(userSkills.map(s => s.id).filter(Boolean));
  const userSkillNames = new Set(userSkills.map(s => normalizeText(s.name || s.skill_name || s)));

  let matchedWeight = 0;
  let totalWeight = 0;
  const matchedSkills = [];
  const missingSkills = [];

  for (const req of requiredSkills) {
    const rawName = req.name || req.skill_name || '';
    const normName = normalizeText(rawName);
    const isGeneric = GENERIC_SOFT_SKILLS.has(normName);

    let weight = req.importance === 'required' ? 3 : (req.importance === 'important' ? 2 : 1);
    if (isGeneric) {
      weight *= 0.35; // Downweight soft generic skills
    }
    totalWeight += weight;

    const isMatch = (req.skill_id && userSkillIds.has(req.skill_id)) ||
                    userSkillNames.has(normName) ||
                    [...userSkillNames].some(us => us.includes(normName) || normName.includes(us));

    if (isMatch) {
      matchedWeight += weight;
      matchedSkills.push({
        id: req.skill_id || null,
        name: rawName,
        importance: req.importance || 'required'
      });
    } else {
      missingSkills.push({
        id: req.skill_id || null,
        name: rawName,
        importance: req.importance || 'required'
      });
    }
  }

  const skillScore = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  return {
    skillScore,
    matchedSkills,
    missingSkills
  };
}

export function calculateEducationRelevance(qualifications, education) {
  if (!education || !Array.isArray(education) || education.length === 0) {
    return 70; // Neutral baseline
  }
  if (!qualifications || !Array.isArray(qualifications) || qualifications.length === 0) {
    return 75;
  }
  const qualText = normalizeText(qualifications.join(' '));
  let matched = false;

  for (const edu of education) {
    const degree = normalizeText(edu.degree || edu.current_program || edu.qualification || '');
    const stream = normalizeText(edu.stream || edu.school_12_stream || '');
    const level = normalizeText(edu.level || '');

    if (degree && qualText.includes(degree)) matched = true;
    if (stream && qualText.includes(stream)) matched = true;
    if (level && qualText.includes(level)) matched = true;
  }

  return matched ? 90 : 65;
}

export async function getDatabaseRecommendations(userId, explicitGoal, options = {}) {
  const [profileRes, skillsRes, customSkillsRes, careersRes] = await Promise.all([
    pool.query(`SELECT education, experience, interests, preferred_locations, career_goal, current_goal, constraints FROM user_profiles WHERE user_id = $1`, [userId]),
    pool.query(`SELECT s.id, s.name, us.level FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = $1 AND s.record_status = 'published'`, [userId]),
    pool.query(`SELECT name, level FROM user_custom_skills WHERE user_id = $1`, [userId]),
    pool.query(`
      SELECT c.id, c.title, c.description, c.qualifications, c.entry_routes, c.record_status,
             COALESCE(json_agg(json_build_object(
               'skill_id', s.id,
               'name', s.name,
               'importance', cs.importance,
               'category', s.category
             )) FILTER (WHERE s.id IS NOT NULL), '[]'::json) AS required_skills
      FROM careers c
      LEFT JOIN career_skills cs ON cs.career_id = c.id
      LEFT JOIN skills s ON s.id = cs.skill_id AND s.record_status = 'published'
      WHERE c.record_status = 'published'
      GROUP BY c.id
      ORDER BY c.title
    `)
  ]);

  const profile = profileRes.rows[0] ?? null;
  const userSkills = [
    ...skillsRes.rows,
    ...customSkillsRes.rows.map(s => ({ id: null, name: s.name, level: s.level }))
  ];
  const goal = resolveUserGoal(profile, explicitGoal);
  const preferredLocations = options.preferred_locations || profile?.preferred_locations || [];

  const candidates = [];

  for (const career of careersRes.rows) {
    const goalRel = calculateGoalRelevance(career.title, goal);
    const skillRel = calculateSkillRelevance(career.required_skills, userSkills);
    const eduScore = calculateEducationRelevance(career.qualifications, profile?.education);
    const locScore = preferredLocations.length > 0 ? 85 : 80;

    let compositeScore = 0;
    if (goalRel.matchType === 'direct') {
      compositeScore = Math.round(goalRel.score * 0.60 + skillRel.skillScore * 0.30 + eduScore * 0.10);
      compositeScore = Math.max(70, Math.min(99, compositeScore));
    } else if (goalRel.matchType === 'related') {
      compositeScore = Math.round(goalRel.score * 0.50 + skillRel.skillScore * 0.35 + eduScore * 0.15);
      compositeScore = Math.max(50, Math.min(88, compositeScore));
    } else if (goalRel.matchType === 'transition' || goalRel.matchType === 'pathway') {
      compositeScore = Math.round(goalRel.score * 0.40 + skillRel.skillScore * 0.40 + eduScore * 0.20);
      compositeScore = Math.max(35, Math.min(70, compositeScore));
    } else if (goalRel.matchType === 'general') {
      compositeScore = Math.round(skillRel.skillScore * 0.70 + eduScore * 0.20 + locScore * 0.10);
    } else {
      // Unrelated domain
      compositeScore = 0;
    }

    // Build human-friendly match explanation
    let reasoning = '';
    const matchedNames = skillRel.matchedSkills.slice(0, 4).map(s => s.name);
    const missingNames = skillRel.missingSkills.slice(0, 4).map(s => s.name);

    if (goalRel.matchType === 'direct') {
      reasoning = `Direct match for your stated ambition of ${goal}.`;
      if (matchedNames.length > 0) {
        reasoning += ` Aligns with your demonstrated skills in ${matchedNames.join(', ')}.`;
      }
      if (missingNames.length > 0) {
        reasoning += ` Recommended next skills to build: ${missingNames.join(', ')}.`;
      }
    } else if (goalRel.matchType === 'related') {
      reasoning = `${goalRel.reasons[0]}.`;
      if (matchedNames.length > 0) {
        reasoning += ` Bridges with your existing skills in ${matchedNames.join(', ')}.`;
      }
    } else if (goalRel.matchType === 'transition' || goalRel.matchType === 'pathway') {
      reasoning = `${goalRel.reasons[0]}.`;
    } else if (goalRel.matchType === 'general') {
      reasoning = matchedNames.length > 0
        ? `Matches your profile on ${matchedNames.join(', ')}.`
        : 'Available catalogue career aligned with your general educational background.';
    } else {
      reasoning = `Different professional domain from ${goal}.`;
    }

    // Exclude completely unrelated careers when a goal is present
    if (goal && goalRel.matchType === 'unrelated') {
      continue;
    }

    candidates.push({
      career_id: career.id,
      title: career.title,
      description: career.description,
      match_type: goalRel.matchType,
      score: compositeScore,
      match_score: compositeScore,
      goal_score: goalRel.score,
      skill_score: skillRel.skillScore,
      reasoning,
      matched_skills: skillRel.matchedSkills.map(s => s.name),
      missing_skills: skillRel.missingSkills.slice(0, 6).map(s => s.name),
      source: 'database',
      verified: true
    });
  }

  // Sort groups: direct matches first, then related, then pathways / transitions.
  // Goal relevance is a tie-breaker after the composite score so an exact
  // requested title stays ahead of merely equivalent aliases when score caps
  // flatten several candidates to the same value.
  const canonicalGoalTitle = goal
    ? Object.entries(CAREER_SYNONYMS).find(([canonical, aliases]) => {
      const normalizedGoal = normalizeText(goal);
      return normalizeText(canonical) === normalizedGoal || aliases.some(alias => normalizeText(alias) === normalizedGoal);
    })?.[0] || null
    : null;

  const rankCandidates = (a, b) =>
    b.score - a.score ||
    (canonicalGoalTitle && normalizeText(b.title) === normalizeText(canonicalGoalTitle) ? 1 : 0) -
      (canonicalGoalTitle && normalizeText(a.title) === normalizeText(canonicalGoalTitle) ? 1 : 0) ||
    b.goal_score - a.goal_score ||
    a.title.localeCompare(b.title);

  const directMatches = candidates
    .filter(c => c.match_type === 'direct')
    .sort(rankCandidates);

  const relatedCareers = candidates
    .filter(c => c.match_type === 'related')
    .sort(rankCandidates);

  const alternativePathways = candidates
    .filter(c => c.match_type === 'transition' || c.match_type === 'pathway' || c.match_type === 'general')
    .sort(rankCandidates);

  const rankedAll = [
    ...directMatches,
    ...relatedCareers,
    ...alternativePathways
  ];

  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(options.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const paginated = rankedAll.slice(offset, offset + limit);

  return {
    goal,
    profile,
    user_skills: userSkills,
    results: paginated,
    groups: {
      direct_matches: directMatches,
      related_careers: relatedCareers,
      career_transitions: alternativePathways.filter(c => c.match_type === 'transition'),
      alternative_pathways: alternativePathways
    },
    pagination: {
      page,
      limit,
      total: rankedAll.length,
      total_pages: Math.ceil(rankedAll.length / limit) || 1
    }
  };
}

export async function buildRecommendationContext(userId, goal, preferences) {
  const [profile, skills, customSkills, careers] = await Promise.all([
    pool.query(`SELECT education, experience, interests, preferred_locations, career_goal, current_goal, constraints FROM user_profiles WHERE user_id = $1`, [userId]),
    pool.query(`SELECT s.id, s.name, us.level FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = $1 AND s.record_status = 'published'`, [userId]),
    pool.query(`SELECT name, level FROM user_custom_skills WHERE user_id = $1`, [userId]),
    pool.query(`SELECT c.id, c.title, c.description, c.qualifications, c.entry_routes FROM careers c WHERE c.record_status = 'published' ORDER BY c.title`)
  ]);

  const allSkills = [
    ...skills.rows,
    ...customSkills.rows.map(s => ({ id: null, name: s.name, level: s.level }))
  ];

  const ids = careers.rows.map((c) => c.id);
  const mappings = ids.length ? await pool.query(
    `SELECT cs.career_id, s.id AS skill_id, s.name, cs.importance 
     FROM career_skills cs 
     JOIN skills s ON s.id = cs.skill_id 
     WHERE cs.career_id = ANY($1::uuid[]) AND s.record_status = 'published'`,
    [ids]
  ) : { rows: [] };

  const byCareer = new Map();
  for (const row of mappings.rows) {
    if (!byCareer.has(row.career_id)) byCareer.set(row.career_id, []);
    byCareer.get(row.career_id).push(row);
  }

  const resolvedGoal = resolveUserGoal(profile.rows[0], goal);

  return {
    profile: profile.rows[0] ?? null,
    skills: allSkills,
    careers: careers.rows.map((c) => ({ ...c, required_skills: byCareer.get(c.id) ?? [] })),
    goal: resolvedGoal,
    preferences: preferences ?? {}
  };
}

export async function saveRecommendation(userId, goal, preferences, results) {
  const result = await pool.query(
    `INSERT INTO recommendations (user_id, goal, preferences, results) 
     VALUES ($1, $2, $3, $4) 
     RETURNING id, created_at`,
    [userId, goal ?? null, preferences ?? {}, JSON.stringify(results)]
  );
  return result.rows[0];
}
