/**
 * Occupational Relationship and Career Intelligence Engine
 * 
 * Provides domain classification, deterministic occupational relationship scoring,
 * progression ladder generation, and transparent regulatory qualification parsing.
 */

export const GENERIC_SKILLS = new Set([
  'communication',
  'professionalcommunication',
  'verbalcommunication',
  'writtencommunication',
  'teamwork',
  'collaboration',
  'interpersonalskills',
  'problemsolving',
  'analyticalthinking',
  'criticalthinking',
  'timemanagement',
  'organization',
  'organizational',
  'attentiontodetail',
  'adaptability',
  'flexibility',
  'creativity',
  'creativitypresentation',
  'presentationskills',
  'digitalliteracy',
  'computerliteracy',
  'physicalfitness',
  'customerservice',
  'leadership',
  'selfmotivation'
]);

export function normalizeString(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9+#]/g, '');
}

/**
 * Classifies an occupation into a standard domain family based on title, description, and skills.
 */
export function classifyDomain(title = '', desc = '', skills = []) {
  const t = (title || '').toLowerCase();
  const d = (desc || '').toLowerCase();
  const s = Array.isArray(skills) ? skills.map(sk => (typeof sk === 'string' ? sk : sk?.name || '')).join(' ').toLowerCase() : '';

  const domainScores = {
    ACADEMIA_EDUCATION: 0,
    SOFTWARE_PLATFORMS: 0,
    DATA_INTELLIGENCE: 0,
    ENTERPRISE_SYSTEMS: 0,
    FINANCE_ACCOUNTING: 0,
    HEALTHCARE_CLINICAL: 0,
    PUBLIC_SAFETY_LAW: 0,
    CULINARY_HOSPITALITY: 0,
    ADMINISTRATION: 0,
    TECHNICAL_TRADES: 0,
    DESIGN_CREATIVE: 0,
    GEOSPATIAL_ANALYSIS: 0
  };

  const check = (domain, patternTitle, patternSkills, patternDesc) => {
    if (patternTitle && patternTitle.test(t)) domainScores[domain] += 50;
    if (patternSkills && patternSkills.test(s)) domainScores[domain] += 20;
    if (patternDesc && patternDesc.test(d)) domainScores[domain] += 5;
  };

  check(
    'ACADEMIA_EDUCATION',
    /\b(professor|lecturer|teacher|academic|faculty|instructor|educator|researcher)\b/,
    /\b(research methodology|curriculum development|academic writing|teaching|pedagogy|assessment)\b/,
    /\b(undergraduate|postgraduate|university|colleges|syllabus|dissertation|scholarly|academic)\b/
  );

  check(
    'SOFTWARE_PLATFORMS',
    /\b(developer|frontend|backend|full stack|fullstack|devops|cloud|software engineer)\b/,
    /\b(javascript|react|node\.js|express|docker|git|aws|linux|rest apis|html|css)\b/,
    /\b(web applications|apis|services|cloud computing|ci\/cd|microservices)\b/
  );

  check(
    'DATA_INTELLIGENCE',
    /\b(data analyst|data scientist|data engineer|ai engineer|machine learning)\b/,
    /\b(python|machine learning|statistics|power bi|etl|rag|llm|data analysis|data cleaning|data visualisation)\b/,
    /\b(datasets|predictive models|data pipeline|dashboards|big data)\b/
  );

  check(
    'ENTERPRISE_SYSTEMS',
    /\b(business analyst|erp specialist|functional consultant|systems analyst)\b/,
    /\b(business analysis|erp concepts|requirements gathering|business process|sap|reporting)\b/,
    /\b(enterprise resource planning|stakeholders|workflows|specifications|enterprise systems)\b/
  );

  check(
    'FINANCE_ACCOUNTING',
    /\b(finance|financial|accounting|fintech|accountant|banker)\b/,
    /\b(financial analysis|accounting|financial modeling|audit|ledger)\b/,
    /\b(financial reports|ledgers|fiscal|balance sheet|taxation)\b/
  );

  check(
    'HEALTHCARE_CLINICAL',
    /\b(doctor|surgeon|physician|nurse|nursing|dentist|cardiologist|medical)\b/,
    /\b(patient care|clinical diagnosis|surgery|pharmacology|anatomy|treatment)\b/,
    /\b(hospital|treatment|medical records|clinical practice|patient)\b/
  );

  check(
    'PUBLIC_SAFETY_LAW',
    /\b(police|police officer|lawyer|advocate|law enforcement|detective|patrol)\b/,
    /\b(law knowledge|physical fitness|investigation|patrolling|statutory)\b/,
    /\b(law and order|public safety|legal compliance|court)\b/
  );

  check(
    'CULINARY_HOSPITALITY',
    /\b(chef|cook|culinary|food safety officer|restaurant manager|catering)\b/,
    /\b(culinary techniques|menu planning|food safety|hygiene|gastronomy)\b/,
    /\b(kitchen|food preparation|gastronomy|dining|restaurant)\b/
  );

  check(
    'ADMINISTRATION',
    /\b(clerk|receptionist|office assistant|data entry operator)\b/,
    /\b(data entry|office administration|record keeping|filing|microsoft office)\b/,
    /\b(administrative support|paperwork|documentation|routine paperwork)\b/
  );

  check(
    'TECHNICAL_TRADES',
    /\b(technician|electrician|mechanic|maintenance engineer)\b/,
    /\b(technical knowledge|equipment repair|troubleshooting|safety & compliance awareness)\b/,
    /\b(machinery|maintenance|troubleshoot|repairs|technical assets)\b/
  );

  check(
    'DESIGN_CREATIVE',
    /\b(ui\/ux designer|graphic designer|product designer|visual designer|animator)\b/,
    /\b(figma|wireframing|ui design|typography|user research|branding)\b/,
    /\b(design systems|prototypes|visual aesthetics|user experience)\b/
  );

  check(
    'GEOSPATIAL_ANALYSIS',
    /\b(geo analyst|geospatial|gis|gis analyst|cartographer|remote sensing|geographer)\b/,
    /\b(gis|qgis|arcgis|remote sensing|spatial data analysis|cartography|postgis|spatial sql|georeferencing)\b/,
    /\b(geographic|satellite imagery|spatial datasets|cadastral|dem|topographical)\b/
  );

  let topDomain = 'GENERAL';
  let maxScore = 0;
  for (const [dom, score] of Object.entries(domainScores)) {
    if (score > maxScore) {
      maxScore = score;
      topDomain = dom;
    }
  }

  return { topDomain, domainScores, confidence: maxScore >= 50 ? 'high' : (maxScore >= 20 ? 'moderate' : 'low') };
}

