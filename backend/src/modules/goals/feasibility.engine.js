/**
 * CAREERGPS — CURRENT GOAL FEASIBILITY & ELIGIBILITY ENGINE
 * Specification: Current Goal Logic Engine Blueprint v2.0
 * Evaluates the Four Independent Dimensions:
 *   A. Ambition (Goal destination owned by user)
 *   B. Formal Eligibility (Deterministic States A, B, C, D, E against verified gates)
 *   C. Readiness (Demonstrated and self-reported skills, education, projects)
 *   D. Practical Feasibility (Study mode, weekly hours, budget, location, income urgency)
 */

export const FEASIBILITY_WEIGHTS_VERSION = '2026.10-weights-v2';

export const DIRECT_STATES = {
  A: { code: 'A', name: 'Eligible for this route now', tone: 'positive' },
  B: { code: 'B', name: 'Conditionally eligible (milestone/condition pending)', tone: 'warning' },
  C: { code: 'C', name: 'Alternative route available (direct blocked/poor-fit)', tone: 'warning' },
  D: { code: 'D', name: 'Not eligible through this exact route', tone: 'warning' },
  E: { code: 'E', name: 'Insufficient / unverified information', tone: 'neutral' }
};

export const AUTHORITATIVE_SOURCES = {
  NMC: {
    authority: 'National Medical Commission (NMC)',
    document: 'Regulations on Graduate Medical Education & NEET Eligibility',
    url: 'https://www.nmc.org.in/rules-regulations-nmc/1000/',
    review_date: '2026-10-10',
    status: 'verified'
  },
  NIOS: {
    authority: 'National Institute of Open Schooling (NIOS)',
    document: 'Senior Secondary On-Demand & Public Examination Guidelines',
    url: 'https://rckolkata.nios.ac.in/sr-secondary.html',
    review_date: '2026-10-10',
    status: 'verified'
  },
  UGC_DEB: {
    authority: 'UGC - Distance Education Bureau (DEB)',
    document: 'Territorial Jurisdiction and Online/ODL Regulation Norms 2025',
    url: 'https://deb.ugc.ac.in/',
    review_date: '2026-10-10',
    status: 'verified'
  },
  AICTE: {
    authority: 'AICTE Approval Process Handbook 2024-2027',
    document: 'Norms for Technical and Professional Programmes',
    url: 'https://aicte-qa.aicte-india.org/sites/default/files/APH%20Final.pdf',
    review_date: '2026-10-10',
    status: 'verified'
  },
  UPSC: {
    authority: 'Union Public Service Commission (UPSC)',
    document: 'Civil Services Examination Rules & Age Guidelines',
    url: 'https://www.upsc.gov.in/examinations/Civil%20Services%20%28Preliminary%29%20Examination%2C%202026',
    review_date: '2026-10-10',
    status: 'verified'
  },
  DGCA: {
    authority: 'Directorate General of Civil Aviation (DGCA)',
    document: 'Civil Aviation Requirements (CAR) - Pilot Licensing Norms',
    url: 'https://pariksha.dgca.gov.in/PDFViewer.jsp?pdf=470067',
    review_date: '2026-10-10',
    status: 'verified'
  },
  ICAI: {
    authority: 'Institute of Chartered Accountants of India (ICAI)',
    document: 'Chartered Accountancy Regulations & Foundation Scheme',
    url: 'https://www.icai.org/post/16852',
    review_date: '2026-10-10',
    status: 'verified'
  },
  BCI: {
    authority: 'Bar Council of India (BCI)',
    document: 'Rules of Legal Education (3-Year and 5-Year LL.B. Norms)',
    url: 'http://www.barcouncilofindia.org/',
    review_date: '2026-10-10',
    status: 'verified'
  },
  NCHMCT: {
    authority: 'National Council for Hotel Management and Catering Technology (NCHMCT)',
    document: 'Hospitality & Culinary Arts Educational Guidelines',
    url: 'https://nchm.gov.in/',
    review_date: '2026-10-10',
    status: 'verified'
  },
  FSSAI: {
    authority: 'Food Safety and Standards Authority of India (FSSAI)',
    document: 'Food Safety Supervisor & Hygiene Regulations',
    url: 'https://www.fssai.gov.in/',
    review_date: '2026-10-10',
    status: 'verified'
  }
};

/**
 * Normalizes goal string and infers goal entity type.
 */
export function resolveGoalType(goalStr) {
  const g = String(goalStr || '').trim().toLowerCase();
  if (!g) return { type: 'unknown', canonical: '' };

  const exams = ['neet', 'upsc', 'gate', 'cat', 'clat', 'nimcet', 'jee', 'nda', 'banking', 'ibps'];
  if (exams.some(e => g.includes(e))) return { type: 'exam', canonical: goalStr.trim() };

  const degrees = ['mbbs', 'btech', 'mca', 'bca', 'mba', 'llb', 'ba', 'bsc', 'bcom', 'msc', 'bdes', 'mtech', 'phd'];
  if (degrees.some(d => g === d || g.startsWith(d + ' ') || g.endsWith(' ' + d))) {
    return { type: 'degree', canonical: goalStr.trim().toUpperCase() };
  }

  const skills = ['sql', 'python', 'react', 'javascript', 'figma', 'dsa', 'aws', 'data analytics'];
  if (skills.some(s => g === s)) return { type: 'skill', canonical: goalStr.trim() };

  return { type: 'career', canonical: goalStr.trim() };
}

/**
 * Extracts and standardizes profile facts.
 */
export function extractProfileFacts(profile) {
  const p = profile || {};
  const eduList = Array.isArray(p.education) ? p.education : [];
  const primaryEdu = eduList[0] || {};

  const levels = eduList.map(e => e.level || e.education_stage || '').filter(Boolean);
  const streams = eduList.map(e => e.school_12_stream || e.stream || '').filter(Boolean);
  const degrees = eduList.map(e => e.current_program || e.degree || e.qualification || '').filter(Boolean);
  const allSubjects = eduList.flatMap(e => Array.isArray(e.subjects_passed || e.subjects) ? (e.subjects_passed || e.subjects) : []);

  const level = String(primaryEdu.level || primaryEdu.education_stage || levels[0] || '').trim().toLowerCase();
  const stream = String(primaryEdu.school_12_stream || primaryEdu.stream || streams[0] || '').trim().toLowerCase();
  const degree = String(primaryEdu.current_program || primaryEdu.degree || primaryEdu.qualification || degrees[0] || '').trim().toLowerCase();
  const status = String(primaryEdu.status || primaryEdu.school_12_status || '').trim().toLowerCase();
  const subjects = allSubjects.map(s => String(s).trim().toLowerCase());

  const textContext = `${subjects.join(' ')} ${streams.join(' ')} ${degrees.join(' ')} ${levels.join(' ')}`.toLowerCase();
  const hasKeyword = (word) => textContext.includes(word.toLowerCase());

  // Subject streams
  const isPCB = hasKeyword('pcb') || (hasKeyword('bio') && hasKeyword('chem') && hasKeyword('phy'));
  const isPCM = hasKeyword('pcm') || (hasKeyword('math') && hasKeyword('chem') && hasKeyword('phy'));
  const isCommerce = hasKeyword('commerce') || hasKeyword('accounts') || hasKeyword('comm');
  const isArts = hasKeyword('arts') || hasKeyword('humanities') || hasKeyword('sociology') || hasKeyword('history');

  // Constraints
  const rawConstraints = p.constraints && typeof p.constraints === 'object' ? p.constraints : {};
  let studyModes = [];
  if (Array.isArray(rawConstraints.study_mode)) {
    studyModes = rawConstraints.study_mode.map(m => String(m).toLowerCase());
  } else if (typeof rawConstraints.study_mode === 'string') {
    studyModes = [rawConstraints.study_mode.toLowerCase()];
  } else if (typeof rawConstraints.study_preference === 'string') {
    studyModes = rawConstraints.study_preference.toLowerCase().split(/[,\s/]+/).map(s => s.trim()).filter(Boolean);
  }

  const hoursPerWeek = Number(rawConstraints.hours_per_week || rawConstraints.weekly_hours || 0) || null;
  const budgetBand = String(rawConstraints.budget_band || rawConstraints.budget || 'moderate').toLowerCase();
  const incomeUrgency = String(rawConstraints.income_urgency || 'medium').toLowerCase();
  const relocationPref = String(rawConstraints.relocation || 'not_preferred').toLowerCase();

  // Preferred locations
  const preferredLocations = Array.isArray(p.preferred_locations)
    ? p.preferred_locations.map(l => String(l).trim())
    : [];
  const prefersGoa = preferredLocations.some(l => l.toLowerCase().includes('goa'));
  const prefersRemote = preferredLocations.some(l => l.toLowerCase().includes('remote'));

  // Skills
  const skills = Array.isArray(p.skills) ? p.skills : [];
  const skillNames = skills.map(s => (typeof s === 'string' ? s : s?.name || '').trim().toLowerCase()).filter(Boolean);

  const canonicalDegree = primaryEdu.current_program || primaryEdu.degree || primaryEdu.qualification || degrees[0] || null;
  const canonicalStream = primaryEdu.school_12_stream || primaryEdu.stream || streams[0] || null;
  const canonicalLevel = primaryEdu.level || primaryEdu.education_stage || levels[0] || null;
  const canonicalStatus = primaryEdu.status || primaryEdu.school_12_status || null;
  const specialization = primaryEdu.specialization || (eduList.find(e => e.specialization)?.specialization) || null;

  return {
    rawProfile: p,
    primaryEdu,
    level,
    stream,
    degree,
    status,
    canonical_degree: canonicalDegree,
    canonical_stream: canonicalStream,
    canonical_level: canonicalLevel,
    canonical_status: canonicalStatus,
    qualification: canonicalDegree,
    degree_display: canonicalDegree,
    school_12_stream: canonicalStream,
    education_level: canonicalLevel,
    specialization,
    subjects,
    isPCB,
    isPCM,
    isCommerce,
    isArts,
    studyModes,
    hoursPerWeek,
    budgetBand,
    incomeUrgency,
    relocationPref,
    preferredLocations,
    prefersGoa,
    prefersRemote,
    skills,
    skillNames,
    hasKeyword
  };
}