/**
 * Checks compatibility between two domains and assigns a base cross-domain affinity.
 */
export function areDomainsCompatible(domA, domB) {
  if (domA === 'GENERAL' || domB === 'GENERAL') {
    return { compatible: false, affinityScore: 0 };
  }

  if (domA === domB) {
    return { compatible: true, affinityScore: 35 };
  }

  const adjacentPairs = [
    [['SOFTWARE_PLATFORMS', 'DATA_INTELLIGENCE'], 18],
    [['DATA_INTELLIGENCE', 'ENTERPRISE_SYSTEMS'], 15],
    [['ENTERPRISE_SYSTEMS', 'FINANCE_ACCOUNTING'], 18],
    [['DESIGN_CREATIVE', 'SOFTWARE_PLATFORMS'], 15]
  ];

  for (const [pair, affinity] of adjacentPairs) {
    if ((pair[0] === domA && pair[1] === domB) || (pair[1] === domA && pair[0] === domB)) {
      return { compatible: true, affinityScore: affinity };
    }
  }

  return { compatible: false, affinityScore: 0 };
}

/**
 * Generates realistic career progression stages based on title and occupational domain.
 */
export function getProgressionLadder(title = '', domain = '') {
  const t = title.toLowerCase();

  if (t.includes('assistant professor') || domain === 'ACADEMIA_EDUCATION') {
    return [
      { level: 'Entry Stage', role: 'Junior Research Fellow / Guest Lecturer', description: 'Completing postgraduate research, qualifying eligibility exams (NET/SLET), and conducting tutorials' },
      { level: 'Current Role', role: title || 'Assistant Professor', description: 'Lecturing, curriculum development, guiding student dissertations, and publishing original research', current: true },
      { level: 'Mid-Career', role: 'Associate Professor', description: 'Directing funded research projects, senior faculty administration, and doctoral supervision' },
      { level: 'Senior Leadership', role: 'Professor / Department Head (HOD)', description: 'Academic chair, curriculum board governance, and institutional leadership' }
    ];
  }

  if (t.includes('erp') || (domain === 'ENTERPRISE_SYSTEMS' && t.includes('specialist'))) {
    return [
      { level: 'Entry Stage', role: 'Junior Business Systems Analyst', description: 'Documenting user requirements, testing software modules, and data migration support' },
      { level: 'Current Role', role: title || 'ERP Specialist', description: 'Configuring enterprise business workflows, custom report generation, and user enablement', current: true },
      { level: 'Mid-Career', role: 'Senior ERP Functional Consultant', description: 'End-to-end enterprise implementation lifecycle, architecture design, and change management' },
      { level: 'Senior Leadership', role: 'Enterprise Systems Director / Solution Architect', description: 'Strategic digital transformation roadmaps and multi-system integration' }
    ];
  }

  if (t.includes('backend') || (domain === 'SOFTWARE_PLATFORMS' && t.includes('developer'))) {
    return [
      { level: 'Entry Stage', role: 'Junior Backend Developer', description: 'Writing API endpoints, maintaining database models, and bug fixes under code review' },
      { level: 'Current Role', role: title || 'Backend Developer', description: 'Designing microservices, database query optimization, REST APIs, and system reliability', current: true },
      { level: 'Mid-Career', role: 'Senior Backend Engineer / Tech Lead', description: 'System scalability, architectural patterns, mentoring engineers, and cloud infrastructure' },
      { level: 'Senior Leadership', role: 'Principal Architect / Engineering Director', description: 'Platform technical vision, cross-team engineering standards, and infrastructure strategy' }
    ];
  }

  if (t.includes('data analyst') || domain === 'DATA_INTELLIGENCE') {
    return [
      { level: 'Entry Stage', role: 'Junior Data Analyst', description: 'Data extraction, dashboard updates, spreadsheet verification, and cleaning raw logs' },
      { level: 'Current Role', role: title || 'Data Analyst', description: 'Exploratory data analysis, SQL modeling, executive reporting, and predictive analytics', current: true },
      { level: 'Mid-Career', role: 'Senior Analytics Consultant / Lead Analyst', description: 'Cross-functional business intelligence strategy, advanced statistical experimentation' },
      { level: 'Senior Leadership', role: 'Head of Analytics / Chief Data Officer', description: 'Enterprise data governance, machine learning infrastructure, and strategic decisions' }
    ];
  }

  if (t.includes('finance') || domain === 'FINANCE_ACCOUNTING') {
    return [
      { level: 'Entry Stage', role: 'Junior Financial Analyst', description: 'Financial data compilation, variance tracking, and ledger reconciliation' },
      { level: 'Current Role', role: title || 'Finance Technology Analyst', description: 'Automating financial models, financial system analytics, and executive forecasting', current: true },
      { level: 'Mid-Career', role: 'Senior Financial Systems Manager', description: 'Corporate finance transformation, risk analytics, and fintech platform implementation' },
      { level: 'Senior Leadership', role: 'VP of Financial Technology / CFO', description: 'Enterprise capital strategy, regulatory compliance, and fiscal technological innovation' }
    ];
  }

  if (t.includes('doctor') || domain === 'HEALTHCARE_CLINICAL') {
    return [
      { level: 'Foundation', role: 'MBBS Graduate & Resident Intern', description: 'Rotating clinical internships, emergency triage, and supervised inpatient care' },
      { level: 'Current Role', role: title || 'Doctor / Medical Officer', description: 'Clinical diagnosis, patient management, outpatient care, and therapeutic treatment', current: true },
      { level: 'Mid-Career', role: 'Postgraduate Resident / Specialist (MD/MS)', description: 'Specialized clinical domain expertise, intensive care, and surgical or medical practice' },
      { level: 'Senior Leadership', role: 'Senior Consultant / Department Head', description: 'Clinical hospital governance, advanced clinical interventions, and medical directorate' }
    ];
  }

  return [
    { level: 'Entry Stage', role: `Junior ${title}`, description: 'Foundational entry tasks, mentorship, and operational tool onboarding' },
    { level: 'Current Role', role: title, description: 'Core functional responsibilities and independent workflow execution', current: true },
    { level: 'Mid-Career', role: `Senior ${title}`, description: 'Specialized ownership, mentoring team members, and high-impact project delivery' },
    { level: 'Senior Leadership', role: `Lead / Director of ${title}`, description: 'Organizational strategy, department planning, and high-level decisions' }
  ];
}