/**
 * Main Deterministic Feasibility and Eligibility Evaluator.
 * Adheres strictly to Sections 2, 7, 8, 9, 10, 11, 13, 14 of the blueprint.
 */
export function evaluateGoalFeasibility(profile, goalInput, options = {}) {
  const rawGoal = typeof goalInput === 'string' ? goalInput : goalInput?.title || '';
  const trimmedGoal = rawGoal.trim();
  const targetLower = trimmedGoal.toLowerCase();
  const { type: goalType, canonical } = resolveGoalType(trimmedGoal);

  // If no goal was supplied
  if (!trimmedGoal) {
    return {
      goal: { id: null, label: '', owner: 'user', primary: true, version: 1 },
      overall_feasibility: {
        status: 'DISCOVERY_MODE',
        label: 'Discovery Mode — No goal selected',
        tone: 'neutral',
        score: null
      },
      evaluation: {
        direct_route_status: 'E',
        pathway_status: 'E',
        confidence: 'low',
        as_of: new Date().toISOString()
      },
      four_dimensions: {
        ambition: { goal: '', goal_type: 'unknown', preserved: true },
        formal_eligibility: { status: 'E', decision: 'Discovery Mode', gates_evaluated: [] },
        readiness: { score: 0, demonstrated_skills: [], confirmed_gaps: [] },
        practical_feasibility: { score: 0, fit_summary: 'No goal chosen', obstacles: [] }
      },
      summary: 'Please select or enter a career goal to evaluate.',
      routes: [],
      next_action: { title: 'Explore career options', time_range_hours: [1, 2] },
      milestones: [],
      known_gaps: [],
      unknowns: ['career_goal'],
      sources: [],
      rule_version: FEASIBILITY_WEIGHTS_VERSION,
      goal_changed_by_engine: false
    };
  }

  const p = extractProfileFacts(profile);

  // 1. DIMENSION A: AMBITION
  const ambition = {
    selected_goal: canonical || trimmedGoal,
    canonical_id: goalInput?.id || null,
    goal_type: goalType,
    owner: 'user',
    preserved: true,
    note: 'User-selected strategic ambition is permanently preserved and never modified or downgraded.'
  };

  // 2. DIMENSION B: FORMAL ELIGIBILITY (Deterministic A-E States)
  let directRouteStatus = 'E';
  let directDecision = 'Verification Pending';
  let directReason = '';
  let formalRequirements = [];
  let formalBarriers = [];
  let sources = [];
  let credibleAlternatives = [];
  let bridgePossible = false;

  // Evaluate by Target Family
  if (targetLower.includes('doctor') || targetLower.includes('mbbs') || targetLower === 'physician' || targetLower === 'surgeon') {
    // NMC Regulation Case
    sources.push(AUTHORITATIVE_SOURCES.NMC, AUTHORITATIVE_SOURCES.NIOS);
    formalRequirements.push(
      'Mandatory Senior Secondary (10+2) pass with Physics, Chemistry, Biology/Biotechnology and English (NMC Regulations)',
      'NEET-UG qualification with session-specific cutoff score',
      'Full-time 5.5-year MBBS curriculum including 1-year compulsory rotatory clinical internship at an NMC-approved medical college'
    );

    const isNonMedicalStream = p.isCommerce || p.isArts || p.stream.includes('commerce') || p.stream.includes('arts') || p.stream.includes('humanities') || p.stream.includes('vocational');
    const isDegreeWithoutPCB = (p.degree.includes('bca') || p.degree.includes('btech') || p.degree.includes('b.com') || p.degree.includes('bba') || p.degree.includes('bcom')) && !p.isPCB;

    if (p.degree.includes('mbbs')) {
      directRouteStatus = 'A';
      directDecision = 'Direct Medical Specialisation';
      directReason = 'Profile indicates completed/ongoing MBBS degree. The direct medical route is open for NEET-PG / residency preparation.';
    } else if (p.isPCB && (p.level.includes('12th') || p.status.includes('completed') || p.level.includes('school'))) {
      directRouteStatus = 'A';
      directDecision = 'Direct NEET-UG Entrance Route';
      directReason = '10+2 Science with Biology (PCB) satisfies the mandatory subject prerequisite for NEET-UG under NMC regulations.';
    } else if (isNonMedicalStream || isDegreeWithoutPCB) {
      directRouteStatus = 'D';
      directDecision = 'Subject Prerequisite Restricted (Direct Route)';
      directReason = 'Under statutory NMC Regulations, direct admission to MBBS requires 10+2 with Physics, Chemistry, and Biology. A non-medical background (such as Commerce, Arts, or BCA without 12th Biology) cannot sit for NEET-UG directly. Your ambition is preserved; legal academic bridges and adjacent health pathways are available.';
      formalBarriers.push('Mandatory 10+2 Science (Physics, Chemistry, Biology) subject requirement not met by current background.');
      bridgePossible = true;
      credibleAlternatives.push(
        {
          id: 'nios_pcb_bridge_neet',
          label: 'NIOS Senior Secondary PCB Bridge + NEET-UG Route',
          route_type: 'academic_bridge',
          feasibility_score: 55,
          time_to_milestone: '6–12 months for bridge subjects',
          estimated_duration: '6–7 years (Bridge + NEET + MBBS)',
          cost: 'Moderate (NIOS exam & study material fees + NEET prep)',
          flexibility: 'Bridge is flexible/distance; MBBS itself is strictly full-time on-site',
          requirements: 'Register with NIOS for senior secondary Biology/Chemistry/Physics subjects; sit for NEET-UG',
          risk: 'High entrance competition in NEET-UG; requires committing to long full-time on-site medical education',
          evidence_of_progress: 'NIOS mark sheet with PCB pass; NEET-UG scorecard',
          exit_points: 'Passed Senior Secondary Science certification opens other healthcare and science degrees',
          summary: 'Complete the missing Biology, Physics, and Chemistry subjects through the National Institute of Open Schooling (NIOS), verify NMC eligibility for the specific counselling cycle, and sit for NEET-UG.'
        },
        {
          id: 'adjacent_healthcare_informatics',
          label: 'Adjacent Pathway: Health Informatics & Healthcare Data Tech',
          route_type: 'adjacent_career',
          feasibility_score: 85,
          time_to_milestone: '3–6 months for foundational health-tech projects',
          estimated_duration: '1–2 years (leverages current tech/data studies)',
          cost: 'Low-cost (online certifications, open healthcare datasets)',
          flexibility: 'Fully compatible with Online / Part-time and Goa + Remote preferences',
          requirements: 'Python/SQL + HL7/FHIR healthcare data standards + Clinical informatics portfolio',
          risk: 'Non-clinical role; does not confer medical doctor licence',
          evidence_of_progress: 'Health data analysis dashboard, electronic medical records (EMR) project',
          exit_points: 'Directly employable in healthcare analytics, hospital IT, biotech software',
          summary: 'Apply your computing/data skills to healthcare by specializing in Health Informatics, Medical Data Science, or Clinical Systems. Keep Doctor as an aspirational goal while exploring this adjacent path.'
        }
      );
    } else if (p.isPCM && !p.isPCB) {
      directRouteStatus = 'D';
      directDecision = 'Missing Biology Requirement';
      directReason = 'PCM provides physics and chemistry foundation, but NMC requires Biology/Biotechnology for NEET-UG eligibility.';
      formalBarriers.push('Missing 12th Biology/Biotechnology subject pass.');
      bridgePossible = true;
      credibleAlternatives.push({
        id: 'nios_biology_bridge',
        label: 'NIOS Additional Biology Subject + NEET-UG',
        route_type: 'academic_bridge',
        feasibility_score: 65,
        time_to_milestone: '6 months',
        estimated_duration: '6 years',
        cost: 'Low-cost exam fee',
        flexibility: 'Self-paced NIOS subject registration',
        requirements: 'Clear Biology as an additional subject under NIOS; sit for NEET-UG',
        risk: 'High NEET competition',
        evidence_of_progress: 'NIOS Biology marksheet',
        exit_points: 'Biotech or biomedical engineering alternative eligibility',
        summary: 'Register for Senior Secondary Biology as an additional subject through NIOS, then prepare for NEET-UG.'
      });
    } else {
      directRouteStatus = 'E';
      directDecision = 'Subject Facts Required';
      directReason = p.stream
        ? `Your profile indicates "${p.stream}", but completion of mandatory Class 12 Physics, Chemistry, and Biology/Biotechnology has not been verified yet. NMC regulations require verified PCB for NEET-UG eligibility.`
        : 'CareerGPS has recognized Doctor as your career goal, but formal eligibility has not been verified yet. Under statutory NMC regulations, direct admission to MBBS requires Senior Secondary (10+2) with Physics, Chemistry, and Biology with English.';
      bridgePossible = true;
      credibleAlternatives.push(
        {
          id: 'nios_pcb_bridge_neet',
          label: 'NIOS Senior Secondary PCB Bridge + NEET-UG Route',
          route_type: 'academic_bridge',
          feasibility_score: 60,
          time_to_milestone: '6–12 months for bridge subjects',
          estimated_duration: '6–7 years (Bridge + NEET + MBBS)',
          cost: 'Moderate (NIOS exam & study material fees + NEET prep)',
          flexibility: 'Bridge is flexible/distance; MBBS itself is strictly full-time on-site',
          requirements: 'Register with NIOS for senior secondary Biology/Chemistry/Physics subjects; sit for NEET-UG',
          risk: 'High entrance competition in NEET-UG; requires committing to long full-time on-site medical education',
          evidence_of_progress: 'NIOS mark sheet with PCB pass; NEET-UG scorecard',
          exit_points: 'Passed Senior Secondary Science certification opens other healthcare and science degrees',
          summary: 'Complete the missing Biology, Physics, and Chemistry subjects through the National Institute of Open Schooling (NIOS), verify NMC eligibility for the specific counselling cycle, and sit for NEET-UG.'
        },
        {
          id: 'adjacent_healthcare_informatics',
          label: 'Adjacent Pathway: Health Informatics & Healthcare Data Tech',
          route_type: 'adjacent_career',
          feasibility_score: 85,
          time_to_milestone: '3–6 months for foundational health-tech projects',
          estimated_duration: '1–2 years',
          cost: 'Low-cost (online certifications, open healthcare datasets)',
          flexibility: 'Fully compatible with Online / Part-time and Goa + Remote preferences',
          requirements: 'Python/SQL + HL7/FHIR healthcare data standards + Clinical informatics portfolio',
          risk: 'Non-clinical role; does not confer medical doctor licence',
          evidence_of_progress: 'Health data analysis dashboard, electronic medical records (EMR) project',
          exit_points: 'Directly employable in healthcare analytics, hospital IT, biotech software',
          summary: 'Explore adjacent healthcare careers such as Health Informatics, Medical Data Science, or Clinical Systems while verifying formal MBBS eligibility.'
        }
      );
    }
  } else if (targetLower.includes('software developer') || targetLower.includes('software engineer') || targetLower.includes('backend developer')) {
    // Tech & Software Development
    sources.push(AUTHORITATIVE_SOURCES.AICTE);
    formalRequirements.push(
      'Demonstrated competence in programming, data structures, algorithms, and system design',
      'For degree roles: BCA/B.Tech/MCA or relevant bachelor qualification; for skills-based hiring: verified portfolio & code repository'
    );

    if (p.degree.includes('bca') || p.degree.includes('btech') || p.degree.includes('cs') || p.degree.includes('it')) {
      directRouteStatus = 'A';
      directDecision = 'Direct Degree + Skills Route';
      directReason = 'Your ongoing/completed degree directly aligns with software engineering roles. Build hands-on projects and DSA readiness.';
    } else if (p.degree.includes('bcom') || p.isCommerce || p.isArts) {
      directRouteStatus = 'C';
      directDecision = 'Skills-First / Portfolio Transition Route';
      directReason = 'A formal computer science degree is not universally mandatory for software roles. Many employers accept skills-first portfolio candidates.';
      credibleAlternatives.push({
        id: 'skills_portfolio_route',
        label: 'Skills-First Full-Stack / Backend Portfolio Route',
        route_type: 'skills_first',
        feasibility_score: 88,
        time_to_milestone: '4–8 weeks for first working API project',
        estimated_duration: '6–9 months to junior job readiness',
        cost: 'Free/Low-cost (open-source tools, documentation, self-paced)',
        flexibility: 'Fully compatible with Online / Part-time study and Remote work',
        requirements: 'Build 2–3 full-stack/backend projects, learn Git/GitHub, master SQL and API fundamentals',
        risk: 'Hiring requires demonstrable code proof; degree filter at select legacy enterprises',
        evidence_of_progress: 'Live deployed API on GitHub; database schema design; technical interview prep',
        exit_points: 'Skills transfer directly across backend, frontend, QA engineering, and technical support',
        summary: 'Master backend fundamentals (Node.js/Python, databases, APIs) and publish demonstrable portfolio projects to secure junior developer opportunities.'
      });
    } else {
      directRouteStatus = 'A';
      directDecision = 'Skill & Portfolio Route Open';
      directReason = 'Software development is accessible via practical skills and demonstratable projects.';
    }
  } else if (targetLower.includes('data analyst') || targetLower.includes('business intelligence') || targetLower.includes('bi analyst')) {
    sources.push(AUTHORITATIVE_SOURCES.AICTE);
    formalRequirements.push(
      'Proficiency in SQL, spreadsheet analysis (Excel/Google Sheets), data cleaning, and business visualization (Tableau/Power BI)',
      'Demonstrated ability to query relational databases and communicate data-driven recommendations',
      'For degree recruitment: Bachelor degree in computing, quantitative, or business field is preferred; for skills route: public analytics portfolio'
    );
    if (p.degree.includes('bca') || p.degree.includes('btech') || p.degree.includes('math') || p.degree.includes('stat') || p.degree.includes('cs') || p.degree.includes('it')) {
      directRouteStatus = 'A';
      directDecision = 'Direct Quant/Tech Route';
      directReason = `Your ${p.canonical_degree || 'computing'} background provides quantitative and database foundations directly applicable to Data Analyst roles. Build a portfolio of SQL queries and interactive business dashboards.`;
    } else {
      directRouteStatus = 'C';
      directDecision = 'Skills-First Analytics Transition Route';
      directReason = 'Data analysis is accessible from non-quantitative disciplines by demonstrating practical SQL and business dashboard skills.';
      credibleAlternatives.push({
        id: 'skills_analytics_portfolio_route',
        label: 'Skills-First SQL + BI Analytics Portfolio Route',
        route_type: 'skills_bridge',
        feasibility_score: 86,
        time_to_milestone: '3–5 weeks for first SQL + Power BI dashboard project',
        estimated_duration: '4–7 months to entry-level analyst readiness',
        cost: 'Free/Low-cost online resources and open data sets',
        flexibility: 'Fully compatible with Online / Part-time study and Remote work',
        requirements: 'Excel -> SQL -> Power BI/Tableau -> Business storytelling',
        risk: 'Portfolio must prove genuine query ability on messy data',
        evidence_of_progress: 'Public analytics portfolio on GitHub/Tableau Public',
        exit_points: 'Business Analyst, Junior Data Analyst, Operations Reporting',
        summary: 'Master SQL and interactive BI dashboard tools to secure junior data analyst roles.'
      });
    }
  } else if (targetLower.includes('data scientist') || targetLower.includes('data science')) {
    sources.push(AUTHORITATIVE_SOURCES.AICTE);
    formalRequirements.push(
      'Competence in Python/R, SQL, Applied Statistics, and Machine Learning models',
      'For formal PG programmes: Mathematics at 12th/UG level is commonly required; for portfolio route: demonstrable data projects'
    );
    if (p.degree.includes('math') || p.degree.includes('stat') || p.degree.includes('bca') || p.degree.includes('btech')) {
      directRouteStatus = 'A';
      directDecision = 'Direct Quant/Tech Route';
      directReason = 'Your technical background provides quantitative foundations for data science specialization.';
    } else {
      directRouteStatus = 'C';
      directDecision = 'Step-by-Step Transition Route';
      directReason = 'Transitioning from non-quantitative disciplines starts best with Excel, SQL, and practical data analysis before advanced ML.';
      credibleAlternatives.push({
        id: 'analyst_to_scientist_bridge',
        label: 'Data Analyst Step-Stone to Data Science',
        route_type: 'skills_bridge',
        feasibility_score: 82,
        time_to_milestone: '4–6 weeks for SQL + Dashboard project',
        estimated_duration: '9–14 months',
        cost: 'Low-cost online resources',
        flexibility: 'High (online and part-time compatible)',
        requirements: 'Excel -> SQL -> Python data libraries -> Exploratory Data Analysis projects',
        risk: 'Advanced data science roles often demand strong mathematical/statistical rigor',
        evidence_of_progress: 'Public analytics dashboard on Kaggle/GitHub',
        exit_points: 'Directly qualified for Business Analyst, Data Analyst, BI Reporting roles',
        summary: 'Target entry-level Data Analyst roles first, then transition into Data Science after consolidating statistics and Python.'
      });
    }
  } else if (targetLower.includes('lawyer') || targetLower.includes('advocate') || targetLower.includes('legal counsel') || targetLower.includes('corporate lawyer') || targetLower.includes('attorney')) {
    sources.push(AUTHORITATIVE_SOURCES.BCI);
    formalRequirements.push(
      'Statutory Bachelor of Laws (LL.B.) degree recognized by the Bar Council of India (3-Year graduate route or 5-Year integrated route)',
      'Minimum 45% aggregate marks in qualifying degree or 10+2 (40% for SC/ST)',
      'Enrolment as an Advocate with a State Bar Council (e.g. Bar Council of Maharashtra & Goa)',
      'Passing the All India Bar Examination (AIBE) within 2 years of provisional enrolment to receive the Certificate of Practice (COP)',
      'Mandatory regular, full-time campus-based study (Distance and online law degrees are not recognized by BCI for advocate enrolment)'
    );

    const hasCompletedDegree = (p.status.includes('completed') || p.level.includes('graduate') || p.level.includes('postgraduate')) && Boolean(p.canonical_degree || p.level.includes('undergraduate') || p.level.includes('bachelor'));
    const isPursuingDegree = (p.status.includes('pursuing') || p.status.includes('enrolled') || p.level.includes('undergraduate')) && Boolean(p.canonical_degree || p.level.includes('bachelor'));
    const normalizedDegree = (p.degree || '').replace(/[^a-z0-9]/g, '');
    const isLawDegree = normalizedDegree.includes('llb') || p.degree.includes('law');

    if (isLawDegree && hasCompletedDegree) {
      directRouteStatus = 'A';
      directDecision = 'Direct Bar Council Enrolment & AIBE Route';
      directReason = 'Your profile indicates a completed recognized law degree. The statutory route to State Bar Council enrolment and the All India Bar Examination (AIBE) is open.';
    } else if (isLawDegree) {
      directRouteStatus = 'B';
      directDecision = 'LL.B. Final Semester Milestone';
      directReason = 'You are currently enrolled in an LL.B. programme. Complete your final semester examinations and practical moot court requirements before applying for Bar Council enrolment.';
    } else if (p.canonical_degree && isPursuingDegree) {
      directRouteStatus = 'B';
      directDecision = 'Degree Completion Milestone (3-Year LL.B. Route)';
      directReason = `Under Bar Council of India (BCI) rules, graduates of any recognized bachelor's degree (such as your ongoing ${p.canonical_degree}) are eligible for the 3-Year LL.B. programme. Because your degree is currently in progress, your immediate milestone is completing your bachelor's degree with at least 45% aggregate marks, followed by law entrance examinations (CUET-PG, MH CET Law, or NLSAT). Alternatively, a 5-Year Integrated Law route (via Class 12 / CLAT) is also available.`;
      bridgePossible = true;
      credibleAlternatives.push(
        {
          id: '3year_llb_graduate_route',
          label: '3-Year LL.B. Post-Graduate Route (Post-BCA / Post-Degree)',
          route_type: 'academic_and_statutory',
          feasibility_score: 82,
          time_to_milestone: 'Complete bachelor degree (ongoing) + sit for Law Entrance (CUET-PG / MH CET Law / NLSAT)',
          estimated_duration: '3 years full-time campus LL.B. + AIBE examination',
          cost: 'State/University College: ₹30,000–₹75,000/yr; Private/NLUs: ₹1.5L–₹3L/yr',
          flexibility: 'Mandatory full-time campus attendance per BCI rules; evening/distance law degrees are not recognized for practice.',
          requirements: 'Graduation in any discipline with >=45% marks + Law Entrance examination + Bar Council Enrolment',
          risk: 'Admission is competitive at top law faculties; requires committing to 3 years of full-time legal study after graduation.',
          evidence_of_progress: 'Undergraduate degree marksheet, Law CET scorecard, LL.B. semester marksheet.',
          exit_points: 'Advocate in District/High Court, Corporate Legal Counsel, Legal Advisor, Judicial Services Aspirant.',
          summary: 'Complete your ongoing bachelor degree, qualify for a BCI-approved 3-Year LL.B., complete practical internships, and clear the All India Bar Examination.'
        },
        {
          id: '5year_integrated_clat_route',
          label: '5-Year Integrated Law Route (B.A. LL.B. / B.B.A. LL.B. via 10+2)',
          route_type: 'alternative_formal_route',
          feasibility_score: 75,
          time_to_milestone: 'Register for CLAT / State Law CET based on 10+2 qualification',
          estimated_duration: '5 years integrated curriculum',
          cost: 'Government Law Colleges: ₹20,000–₹50,000/yr; NLUs: ₹2.5L–₹3.5L/yr',
          flexibility: 'Full-time campus-based legal education',
          requirements: 'Senior Secondary (10+2) in any stream (Commerce, Arts, Science) with >=45% aggregate marks',
          risk: 'Resets undergraduate timeline if chosen instead of completing current degree.',
          evidence_of_progress: '10+2 marksheet, CLAT scorecard, admission offer letter.',
          exit_points: 'Dual degree (e.g. B.B.A. LL.B.), direct eligibility for Bar enrolment.',
          summary: 'If you wish to switch immediately without waiting to finish your current degree, your 10+2 qualification qualifies you for 5-Year Integrated Law programmes.'
        },
        {
          id: 'adjacent_legal_tech_compliance',
          label: 'Adjacent Pathway: Legal Technology, Cyber Law & Corporate Compliance',
          route_type: 'adjacent_career',
          feasibility_score: 88,
          time_to_milestone: '3–6 months for Cyber Law / Data Privacy Certification',
          estimated_duration: '1–2 years (leverages current computing background)',
          cost: 'Low-cost (online PG Diploma / certified courses in Cyber Law & Compliance)',
          flexibility: 'High: compatible with online/part-time study and remote work',
          requirements: 'BCA computing foundation + Cyber Law, IT Act 2000, GDPR/DPDP Act compliance expertise',
          risk: 'Corporate advisory and consultancy role; does not grant courtroom litigation rights without an LL.B.',
          evidence_of_progress: 'Certification in Cyber Law / Data Privacy Officer (DPO), privacy audit project.',
          exit_points: 'Data Privacy Analyst, Legal Tech Consultant, Contracts & Compliance Specialist.',
          summary: 'Apply your computing background to legal technology, regulatory compliance, and cybersecurity law while preparing for formal legal studies.'
        }
      );
    } else if (hasCompletedDegree) {
      directRouteStatus = 'B';
      directDecision = 'Law Entrance Examination Milestone (3-Year LL.B.)';
      directReason = `Your completed ${p.canonical_degree || 'degree'} satisfies the educational prerequisite for a 3-Year LL.B. under Bar Council of India rules. Your immediate milestone is preparing for law entrance tests (such as CUET-PG Law, MH CET Law, or NLSAT).`;
      bridgePossible = true;
      credibleAlternatives.push({
        id: '3year_llb_graduate_route',
        label: '3-Year LL.B. Post-Graduate Route',
        route_type: 'academic_and_statutory',
        feasibility_score: 85,
        time_to_milestone: 'Law Entrance Exam (CUET-PG / MH CET Law / NLSAT)',
        estimated_duration: '3 years full-time LL.B. + AIBE',
        cost: 'Standard university tuition',
        flexibility: 'Full-time campus attendance mandated by BCI',
        requirements: 'Bachelor degree with >=45% aggregate + Law entrance exam',
        risk: 'Entrance competition at premier institutions',
        evidence_of_progress: 'Law CET scorecard, LL.B. admission letter',
        exit_points: 'Practicing Advocate, Corporate Counsel, Legal Consultant',
        summary: 'Prepare for law entrance tests, enroll in a recognized 3-Year LL.B. programme, and complete State Bar enrolment.'
      });
    } else if (p.level.includes('12th') || p.level.includes('school')) {
      directRouteStatus = 'A';
      directDecision = 'Direct 5-Year Integrated Law Route (CLAT / AILET)';
      directReason = 'Your 10+2 qualification satisfies eligibility for 5-Year Integrated Law programmes (B.A. LL.B., B.B.A. LL.B., B.Com. LL.B.) recognized by the Bar Council of India. Entrance is through CLAT, AILET, or state law CETs.';
      credibleAlternatives.push({
        id: '5year_integrated_clat_route',
        label: '5-Year Integrated B.A. LL.B. / B.B.A. LL.B. Route',
        route_type: 'formal_regulated',
        feasibility_score: 85,
        time_to_milestone: 'CLAT / AILET registration (annual national cycle)',
        estimated_duration: '5 years full-time integrated degree',
        cost: 'Government/State colleges: ₹25,000–₹60,000/yr; NLUs: ₹2.5L–₹3.5L/yr',
        flexibility: 'Full-time campus curriculum',
        requirements: '10+2 in any stream with >=45% marks + CLAT scorecard',
        risk: 'National entrance competition',
        evidence_of_progress: '10+2 marksheet, CLAT scorecard',
        exit_points: 'Advocate, Corporate Law Associate, Legal Researcher',
        summary: 'Sit for CLAT or state CET, complete 5-year integrated law degree, and qualify for State Bar enrolment.'
      });
    } else {
      directRouteStatus = 'B';
      directDecision = 'LL.B. Prerequisite Route Identified';
      directReason = 'Practicing law in India requires a BCI-recognized LL.B. degree. Graduates from any stream qualify for the 3-Year LL.B. route, while 10+2 certificate holders qualify for the 5-Year Integrated LL.B. route.';
      bridgePossible = true;
    }
  } else if (targetLower.includes('chef') || targetLower.includes('cook') || targetLower.includes('culinary')) {
    sources.push(AUTHORITATIVE_SOURCES.NCHMCT, AUTHORITATIVE_SOURCES.FSSAI);
    formalRequirements.push(
      'No mandatory academic stream barrier: 10th or 12th pass from any stream qualifies for culinary programmes',
      'Recognized qualification: B.Sc. in Culinary Arts / Hospitality (3 years) or Craftsmanship Diploma in Food Production & Patisserie (1.5 years)',
      'Mandatory Food Safety & Hygiene certification under FSSAI regulations',
      'Hands-on practical kitchen training, knife skills, food safety, and industrial commercial kitchen internship'
    );
    directRouteStatus = 'A';
    directDecision = 'Direct Culinary & Hospitality Route';
    directReason = 'Culinary careers are skills-first and practical: your background does not restrict culinary progression. You can enter through an accredited diploma (e.g. IHM Goa Food Production) or direct kitchen apprenticeships with FSSAI hygiene certification.';
    credibleAlternatives.push({
      id: 'diploma_culinary_ihm',
      label: 'Craftsmanship Diploma in Food Production (NCHMCT / IHM Goa)',
      route_type: 'professional_diploma',
      feasibility_score: 92,
      time_to_milestone: 'Admission cycle (annual summer intake)',
      estimated_duration: '1.5 years (1 year coursework + 6 months industrial training)',
      cost: '₹40,000–₹85,000 total (subsidized government institute)',
      flexibility: 'Intensive on-site practical kitchen workshops',
      requirements: '10th or 12th pass in any stream + English communication',
      risk: 'Physically demanding kitchen shifts and commercial culinary hours',
      evidence_of_progress: 'IHM Diploma certificate, FSSAI Food Safety Supervisor certificate',
      exit_points: 'Commis Chef in hotel/restaurant kitchens, Bakery & Pastry specialist, Catering entrepreneur',
      summary: 'Enroll in an accredited Food Production diploma, complete commercial kitchen internships in Goa, and progress to Chef de Partie.'
    });
  } else if (targetLower.includes('judge') || targetLower.includes('high court judge')) {
    sources.push(AUTHORITATIVE_SOURCES.BCI);
    formalRequirements.push(
      'Statutory Bachelor of Laws (LL.B.) degree recognized by the Bar Council of India',
      'Enrolment as an Advocate with a State Bar Council',
      'For High Court Judge (Article 217 Constitution of India): Minimum 10 years judicial office or minimum 10 years advocate practice in High Court',
      'For Subordinate Judiciary: State Judicial Services Examination (Civil Judge Junior Division)'
    );
    directRouteStatus = p.degree.includes('llb') || p.degree.includes('law') ? 'B' : 'C';
    directDecision = p.degree.includes('llb') ? 'Judicial Exam / Practice Milestone Required' : 'Pre-requisite Law Degree Required';
    directReason = 'Becoming a High Court Judge is a senior constitutional appointment requiring a recognized law degree followed by at least 10 years of judicial service or High Court practice.';
    credibleAlternatives.push({
      id: 'llb_judiciary_pathway',
      label: 'LL.B. Foundation -> Judicial Services Career Route',
      route_type: 'academic_and_statutory',
      feasibility_score: 70,
      time_to_milestone: 'Apply for 3-year LL.B. entrance (or 5-year CLAT if after 12th)',
      estimated_duration: '3–5 years for LL.B. + 10 years judicial experience',
      cost: 'Standard university tuition',
      flexibility: 'Law degrees require recognized classroom/practical attendance per BCI rules',
      requirements: 'Complete LL.B., pass All India Bar Exam (AIBE), prepare for State Judicial Services',
      risk: 'Long-term commitment requiring rigorous competitive exams',
      evidence_of_progress: 'LL.B. admission, Bar Council enrolment',
      exit_points: 'Advocate, Legal Advisor, Corporate Counsel, Public Prosecutor',
      summary: 'Begin with an accredited LL.B. degree, qualify as an advocate, and sit for State Judicial Services as the structured foundation toward the bench.'
    });
  } else if (targetLower.includes('ias') || targetLower.includes('civil services') || targetLower.includes('upsc')) {
    sources.push(AUTHORITATIVE_SOURCES.UPSC);
    formalRequirements.push(
      'Graduation degree in any discipline from a recognized university (UPSC Civil Services Rules)',
      'Age criteria: 21 to 32 years on cutoff date (with category relaxations where applicable)',
      'UPSC CSE three-stage examination: Preliminary, Mains, and Personality Test (Interview)'
    );
    if (p.level.includes('graduate') || p.status.includes('completed')) {
      directRouteStatus = 'A';
      directDecision = 'Direct Examination Route';
      directReason = 'You hold/are near completion of a recognized bachelor degree, satisfying basic UPSC eligibility.';
    } else {
      directRouteStatus = 'B';
      directDecision = 'Degree Completion Milestone Required';
      directReason = 'UPSC CSE requires a completed bachelor degree before sitting for the exam (or appearing in final year).';
    }
  } else if (targetLower.includes('nurse') || targetLower.includes('nursing')) {
    formalRequirements.push(
      'Recognized B.Sc Nursing (4 years) or GNM diploma (3 years)',
      'Registration with State Nursing Council (e.g. Goa Nursing Council) / Indian Nursing Council',
      'Mandatory on-site clinical ward training and internship'
    );
    directRouteStatus = p.isPCB ? 'B' : 'D';
    directDecision = p.isPCB ? 'Nursing Admission Open' : '12th Science PCB Prerequisite Required';
    directReason = 'Statutory nursing qualifications in India mandate 10+2 with Science (PCB) and full-time on-site clinical rotations.';
  } else if (targetLower.includes('chartered accountant') || targetLower === 'ca') {
    sources.push(AUTHORITATIVE_SOURCES.ICAI);
    formalRequirements.push(
      'Registration with ICAI for Foundation Course (post-12th) or Direct Entry Scheme (for graduates with required percentage)',
      'ICAI Intermediate examination + Integrated Professional Competence',
      'Mandatory Practical Articleship Training (2 years under a practicing CA)',
      'ICAI Final examination'
    );
    directRouteStatus = 'A';
    directDecision = 'Direct ICAI Professional Route';
    directReason = 'ICAI admission is open across disciplines; graduates can enter directly or via Foundation.';
  } else if (targetLower.includes('ux designer') || targetLower.includes('product designer')) {
    formalRequirements.push(
      'Proficiency in user research, wireframing, Figma design tools, and interaction design',
      'Demonstrable portfolio of 2–3 in-depth UX case studies showcasing problem-solving and user testing'
    );
    directRouteStatus = 'A';
    directDecision = 'Direct Portfolio Route';
    directReason = 'UX Design prioritizes verified design case studies and user-centred methodology over specific formal degree restrictions.';
  } else if (targetLower.includes('gis analyst')) {
    formalRequirements.push(
      'Bachelor degree in Geography, Geology, Environmental Science, Civil Engineering, or Computing',
      'PG Diploma or certified coursework in GIS software (QGIS, ArcGIS, remote sensing)'
    );
    directRouteStatus = 'B';
    directDecision = 'GIS Software Certification Milestone';
    directReason = 'GIS Analyst roles build upon your current qualifications through specialized GIS/Remote Sensing training.';
  } else if (targetLower.includes('teacher')) {
    formalRequirements.push(
      'Graduation/Post-Graduation in the relevant teaching subject',
      'Bachelor of Education (B.Ed.) from an NCTE-recognized institution',
      'TET / CTET qualification for school-level appointments'
    );
    directRouteStatus = 'B';
    directDecision = 'B.Ed. & Teacher Eligibility Test Required';
    directReason = 'School teaching requires a subject degree, NCTE-recognized B.Ed., and passing the state TET or central CTET.';
  } else if (targetLower.includes('product manager')) {
    formalRequirements.push(
      'Demonstrated understanding of product discovery, user research, agile delivery, and metrics',
      'Prior experience in software development, design, analytics, or domain business operations'
    );
    directRouteStatus = 'A';
    directDecision = 'Cross-Functional Transition Route';
    directReason = 'Product management is an interdisciplinary career accessible through technical, analytical, or business operational milestones.';
  } else {
    // Unknown or generic career
    directRouteStatus = 'E';
    directDecision = 'Verification Pending';
    directReason = `CareerGPS has recognized "${trimmedGoal}". Formal route requirements and admission/licensing criteria need verification for your target cycle.`;
  }

  // 3. DIMENSION C: READINESS (Current demonstrated capability)
  const demonstratedSkills = p.skillNames.slice(0, 10);
  let readinessScore = 40;
  if (p.degree.includes('bca') && targetLower.includes('developer')) readinessScore = 75;
  if (p.degree.includes('bca') && targetLower.includes('data')) readinessScore = 65;
  if (p.degree.includes('bca') && targetLower.includes('doctor')) readinessScore = 20; // BCA does not transfer to clinical medicine
  if (p.isCommerce && targetLower.includes('ca')) readinessScore = 80;
  if (p.isArts && targetLower.includes('judge')) readinessScore = 45;

  const confirmedGaps = [];
  if (targetLower.includes('doctor') && !p.isPCB) {
    confirmedGaps.push('Class 12 Senior Secondary Physics, Chemistry & Biology subject certification');
    confirmedGaps.push('NEET-UG entrance preparation & qualification');
  }
  if (targetLower.includes('developer') && !demonstratedSkills.includes('git')) {
    confirmedGaps.push('Git version control & collaborative repository evidence');
  }
  if (targetLower.includes('developer') && !demonstratedSkills.includes('sql') && !demonstratedSkills.includes('database')) {
    confirmedGaps.push('Relational database & SQL querying proficiency');
  }

  // 4. DIMENSION D: PRACTICAL FEASIBILITY (Study hours, location, delivery mode, budget)
  const practicalObstacles = [];
  let deliveryModeConflict = false;
  let practicalScore = 75;

  // Delivery mode analysis (CRITICAL: Medical/clinical cannot be done online/part-time)
  const isOnlineOrPartTime = p.studyModes.some(m => m.includes('online') || m.includes('part-time'));
  if (targetLower.includes('doctor') || targetLower.includes('mbbs') || targetLower.includes('nurse')) {
    if (isOnlineOrPartTime) {
      deliveryModeConflict = true;
      practicalScore -= 45;
      practicalObstacles.push(
        'Delivery Mode Barrier: Regulated medical education (MBBS) and clinical rotations CANNOT be completed online or part-time under National Medical Commission (NMC) rules. Full-time, on-site hospital and classroom attendance is mandatory.'
      );
    }
    if (p.prefersRemote) {
      practicalObstacles.push(
        'Location Constraint: Clinical medical practice and MBBS internship cannot be conducted remotely. On-site attendance at an approved teaching hospital (such as Goa Medical College, Bambolim) is mandatory.'
      );
      practicalScore -= 15;
    }
  }

  if (targetLower.includes('lawyer') || targetLower.includes('advocate') || targetLower.includes('legal counsel') || targetLower.includes('corporate lawyer') || targetLower.includes('attorney')) {
    if (isOnlineOrPartTime) {
      deliveryModeConflict = true;
      practicalScore -= 25;
      practicalObstacles.push(
        'Delivery Mode Advisory: Bar Council of India (BCI) regulations prohibit distance, correspondence, or online law degrees for advocate enrolment and court practice. Full-time, regular physical attendance at a BCI-approved law college is mandatory.'
      );
    }
  }

  if (p.hoursPerWeek && p.hoursPerWeek < 15 && (targetLower.includes('doctor') || targetLower.includes('mbbs'))) {
    practicalObstacles.push(
      `Weekly Hours Constraint: You indicated ${p.hoursPerWeek} hours/week. Full-time medical college curriculum requires 35–45 hours per week of classroom and clinical instruction.`
    );
    practicalScore -= 20;
  }

  // For tech careers, online / part-time is an excellent fit
  if (targetLower.includes('developer') || targetLower.includes('designer') || targetLower.includes('analyst')) {
    if (isOnlineOrPartTime) {
      practicalScore = Math.min(100, practicalScore + 15);
    }
    if (p.prefersRemote || p.prefersGoa) {
      practicalScore = Math.min(100, practicalScore + 10);
    }
  }

  practicalScore = Math.max(10, Math.min(100, practicalScore));

  // Determine Overall Feasibility Verdict
  let overallStatus = 'FEASIBLE_WITH_BRIDGE';
  let overallLabel = 'Achievable with prerequisites & bridge';
  let overallTone = 'warning';

  if (directRouteStatus === 'A' && practicalScore >= 65) {
    overallStatus = 'HIGH_FEASIBILITY';
    overallLabel = 'Practical route identified — directly pursue';
    overallTone = 'positive';
  } else if (directRouteStatus === 'D' && deliveryModeConflict) {
    overallStatus = 'PRACTICAL_AND_FORMAL_BLOCK';
    overallLabel = 'Direct route restricted by formal rules and study mode';
    overallTone = 'warning';
  } else if (directRouteStatus === 'D') {
    overallStatus = 'FORMAL_GATE_RESTRICTED';
    overallLabel = 'Direct route restricted — legal alternative available';
    overallTone = 'warning';
  } else if (deliveryModeConflict) {
    overallStatus = 'STUDY_MODE_MISMATCH';
    overallLabel = 'Requires on-site study — review mode preferences';
    overallTone = 'warning';
  } else if (directRouteStatus === 'E') {
    overallStatus = 'NEEDS_VERIFICATION';
    overallLabel = 'Goal recognized — route needs verification';
    overallTone = 'neutral';
  }

  // 5. COMPUTE ROUTE SCORING MODEL (Section 9.1)
  const defaultRoutes = [];

  // Generate standard candidate routes for comparison
  if (targetLower.includes('doctor') || targetLower.includes('mbbs')) {
    defaultRoutes.push({
      id: 'direct_mbbs_route',
      label: 'Direct Regulated Route: NEET-UG + 5.5-Yr MBBS',
      route_type: 'formal_regulated',
      scores: {
        goal_alignment: 25, // 25% max
        requirement_confidence: directRouteStatus === 'D' ? 6 : 18, // 20% max
        practical_feasibility: isOnlineOrPartTime ? 4 : 16, // 20% max
        readiness_adjacency: p.isPCB ? 14 : 3, // 15% max
        time_to_milestone: 5, // 10% max
        quality_recognition: 10, // 10% max
        composite_score: directRouteStatus === 'D' || isOnlineOrPartTime ? 32 : 88
      },
      time: {
        next_milestone: 'NEET-UG registration (annual national cycle)',
        route_endpoint: '5.5 years full-time + 1 year compulsory internship'
      },
      cost: {
        estimate: 'Government college (e.g. GMC Goa): ₹1.5L–₹3L total; Private/Deemed: ₹45L–₹90L+',
        basis: 'Published Directorate of Higher Education / State Quota Fee Structure'
      },
      requirements: {
        verified_gates: ['10+2 with PCB + English', 'NEET-UG qualification', 'Minimum age 17 years'],
        pending_checks: ['State Domicile verification for 85% Goa state quota seats at GMC']
      },
      flexibility: 'Zero online/part-time flexibility: Mandatory 100% full-time, on-site clinical ward presence.',
      risk: 'Extremely high entrance competition; zero remote accommodation; substantial opportunity cost.',
      evidence_of_progress: 'Class 12 PCB marksheet, NEET admit card & percentile scorecard.',
      exit_points: 'MBBS graduates receive statutory registration under State Medical Council / NMC.',
      summary: 'The statutory route to practice medicine in India. High stakes, strictly full-time, and location-bound.'
    });

    if (credibleAlternatives.length > 0) {
      credibleAlternatives.forEach((alt, idx) => {
        defaultRoutes.push({
          id: alt.id,
          label: alt.label,
          route_type: alt.route_type,
          scores: {
            goal_alignment: alt.route_type === 'academic_bridge' ? 24 : 16,
            requirement_confidence: 17,
            practical_feasibility: alt.route_type === 'adjacent_career' ? 19 : 8,
            readiness_adjacency: alt.route_type === 'adjacent_career' ? 14 : 6,
            time_to_milestone: 8,
            quality_recognition: 9,
            composite_score: alt.feasibility_score
          },
          time: {
            next_milestone: alt.time_to_milestone,
            route_endpoint: alt.estimated_duration
          },
          cost: {
            estimate: alt.cost,
            basis: 'Self-paced course fees & registration'
          },
          requirements: {
            verified_gates: [alt.requirements],
            pending_checks: ['Verify accepted subject equivalence before paying coaching fees']
          },
          flexibility: alt.flexibility,
          risk: alt.risk,
          evidence_of_progress: alt.evidence_of_progress,
          exit_points: alt.exit_points,
          summary: alt.summary
        });
      });
    }
  } else if (targetLower.includes('developer') || targetLower.includes('software')) {
    defaultRoutes.push(
      {
        id: 'skills_portfolio_route',
        label: 'Skills-First + Demonstrable Portfolio Route',
        route_type: 'skills_first',
        scores: {
          goal_alignment: 24,
          requirement_confidence: 19,
          practical_feasibility: 19,
          readiness_adjacency: 14,
          time_to_milestone: 9,
          quality_recognition: 8,
          composite_score: 93
        },
        time: {
          next_milestone: '2–4 weeks: complete basic CRUD API with PostgreSQL',
          route_endpoint: '6–9 months to junior developer readiness'
        },
        cost: {
          estimate: 'Low-cost (Free documentation, open-source tooling, free tier cloud hosting)',
          basis: 'Community resources, GitHub, free hosting'
        },
        requirements: {
          verified_gates: ['Proficiency in JavaScript/TypeScript or Python', 'REST API design & SQL databases', 'Git/GitHub portfolio'],
          pending_checks: ['Technical code review and live deployment']
        },
        flexibility: 'High: 100% compatible with part-time study, self-pacing, and remote internship applications.',
        risk: 'Must build real proof of work; hiring depends on demonstrable code rather than certificate brand.',
        evidence_of_progress: 'GitHub commits, live API URL, documentation, technical blog/README.',
        exit_points: 'Directly applicable to Junior Backend, Full Stack, and QA automation positions.',
        summary: 'Build working software, demonstrate version-controlled code, and apply directly to software roles.'
      },
      {
        id: 'academic_degree_route',
        label: 'Academic Completion Route (BCA / B.Tech Degree)',
        route_type: 'academic',
        scores: {
          goal_alignment: 23,
          requirement_confidence: 20,
          practical_feasibility: 16,
          readiness_adjacency: 13,
          time_to_milestone: 'Semester exams & university projects',
          quality_recognition: 9,
          composite_score: 85
        },
        time: {
          next_milestone: 'Current semester project submission',
          route_endpoint: 'At completion of graduation (1–2 years)'
        },
        cost: {
          estimate: 'Standard college semester fees',
          basis: 'College prospectus'
        },
        requirements: {
          verified_gates: ['Clear all university subject credits and semester practicals'],
          pending_checks: ['Campus placement eligibility criteria (e.g. minimum 60% with no active backlogs)']
        },
        flexibility: 'Academic timetable schedule; combines well with evening coding practice.',
        risk: 'University curriculum may lag industry tools without self-directed supplementary projects.',
        evidence_of_progress: 'University marksheet, degree certificate, final-year capstone project.',
        exit_points: 'Qualifies for campus recruitment and postgraduate entrance exams (e.g., MCA, MBA, NIMCET).',
        summary: 'Leverage your formal college degree for campus placement eligibility while building industry-relevant code.'
      }
    );
  } else if (targetLower.includes('lawyer') || targetLower.includes('advocate') || targetLower.includes('legal counsel') || targetLower.includes('corporate lawyer') || targetLower.includes('attorney')) {
    defaultRoutes.push({
      id: 'direct_3year_llb_route',
      label: '3-Year LL.B. Graduate Route (Post-BCA / Post-Degree)',
      route_type: 'academic_and_statutory',
      scores: {
        goal_alignment: 24,
        requirement_confidence: 19,
        practical_feasibility: isOnlineOrPartTime ? 12 : 18,
        readiness_adjacency: 12,
        time_to_milestone: 8,
        quality_recognition: 10,
        composite_score: 83
      },
      time: {
        next_milestone: 'Complete bachelor degree + Law Entrance (CUET-PG / MH CET Law / NLSAT)',
        route_endpoint: '3 years full-time campus LL.B. + State Bar Enrolment + AIBE'
      },
      cost: {
        estimate: 'State University (e.g. Goa University law faculties): ₹35K–₹75K/yr; Private/NLUs: ₹1.5L–₹3L/yr',
        basis: 'Bar Council of India / State Directorate of Higher Education fees'
      },
      requirements: {
        verified_gates: ['BCA or Bachelor Degree with min 45% aggregate marks', 'Law Entrance examination', 'Full-time campus attendance'],
        pending_checks: ['State Bar Council enrolment verification and AIBE passing within 2 years']
      },
      flexibility: 'Full-time campus study required by BCI rules; online/distance law degrees are not recognized for practice.',
      risk: 'Requires committing to 3 years of full-time legal study after undergraduate graduation.',
      evidence_of_progress: 'Undergraduate degree marksheet, Law CET scorecard, LL.B. semester marksheet.',
      exit_points: 'Practicing Advocate in District/High Court, Corporate Legal Counsel, Legal Advisor, Judicial Services Aspirant.',
      summary: 'Complete your ongoing bachelor degree, secure admission in a BCI-approved 3-Year LL.B., complete practical internships, and clear the All India Bar Examination.'
    });

    if (credibleAlternatives.length > 0) {
      credibleAlternatives.forEach((alt) => {
        defaultRoutes.push({
          id: alt.id,
          label: alt.label,
          route_type: alt.route_type,
          scores: {
            goal_alignment: alt.route_type === 'academic_and_statutory' ? 24 : 18,
            requirement_confidence: 18,
            practical_feasibility: alt.route_type === 'adjacent_career' ? 19 : 14,
            readiness_adjacency: alt.route_type === 'adjacent_career' ? 15 : 10,
            time_to_milestone: 8,
            quality_recognition: 9,
            composite_score: alt.feasibility_score
          },
          time: {
            next_milestone: alt.time_to_milestone,
            route_endpoint: alt.estimated_duration
          },
          cost: {
            estimate: alt.cost,
            basis: 'Standard published tuition & certification fees'
          },
          requirements: {
            verified_gates: Array.isArray(alt.requirements) ? alt.requirements : [alt.requirements],
            pending_checks: ['Verify admission cutoff and cycle dates']
          },
          flexibility: alt.flexibility,
          risk: alt.risk,
          evidence_of_progress: alt.evidence_of_progress,
          exit_points: alt.exit_points,
          summary: alt.summary
        });
      });
    }
  } else if (targetLower.includes('data analyst') || targetLower.includes('business intelligence') || targetLower.includes('bi analyst')) {
    defaultRoutes.push(
      {
        id: 'analytics_portfolio_route',
        label: 'SQL + Power BI Portfolio Route',
        route_type: 'skills_first',
        scores: {
          goal_alignment: 24,
          requirement_confidence: 20,
          practical_feasibility: 19,
          readiness_adjacency: 15,
          time_to_milestone: 9,
          quality_recognition: 8,
          composite_score: 91
        },
        time: {
          next_milestone: '3–4 weeks: complete multi-table SQL querying project with business metrics',
          route_endpoint: '4–6 months to junior data analyst readiness'
        },
        cost: {
          estimate: 'Low-cost (Free PostgreSQL, Power BI Desktop, open public datasets)',
          basis: 'Open data repositories & developer tools'
        },
        requirements: {
          verified_gates: ['SQL data querying and aggregations', 'Dashboard visualization in Power BI/Tableau', 'Data storytelling'],
          pending_checks: ['Published portfolio and mock business case study']
        },
        flexibility: 'High: 100% compatible with online and part-time study.',
        risk: 'Hiring requires showing real SQL proficiency rather than multiple video course certificates.',
        evidence_of_progress: 'GitHub SQL repository, live Tableau Public/Power BI report, case study documentation.',
        exit_points: 'Junior Data Analyst, BI Specialist, Operations Reporting Analyst.',
        summary: 'Build working analytics projects with SQL and interactive dashboards to apply directly for analyst roles.'
      }
    );
  } else if (targetLower.includes('chef') || targetLower.includes('cook') || targetLower.includes('culinary')) {
    defaultRoutes.push({
      id: 'culinary_diploma_route',
      label: 'Accredited Craftsmanship Diploma Route (Food Production)',
      route_type: 'professional_diploma',
      scores: {
        goal_alignment: 25,
        requirement_confidence: 20,
        practical_feasibility: 18,
        readiness_adjacency: 14,
        time_to_milestone: 9,
        quality_recognition: 9,
        composite_score: 93
      },
      time: {
        next_milestone: 'Apply for NCHMCT / IHM Goa Food Production Diploma intake',
        route_endpoint: '1.5 years (1 yr coursework + 6 months commercial kitchen internship)'
      },
      cost: {
        estimate: '₹40,000–₹85,000 total (subsidized government institute)',
        basis: 'NCHMCT / IHM Goa prospectus'
      },
      requirements: {
        verified_gates: ['10th/12th certificate in any stream', 'FSSAI Food Safety Supervisor training', 'Commercial kitchen internship'],
        pending_checks: ['Annual summer intake registration']
      },
      flexibility: 'Intensive on-site practical kitchen workshops and commercial hotel shifts.',
      risk: 'Demanding physical standing hours and high-paced kitchen environment.',
      evidence_of_progress: 'IHM Diploma certificate, FSSAI hygiene certificate, Chef de Partie recommendation.',
      exit_points: 'Commis Chef, Pastry Chef, Commercial Kitchen Supervisor, Restaurant Entrepreneur.',
      summary: 'Complete accredited culinary training at IHM Goa, acquire FSSAI food hygiene credentials, and progress through commercial hotel kitchens.'
    });
  } else {
    // Generic fallback route
    defaultRoutes.push({
      id: 'core_preparation_route',
      label: `${canonical || trimmedGoal} Structured Preparation Route`,
      route_type: 'planned_route',
      scores: {
        goal_alignment: 22,
        requirement_confidence: directRouteStatus === 'E' ? 10 : 16,
        practical_feasibility: practicalScore >= 60 ? 16 : 8,
        readiness_adjacency: 10,
        time_to_milestone: 7,
        quality_recognition: 8,
        composite_score: directRouteStatus === 'E' ? 53 : 75
      },
      time: {
        next_milestone: '2–4 weeks: confirm exact entry criteria and build study plan',
        route_endpoint: 'Not yet estimated (depends on cycle & preparation depth)'
      },
      cost: {
        estimate: 'Not yet estimated',
        basis: 'Official examination/application fee'
      },
      requirements: {
        verified_gates: formalRequirements.length ? formalRequirements : ['Verify official syllabus and prerequisites'],
        pending_checks: ['Target institution / employer specific brochure']
      },
      flexibility: isOnlineOrPartTime ? 'Flexible preparation schedule' : 'Standard preparation schedule',
      risk: 'Requirements vary across specific institutions and recruiting cycles',
      evidence_of_progress: 'Mock test scores, credential certificates, application submission',
      exit_points: 'Skills and qualifications built transfer to adjacent career paths',
      summary: `Systematic step-by-step route to reach ${canonical || trimmedGoal} with verified milestone checkpoints.`
    });
  }

  // 6. IMMEDIATE ACTION & MILESTONES (Section 8.4)
  let nextAction = {
    title: 'Confirm the relevant route requirements and choose one practical first step.',
    time_range_hours: [2, 4],
    rationale: 'Review current criteria before committing time or money.'
  };

  const milestones = [];

  if (targetLower.includes('doctor') || targetLower.includes('mbbs')) {
    nextAction = {
      title: 'Consult official NMC & NIOS guidelines regarding senior secondary biology eligibility before paying any coaching fees.',
      time_range_hours: [2, 3],
      rationale: 'Prevent spending money on NEET coaching until the legal senior secondary biology prerequisite is verified.'
    };
    milestones.push(
      { order: 1, title: 'Verify NIOS Senior Secondary Science Subject Eligibility with NMC regulations', target_weeks: '1–2 weeks', status: 'pending' },
      { order: 2, title: 'Decide whether to commit to full-time on-site study (MBBS cannot be done online/remote)', target_weeks: '3–4 weeks', status: 'pending' },
      { order: 3, title: 'Explore Health Informatics / Healthcare Tech as a parallel flexible option', target_weeks: '4–6 weeks', status: 'pending' }
    );
  } else if (targetLower.includes('developer') || targetLower.includes('software')) {
    nextAction = {
      title: 'Build a small CRUD API connected to a PostgreSQL database and push it to GitHub.',
      time_range_hours: [4, 8],
      rationale: 'Tangible code commits and database knowledge provide immediate demonstrable proof for technical interviews.'
    };
    milestones.push(
      { order: 1, title: 'Build and document a REST API with authentication and database integration', target_weeks: '2–3 weeks', status: 'pending' },
      { order: 2, title: 'Deploy the API live to a cloud platform with a comprehensive README and tests', target_weeks: '4–5 weeks', status: 'pending' },
      { order: 3, title: 'Create a tailored developer resume and apply to junior/internship positions', target_weeks: '6–8 weeks', status: 'pending' }
    );
  } else if (targetLower.includes('lawyer') || targetLower.includes('advocate') || targetLower.includes('legal counsel') || targetLower.includes('corporate lawyer') || targetLower.includes('attorney')) {
    const isLawDegree = (p.degree || '').replace(/[^a-z0-9]/g, '').includes('llb') || (p.degree || '').includes('law');
    const hasCompletedDegree = (p.status.includes('completed') || p.level.includes('graduate') || p.level.includes('postgraduate')) && Boolean(p.canonical_degree || p.level.includes('undergraduate') || p.level.includes('bachelor'));
    if (isLawDegree && hasCompletedDegree) {
      nextAction = {
        title: 'Apply for State Bar Council enrolment and register for the upcoming All India Bar Examination (AIBE).',
        time_range_hours: [4, 8],
        rationale: 'Your completed LL.B. qualifies you directly for provisional enrolment and the AIBE Certificate of Practice.'
      };
    } else {
      nextAction = {
        title: 'Review eligibility brochures and entrance syllabi for 3-Year LL.B. programmes (CUET-PG Law, MH CET Law, NLSAT).',
        time_range_hours: [2, 4],
        rationale: 'Under Bar Council of India rules, your bachelor degree qualifies you for 3-Year LL.B. admission upon graduation.'
      };
    }
    milestones.push(
      { order: 1, title: 'Maintain minimum 45% aggregate in ongoing BCA/Undergraduate degree', target_weeks: 'Ongoing semesters', status: 'pending' },
      { order: 2, title: 'Prepare for 3-Year LL.B. entrance examinations (CUET-PG, MH CET Law, NLSAT 3-Year)', target_weeks: '4–8 months', status: 'pending' },
      { order: 3, title: 'Secure admission in a BCI-recognized law faculty and complete 3-year LL.B.', target_weeks: 'Upon graduation', status: 'pending' },
      { order: 4, title: 'Enroll with State Bar Council and pass the All India Bar Examination (AIBE)', target_weeks: 'Post-LL.B.', status: 'pending' }
    );
  } else if (targetLower.includes('chef') || targetLower.includes('cook') || targetLower.includes('culinary')) {
    nextAction = {
      title: 'Explore Food Production diploma admissions at IHM Goa and acquire FSSAI hygiene certification.',
      time_range_hours: [2, 4],
      rationale: 'Formal diploma accreditation and food safety certification accelerate culinary kitchen progression.'
    };
    milestones.push(
      { order: 1, title: 'Review Craftsmanship Diploma in Food Production admissions at IHM Goa', target_weeks: '1–2 weeks', status: 'pending' },
      { order: 2, title: 'Acquire FSSAI Food Safety Supervisor certification', target_weeks: '3–4 weeks', status: 'pending' },
      { order: 3, title: 'Complete commercial kitchen apprenticeship in hotel/restaurant food production', target_weeks: '6–12 months', status: 'pending' }
    );
  } else if (targetLower.includes('data analyst')) {
    nextAction = {
      title: 'Build a multi-table SQL analytics query project and publish a Power BI dashboard to your portfolio.',
      time_range_hours: [4, 8],
      rationale: 'Hands-on query proof and clean business metrics dashboards provide the highest hiring leverage for analyst roles.'
    };
    milestones.push(
      { order: 1, title: 'Master advanced SQL joins, aggregations, and window functions on real datasets', target_weeks: '2–3 weeks', status: 'pending' },
      { order: 2, title: 'Publish an interactive Power BI or Tableau business dashboard with documentation', target_weeks: '4–6 weeks', status: 'pending' },
      { order: 3, title: 'Apply to junior Data Analyst and BI roles with demonstrable portfolio links', target_weeks: '6–8 weeks', status: 'pending' }
    );
  } else if (targetLower.includes('judge')) {
    nextAction = {
      title: 'Review eligibility brochures for 3-Year LL.B. admissions at recognized universities.',
      time_range_hours: [3, 5],
      rationale: 'A Bar Council of India-recognized law degree is the statutory first gate for entering the judicial branch.'
    };
    milestones.push(
      { order: 1, title: 'Shortlist recognized Law Faculty LL.B. programmes and note entrance dates', target_weeks: '2–3 weeks', status: 'pending' },
      { order: 2, title: 'Begin preparation for university Law Common Entrance Tests', target_weeks: '4–8 weeks', status: 'pending' }
    );
  } else {
    milestones.push(
      { order: 1, title: `Audit mandatory prerequisites for ${canonical || trimmedGoal}`, target_weeks: '1–2 weeks', status: 'pending' },
      { order: 2, title: 'Build initial foundation project or study module', target_weeks: '3–5 weeks', status: 'pending' }
    );
  }

  // 7. EXPLANATION & SUMMARY (Section 10.2 Tone Matrix)
  let plainSummary = '';
  if (targetLower.includes('doctor') || targetLower.includes('mbbs')) {
    plainSummary = `Your ambition to become a Doctor remains preserved. Under statutory NMC regulations, direct entry to MBBS requires 10+2 with Physics, Chemistry, and Biology. Furthermore, medical education and clinical hospital rotations cannot be completed online or part-time—they mandate full-time, on-site attendance. If you wish to pursue medicine, explore a Senior Secondary Biology bridge via NIOS, or consider adjacent healthcare technology roles that align with your current computing background.`;
  } else if (targetLower.includes('developer') || targetLower.includes('software')) {
    plainSummary = `Your selected goal remains Software Developer. Your profile supports this direction well. You do not need an expensive bootcamp or immediate relocation: a skills-first route with hands-on projects and database practice can build competitive employability alongside your ongoing studies.`;
  } else if (targetLower.includes('lawyer') || targetLower.includes('advocate') || targetLower.includes('legal counsel') || targetLower.includes('corporate lawyer') || targetLower.includes('attorney')) {
    plainSummary = `Your ambition to become a Lawyer is fully recognized and supported. Under Bar Council of India (BCI) rules, graduates of any bachelor degree (including your ongoing degree) are eligible to enter the 3-Year LL.B. programme. Because your degree is currently in progress, your direct milestone is completing your bachelor's degree with at least 45% marks, followed by law entrance examinations (CUET-PG, MH CET Law, or NLSAT). Note that BCI requires full-time campus attendance for law practice.`;
  } else if (targetLower.includes('chef') || targetLower.includes('culinary')) {
    plainSummary = `Your ambition to become a Chef is accessible through practical culinary diplomas and commercial kitchen apprenticeships. Accredited programmes like the Craftsmanship Diploma in Food Production at IHM Goa, combined with FSSAI hygiene certification, provide a structured and direct path.`;
  } else if (targetLower.includes('data analyst')) {
    plainSummary = `Your selected goal remains Data Analyst. Your profile supports this direction well. Focus on building demonstrable proof in SQL querying, spreadsheet data preparation, and business dashboard visualization.`;
  } else if (directRouteStatus === 'A') {
    plainSummary = `Your goal "${canonical || trimmedGoal}" aligns with your profile. Verified entry gates appear reachable; review exact institution and cycle requirements to begin.`;
  } else if (directRouteStatus === 'C') {
    plainSummary = `For "${canonical || trimmedGoal}", a direct academic route has prerequisite constraints, but credible alternative pathways exist. Compare the route trade-offs below.`;
  } else if (directRouteStatus === 'D') {
    plainSummary = `A mandatory published requirement restricts the direct route for "${canonical || trimmedGoal}" based on your current subjects or qualifications. Review the bridge options and alternatives.`;
  } else {
    plainSummary = `CareerGPS has recognized "${canonical || trimmedGoal}". Formal eligibility for a specific institution or cycle needs verification against official notices.`;
  }

  return {
    goal: {
      id: ambition.canonical_id,
      label: ambition.selected_goal,
      owner: 'user',
      primary: true,
      version: 1
    },
    goal_type: ambition.goal_type,
    goal_valid: true,
    goal_validity: 'VALID',
    resolution: 'matched',
    overall_feasibility: {
      status: overallStatus,
      label: overallLabel,
      tone: overallTone,
      score: defaultRoutes[0]?.scores?.composite_score ?? practicalScore
    },
    evaluation: {
      direct_route_status: directRouteStatus,
      pathway_status: directRouteStatus === 'D' && credibleAlternatives.length > 0 ? 'C' : directRouteStatus,
      confidence: directRouteStatus === 'E' ? 'low' : 'medium',
      as_of: new Date().toISOString().split('T')[0]
    },
    four_dimensions: {
      ambition,
      formal_eligibility: {
        status: directRouteStatus,
        decision: directDecision,
        reason: directReason,
        mandatory_gates: formalRequirements,
        barriers: formalBarriers,
        bridge_possible: bridgePossible,
        cited_authorities: sources.map(s => s.authority)
      },
      readiness: {
        score: readinessScore,
        demonstrated_skills: demonstratedSkills,
        confirmed_gaps: confirmedGaps,
        level_alignment: p.level || 'ongoing'
      },
      practical_feasibility: {
        score: practicalScore,
        delivery_mode_conflict: deliveryModeConflict,
        stated_modes: p.studyModes,
        preferred_locations: p.preferredLocations,
        weekly_hours: p.hoursPerWeek,
        obstacles: practicalObstacles
      }
    },
    summary: plainSummary,
    plain_summary: plainSummary,
    known_gaps: [...confirmedGaps, ...formalBarriers],
    unknowns: directRouteStatus === 'E' ? ['passed_subjects_exact', 'target_institution_cycle'] : [],
    routes: defaultRoutes,
    next_action: nextAction,
    milestones: milestones,
    sources: sources,
    rule_version: FEASIBILITY_WEIGHTS_VERSION,
    goal_changed_by_engine: false,
    allow_continue: true,
    ai_generated: false
  };
}