/**
 * Structures qualification and regulatory requirements into plain-language, trustworthy groups.
 */
export function getRegulatoryAndQualificationGuidance(title = '', domain = '', rawQualifications = [], rawEntryRoutes = []) {
  const t = title.toLowerCase();
  const quals = Array.isArray(rawQualifications) ? rawQualifications : [];
  const routes = Array.isArray(rawEntryRoutes) ? rawEntryRoutes : [];

  const mandatory = [];
  const preferred = [];
  let statutoryFramework = null;
  let recommendedNextAction = null;

  if (t.includes('assistant professor')) {
    statutoryFramework = {
      authority: 'University Grants Commission (UGC) / AICTE / State Higher Education Councils',
      jurisdiction: 'India (Higher Education Institutions)',
      note: 'Minimum statutory requirements are governed by UGC Regulations on Minimum Qualifications for Appointment of Teachers. State-level appointments may permit State Eligibility Test (SET/SLET) clearance. Specific cutoff scores and recruitment criteria vary by central vs. state university notifications.'
    };

    mandatory.push(
      'Master’s degree with a minimum of 55% marks (or equivalent grade) in the relevant discipline',
      'National Eligibility Test (UGC-NET / CSIR-NET) qualification or accredited State Eligibility Test (SET / SLET)'
    );

    preferred.push(
      'Ph.D. degree in the concerned or allied discipline (mandatory for university-level permanent promotion and CAS advancement)',
      'Published research papers in peer-reviewed or UGC-CARE listed journals',
      'Prior teaching experience through university assistantships or guest lecturing'
    );

    recommendedNextAction = {
      title: 'Review UGC-NET Syllabus & Publications',
      action: 'Download the Paper 1 & discipline-specific syllabus from NTA/UGC, and outline a research paper proposal targeting peer-reviewed journals.'
    };
  } else if (t.includes('doctor') || t.includes('surgeon')) {
    statutoryFramework = {
      authority: 'National Medical Commission (NMC) / State Medical Councils',
      jurisdiction: 'India',
      note: 'Practicing medicine requires a recognized MBBS degree and permanent registration with the NMC or State Medical Council. NMC strictly prohibits online or remote study for clinical medical qualifications.'
    };

    mandatory.push(
      'Bachelor of Medicine and Bachelor of Surgery (MBBS) from an NMC-recognized institution',
      'Completion of 1-year compulsory rotatory medical internship',
      'Valid registration with the National Medical Commission (NMC) or State Medical Council'
    );

    preferred.push(
      'Postgraduate qualification (MD / MS / DNB) in a specialized medical or surgical discipline',
      'Clinical residency experience in secondary or tertiary healthcare facilities'
    );

    recommendedNextAction = {
      title: 'Verify Medical Council Registration & NEET PG Milestones',
      action: 'Consult official NMC admission gazettes for upcoming NEET-PG residency counseling and clinical specialty requirements.'
    };
  } else if (t.includes('police')) {
    statutoryFramework = {
      authority: 'State Police Recruitment Boards / Staff Selection Commission / UPSC',
      jurisdiction: 'State / Central Government',
      note: 'Recruitment is conducted via statutory competitive examinations followed by mandatory physical endurance tests, medical fitness examinations, and police academy training.'
    };

    mandatory.push(
      'Bachelor’s degree from a recognized university in any discipline',
      'Compliance with statutory physical measurement benchmarks (height, chest expansion)',
      'Passing the physical efficiency and endurance test (PET)'
    );

    preferred.push(
      'NCC Certificate (C/B certificate holders frequently receive statutory weightage)',
      'Working knowledge of the regional language and IPC/CrPC statutory foundations'
    );

    recommendedNextAction = {
      title: 'Review Official Police Recruitment Notification',
      action: 'Verify recent age eligibility criteria, physical endurance benchmarks, and syllabus for the State Police Sub-Inspector / Constable exam.'
    };
  } else if (t.includes('erp')) {
    statutoryFramework = {
      authority: 'Market Enterprise Standards & Vendor Certifications',
      jurisdiction: 'Global Industry Standards',
      note: 'Not governed by government statutory licensing. Recruitment evaluates documented software competency, business workflow mapping, and enterprise system deployments.'
    };

    mandatory.push(
      'Bachelor’s degree in Computer Science, Information Technology, Business Administration, or Finance',
      'Working competency in relational databases (SQL) and enterprise process flows'
    );

    preferred.push(
      'Official vendor certification (e.g. SAP Certified Associate, Oracle NetSuite, or Microsoft Dynamics 365)',
      'Practical participation in at least one enterprise system rollout or module configuration lifecycle'
    );

    recommendedNextAction = {
      title: 'Practice Business Process Flow Mapping',
      action: 'Design an end-to-end Order-to-Cash or Procure-to-Pay workflow diagram and review standard SAP S/4HANA module structures.'
    };
  } else {
    // Default fallback cleanly parsing provided raw arrays
    if (quals.length > 0) {
      mandatory.push(quals[0]);
      if (quals.length > 1) {
        preferred.push(...quals.slice(1));
      }
    } else {
      mandatory.push('Bachelor’s degree or relevant professional diploma');
    }

    if (routes.length > 0) {
      preferred.push(`Common entry route: ${routes[0]}`);
    }

    recommendedNextAction = {
      title: 'Review Target Job Postings & Key Skills',
      action: `Identify 3 active job notifications for ${title} to verify specific employer qualifications and preferred certifications.`
    };
  }

  return {
    mandatory,
    preferred,
    statutoryFramework,
    recommendedNextAction
  };
}

/**
 * Deterministically scores and ranks related careers using occupational domain compatibility,
 * domain-specific skill overlap, title overlap, and transferable capability.
 * 
 * STRICT ANTI-CONTAMINATION: Disqualifies careers from incompatible domains that lack
 * domain-specific technical skills. Generic soft skills (Communication, Teamwork, Critical Thinking)
 * CANNOT qualify an unrelated job!
 */
export function scoreAndRankRelatedCareers(sourceCareer, candidateCareers = [], options = {}) {
  const {
    userId = null,
    userSkillIds = new Set(),
    userSkillNames = new Set(),
    limit = 6,
    offset = 0
  } = options;

  if (!sourceCareer || !Array.isArray(candidateCareers)) {
    return { data: [], total: 0, meta: {} };
  }

  const srcSkills = Array.isArray(sourceCareer.skills) ? sourceCareer.skills : [];
  const srcSkillNames = srcSkills.map(s => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean);
  const srcSkillIds = new Set(srcSkills.map(s => s?.id).filter(Boolean));

  const srcDomainInfo = classifyDomain(sourceCareer.title, sourceCareer.description, srcSkillNames);
  const srcDomain = srcDomainInfo.topDomain;

  const srcTitleWords = sourceCareer.title
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter(w => w.length > 2 && !['and', 'for', 'the', 'with', 'role'].includes(w));

  const scoredList = [];

  for (const cand of candidateCareers) {
    if (cand.id === sourceCareer.id) continue;

    const candSkills = Array.isArray(cand.skills) ? cand.skills : [];
    const candSkillNames = candSkills.map(s => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean);
    const candDomainInfo = classifyDomain(cand.title, cand.description, candSkillNames);
    const candDomain = candDomainInfo.topDomain;

    const domainComp = areDomainsCompatible(srcDomain, candDomain);

    // Identify shared skills separating domain-specific from generic
    const sharedDomainSkills = [];
    const sharedGenericSkills = [];
    const uniqueToCand = [];

    for (const sk of candSkills) {
      const name = typeof sk === 'string' ? sk : sk?.name || '';
      const id = sk?.id;
      const norm = normalizeString(name);

      const isShared = (id && srcSkillIds.has(id)) || srcSkillNames.some(s => normalizeString(s) === norm);
      if (isShared) {
        if (GENERIC_SKILLS.has(norm)) {
          sharedGenericSkills.push(name);
        } else {
          sharedDomainSkills.push(name);
        }
      } else if (!GENERIC_SKILLS.has(norm)) {
        uniqueToCand.push(name);
      }
    }

    // STRICT ANTI-CONTAMINATION HARD FILTER:
    // 1. If domains are completely incompatible, candidate MUST share at least 2 domain-specific skills.
    // 2. Generic skills (communication, critical thinking, teamwork) carry 0 cross-domain weight.
    if (!domainComp.compatible && sharedDomainSkills.length < 2) {
      continue;
    }

    // 3. If in compatible adjacent domains (not identical), candidate MUST share at least 1 domain skill.
    if (srcDomain !== candDomain && sharedDomainSkills.length === 0) {
      continue;
    }

    // Compute deterministic relevance score
    let score = domainComp.affinityScore;
    score += sharedDomainSkills.length * 15;
    score += Math.min(sharedGenericSkills.length * 0.5, 2); // Capped at 2 points for generic skills

    // Title token overlap
    const candTitleWords = cand.title
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter(w => w.length > 2 && !['and', 'for', 'the', 'with', 'role'].includes(w));
    const sharedTokens = srcTitleWords.filter(t => candTitleWords.includes(t));
    score += sharedTokens.length * 10;

    // Determine Relationship Tier
    let transitionLevel = 'Transferable Role';
    let transitionDescription = '';
    let relationReason = '';
    let distinction = '';

    const isSameDomain = srcDomain === candDomain;

    if (isSameDomain) {
      // Check for Direct Progression
      const isProgressionPair =
        (sourceCareer.title.toLowerCase().includes('assistant') && cand.title.toLowerCase().includes('associate')) ||
        (sourceCareer.title.toLowerCase().includes('assistant') && cand.title.toLowerCase().includes('professor')) ||
        (sourceCareer.title.toLowerCase().includes('junior') && cand.title.toLowerCase().includes('senior')) ||
        (sourceCareer.title === 'Doctor' && cand.title === 'Surgeon') ||
        (sourceCareer.title === 'Data Analyst' && cand.title === 'Data Scientist');

      if (isProgressionPair) {
        transitionLevel = 'Direct Progression';
        transitionDescription = 'Vertical advancement along the same occupational progression ladder';
      } else if (sharedTokens.length > 0 || sharedDomainSkills.length >= 2) {
        transitionLevel = 'Closely Related';
        transitionDescription = 'Direct occupational alignment sharing core domain responsibilities';
      } else {
        transitionLevel = 'Closely Related';
        transitionDescription = 'Adjacent specialized function within the same occupational family';
      }
    } else {
      transitionLevel = 'Transferable Role';
      transitionDescription = `Transition to adjacent ${candDomain.toLowerCase().replace(/_/g, ' ')} domain with transferable capabilities`;
    }

    // Formulate honest, evidence-based reason
    if (sharedDomainSkills.length > 0) {
      relationReason = `Shares core domain competencies in ${sharedDomainSkills.slice(0, 3).join(', ')}`;
      if (sharedTokens.length > 0) {
        relationReason += ` within the ${sharedTokens.join('/')} field`;
      }
    } else if (isSameDomain) {
      relationReason = `Shared occupational family in ${candDomain.toLowerCase().replace(/_/g, ' ')}`;
    } else {
      relationReason = `Adjacent domain workflows with transferable technical foundation`;
    }

    // Distinction
    if (uniqueToCand.length > 0) {
      distinction = `Emphasizes ${uniqueToCand.slice(0, 2).join(' and ')} in day-to-day work`;
    } else {
      distinction = `Shares substantial day-to-day operational scope`;
    }

    // Personalized user profile match
    let userMatchedCount = 0;
    let userMatchPct = 0;
    let userTransitionLabel = null;
    if (userId && candSkills.length > 0) {
      for (const sk of candSkills) {
        const name = typeof sk === 'string' ? sk : sk?.name || '';
        const id = sk?.id;
        const norm = normalizeString(name);
        if ((id && userSkillIds.has(id)) || userSkillNames.has(norm)) {
          userMatchedCount++;
        }
      }
      userMatchPct = Math.round((userMatchedCount / Math.max(candSkills.length, 1)) * 100);
      if (userMatchPct >= 60) {
        userTransitionLabel = 'Reuses most of your profile skills';
      } else if (userMatchPct >= 30) {
        userTransitionLabel = 'Moderate overlap with your profile skills';
      }
    }

    scoredList.push({
      id: cand.id,
      title: cand.title,
      description: cand.description,
      domain: candDomain,
      score,
      transition_level: transitionLevel,
      transition_description: transitionDescription,
      relation_reason: relationReason,
      distinction,
      shared_skills: sharedDomainSkills.length > 0 ? sharedDomainSkills : sharedGenericSkills,
      shared_domain_skills: sharedDomainSkills,
      unique_skills: uniqueToCand.slice(0, 4),
      user_match_pct: userMatchPct,
      user_transition_label: userTransitionLabel
    });
  }

  // Sort deterministically by score descending, then title alphabetically
  scoredList.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const paginated = scoredList.slice(offset, offset + limit);

  return {
    data: paginated,
    total: scoredList.length,
    meta: {
      source_domain: srcDomain,
      total_found: scoredList.length,
      // Three or fewer verified neighbours is still a deliberately limited
      // catalogue: the UI should explain the narrow result set instead of
      // presenting it as an exhaustive list.
      has_limited_catalogue: scoredList.length <= 3,
      catalogue_scope: 'verified_database',
      catalogue_note: scoredList.length === 0
        ? `No validated adjacent roles currently indexed in PostgreSQL for ${sourceCareer.title}. We do not display fabricated or unrelated careers.`
        : (scoredList.length <= 3
          ? `Displaying ${scoredList.length} verified ${scoredList.length === 1 ? 'relation' : 'relations'} from the database catalogue. Unrelated careers are excluded.`
          : `Showing top ${paginated.length} of ${scoredList.length} database-backed related careers.`)
    }
  };
}
