/**
 * Universal Career-Domain Taxonomy & Validation Layer
 * 
 * Classifies careers into canonical occupational families and validates that
 * recommended project candidates represent authentic work in that discipline,
 * strictly preventing cross-domain contamination (e.g. technical software stacks
 * leaking into culinary, education, or healthcare roles).
 */

export const OCCUPATIONAL_DOMAINS = {
  culinary_hospitality: {
    id: 'culinary_hospitality',
    label: 'Culinary Arts & Hospitality',
    isTechnical: false,
    keywords: [
      'chef', 'cook', 'culinary', 'baker', 'pastry', 'kitchen', 'food',
      'hospitality', 'restaurant', 'catering', 'sommelier', 'gastronomy',
      'menu', 'recipe', 'food service', 'hotel management', 'barista'
    ],
    authenticDeliverables: [
      'recipe_card', 'menu_spec', 'costing_sheet', 'haccp_plan',
      'culinary_portfolio', 'report_doc', 'presentation', 'dataset', 'case_study'
    ],
    coreCompetencies: [
      'Culinary Techniques', 'Menu Planning', 'Food Safety & Hygiene',
      'Recipe Costing', 'Kitchen Operations', 'Plating & Presentation',
      'Allergen Management', 'Inventory Management', 'Nutrition Basics', 'Waste Minimization'
    ],
    bannedTechKeywords: [
      'microservice', 'microservices', 'react', 'node.js', 'express', 'express.js',
      'rest api', 'crud api', 'kafka', 'docker', 'docker compose', 'terraform',
      'aws', 'cloudwatch', 'kubernetes', 'postgres database schema', 'postgresql database schema',
      'fastapi backend', 'graphql api', 'git repo', 'github repository', 'codebase',
      'web app', 'mobile app', 'frontend', 'backend service', 'ci/cd pipeline'
    ]
  },

  education_teaching: {
    id: 'education_teaching',
    label: 'Education & Academic Instruction',
    isTechnical: false,
    keywords: [
      'teacher', 'professor', 'assistant professor', 'lecturer', 'educator',
      'faculty', 'teaching', 'pedagogy', 'curriculum', 'syllabus', 'instruction',
      'school teacher', 'academic researcher', 'tutor', 'instructional designer'
    ],
    authenticDeliverables: [
      'lesson_plan', 'syllabus_curriculum', 'rubric', 'teaching_dossier',
      'presentation', 'report_doc', 'case_study'
    ],
    coreCompetencies: [
      'Lesson Planning', 'Curriculum Design', 'Classroom Management',
      'Assessment & Rubrics', 'Educational Psychology', 'Student Evaluation',
      'Pedagogy', 'Academic Writing', 'Subject Matter Mastery', 'Mentorship'
    ],
    bannedTechKeywords: [
      'microservice', 'microservices', 'react', 'node.js', 'express', 'express.js',
      'rest api', 'crud api', 'kafka', 'docker', 'docker compose', 'terraform',
      'aws', 'cloudwatch', 'kubernetes', 'postgres database schema', 'postgresql database schema',
      'fastapi backend', 'graphql api', 'git repo', 'github repository', 'codebase',
      'web app', 'mobile app', 'frontend', 'backend service', 'ci/cd pipeline'
    ]
  },

  geography_gis_environment: {
    id: 'geography_gis_environment',
    label: 'Geography, GIS & Environmental Science',
    isTechnical: true,
    keywords: [
      'geo analyst', 'gis analyst', 'geography', 'cartography', 'spatial',
      'remote sensing', 'satellite', 'qgis', 'arcgis', 'environmental',
      'urban planning', 'terrain', 'geospatial', 'postgis', 'cartographer'
    ],
    authenticDeliverables: [
      'map_spatial', 'dataset', 'report_doc', 'presentation', 'live_demo', 'code_repo'
    ],
    coreCompetencies: [
      'GIS (Geographic Information Systems)', 'Spatial Data Analysis', 'Cartography & Map Design',
      'QGIS / ArcGIS', 'Projections & CRS', 'Remote Sensing', 'PostGIS', 'Geoprocessing'
    ],
    bannedTechKeywords: [
      'microservice', 'microservices', 'kafka', 'terraform'
    ]
  },

  healthcare_medicine: {
    id: 'healthcare_medicine',
    label: 'Healthcare, Medicine & Clinical Practice',
    isTechnical: false,
    keywords: [
      'doctor', 'surgeon', 'nurse', 'nursing', 'physician', 'clinical',
      'medical', 'medicine', 'patient', 'healthcare', 'hospital', 'pharmacist',
      'paramedic', 'allied health', 'medical officer', 'pathologist'
    ],
    authenticDeliverables: [
      'case_study', 'report_doc', 'safety_sop', 'presentation', 'protocol_audit'
    ],
    coreCompetencies: [
      'Clinical Assessment', 'Patient Safety', 'Medical Documentation',
      'Pharmacology', 'Infection Control', 'Clinical Communication',
      'Healthcare Ethics', 'Evidence-Based Practice', 'Vital Signs Monitoring'
    ],
    regulatoryWarning: 'Practical simulation projects must never be represented as substitutes for formal medical/nursing qualifications, supervised clinical rotations, or statutory licensing.',
    bannedTechKeywords: [
      'microservice', 'microservices', 'react', 'node.js', 'express',
      'rest api', 'crud api', 'kafka', 'docker', 'terraform', 'aws'
    ]
  },

  business_finance_operations: {
    id: 'business_finance_operations',
    label: 'Business, Finance & Operations',
    isTechnical: false,
    keywords: [
      'business analyst', 'finance', 'accounting', 'accountant', 'operations',
      'clerk', 'audit', 'financial', 'erp', 'consultant', 'procurement',
      'financial analyst', 'tax consultant', 'business development', 'office administrator'
    ],
    authenticDeliverables: [
      'dataset', 'report_doc', 'presentation', 'architecture', 'case_study'
    ],
    coreCompetencies: [
      'Financial Modeling', 'Business Analysis', 'Process Optimization',
      'Excel Modeling', 'Cost Analysis', 'Reporting', 'Budgeting',
      'Risk Analysis', 'Variance Analysis', 'Workflow Mapping'
    ],
    bannedTechKeywords: [
      'microservice', 'microservices', 'react frontend app', 'kafka pipeline',
      'docker container', 'terraform', 'kubernetes'
    ]
  },

  marketing_communications: {
    id: 'marketing_communications',
    label: 'Marketing & Communications',
    isTechnical: false,
    keywords: [
      'marketing', 'marketing specialist', 'advertising', 'brand', 'campaign',
      'content marketing', 'seo', 'social media', 'pr', 'communications',
      'copywriter', 'digital marketing', 'growth marketer', 'media planner'
    ],
    authenticDeliverables: [
      'campaign_brief', 'presentation', 'report_doc', 'dataset', 'content_calendar', 'case_study'
    ],
    coreCompetencies: [
      'Campaign Strategy', 'Audience Research', 'Copywriting', 'Digital Advertising',
      'Performance Analytics', 'Social Media Strategy', 'Brand Identity', 'Email Marketing'
    ],
    bannedTechKeywords: [
      'microservice', 'microservices', 'kafka', 'terraform', 'compiler', 'docker container'
    ]
  },

  design_creative: {
    id: 'design_creative',
    label: 'Design & Visual Arts',
    isTechnical: false,
    keywords: [
      'graphic designer', 'ui/ux', 'visual design', 'product design', 'illustrator',
      'creative director', 'art director', 'photographer', 'interior designer',
      'animator', 'brand designer', 'design'
    ],
    authenticDeliverables: [
      'design_portfolio', 'figma_prototype', 'brand_guidelines', 'presentation', 'report_doc'
    ],
    coreCompetencies: [
      'Visual Hierarchy', 'Typography', 'Figma / Adobe Suite', 'Layout Design',
      'Branding & Identity', 'Color Theory', 'User Research', 'Wireframing & Prototyping'
    ],
    bannedTechKeywords: [
      'microservice', 'microservices', 'kafka', 'terraform', 'docker'
    ]
  },

  law_public_policy: {
    id: 'law_public_policy',
    label: 'Law, Public Policy & Governance',
    isTechnical: false,
    keywords: [
      'police officer', 'police', 'lawyer', 'legal', 'law', 'court',
      'justice', 'compliance', 'public policy', 'criminology', 'investigation',
      'governance', 'paralegal', 'advocate'
    ],
    authenticDeliverables: [
      'report_doc', 'case_study', 'safety_sop', 'presentation'
    ],
    coreCompetencies: [
      'Legal Research', 'Statutory Compliance', 'Case Briefing', 'Evidentiary Documentation',
      'Investigative Procedures', 'Public Safety SOPs', 'Ethics & Due Process'
    ],
    bannedTechKeywords: [
      'microservice', 'microservices', 'react web app', 'kafka', 'terraform', 'docker'
    ]
  },

  engineering_physical: {
    id: 'engineering_physical',
    label: 'Physical Engineering & Technical Trades',
    isTechnical: true,
    keywords: [
      'technician', 'mechanical engineer', 'civil engineer', 'electrical engineer',
      'hardware engineer', 'electronics', 'automotive', 'manufacturing', 'maintenance'
    ],
    authenticDeliverables: [
      'report_doc', 'architecture', 'dataset', 'presentation', 'safety_sop'
    ],
    coreCompetencies: [
      'Technical Diagnostics', 'Circuit Design', 'CAD Modeling',
      'Maintenance Protocols', 'Systems Troubleshooting', 'Safety & OSHA Standards'
    ],
    bannedTechKeywords: [
      'react web app', 'frontend developer', 'kafka streaming'
    ]
  },

  software_engineering_it: {
    id: 'software_engineering_it',
    label: 'Software Engineering & Cloud Computing',
    isTechnical: true,
    keywords: [
      'software', 'backend developer', 'frontend developer', 'full stack developer',
      'cloud / devops engineer', 'devops', 'cloud', 'cybersecurity analyst',
      'cybersecurity', 'developer', 'programmer', 'web developer', 'systems engineer'
    ],
    authenticDeliverables: [
      'code_repo', 'live_demo', 'api_doc', 'architecture', 'report_doc'
    ],
    coreCompetencies: [
      'JavaScript', 'TypeScript', 'Python', 'Node.js', 'React', 'SQL',
      'REST APIs', 'Git', 'Docker', 'System Design', 'CI/CD', 'Cybersecurity'
    ],
    bannedTechKeywords: []
  },

  data_engineering: {
    id: 'data_engineering',
    label: 'Data Engineering & Pipeline Architecture',
    isTechnical: true,
    keywords: [
      'data engineer', 'etl developer', 'data platform engineer',
      'big data engineer', 'pipeline engineer', 'data warehouse engineer'
    ],
    authenticDeliverables: [
      'code_repo', 'dataset', 'architecture', 'report_doc', 'test_results'
    ],
    coreCompetencies: [
      'Python', 'SQL', 'Data Pipelines (ETL/ELT)', 'Database Modeling',
      'Data Quality & Validation', 'dbt / Airflow', 'Parquet / Data Lake',
      'Schema Design', 'Data Warehousing'
    ],
    bannedTechKeywords: []
  },

  data_ai: {
    id: 'data_ai',
    label: 'Data Science, Analytics & AI Engineering',
    isTechnical: true,
    keywords: [
      'ai engineer', 'data analyst', 'data scientist',
      'machine learning', 'deep learning', 'nlp', 'computer vision', 'analytics'
    ],
    authenticDeliverables: [
      'code_repo', 'dataset', 'presentation', 'report_doc', 'live_demo'
    ],
    coreCompetencies: [
      'Python', 'SQL', 'Statistics', 'Exploratory Data Analysis',
      'Machine Learning', 'Data Visualization', 'Model Evaluation', 'RAG Pipelines'
    ],
    bannedTechKeywords: []
  },

  general_professional: {
    id: 'general_professional',
    label: 'General Professional & Workplace Practice',
    isTechnical: false,
    keywords: [
      'general professional', 'human resources', 'hr', 'logistics coordinator',
      'event planner', 'fitness coach', 'manager'
    ],
    authenticDeliverables: [
      'report_doc', 'presentation', 'case_study'
    ],
    coreCompetencies: [
      'Communication', 'Problem Solving', 'Project Management', 'Workplace Ethics'
    ],
    bannedTechKeywords: [
      'microservice', 'microservices', 'kafka', 'terraform', 'docker'
    ]
  }
};

/**
 * Classifies a career title and context into its canonical occupational domain.
 */
export function classifyCareerDomain(careerTitle = '', careerDesc = '', responsibilities = [], careerSkills = []) {
  const normTitle = String(careerTitle || '').toLowerCase().trim();
  const contextText = [
    normTitle,
    String(careerDesc || '').toLowerCase(),
    (responsibilities || []).join(' ').toLowerCase(),
    (careerSkills || []).map(s => typeof s === 'string' ? s : s?.name || '').join(' ').toLowerCase()
  ].join(' ');

  const enrichDomain = (dom) => ({
    ...dom,
    domainId: dom.id
  });

  // 1. Direct title keyword match (highest precedence)
  for (const domain of Object.values(OCCUPATIONAL_DOMAINS)) {
    for (const kw of domain.keywords) {
      // Word boundary match for title
      const regex = new RegExp(`(^|\\b)${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\b|$)`, 'i');
      if (regex.test(normTitle)) {
        return enrichDomain(domain);
      }
    }
  }

  // 2. Score across broader context (responsibilities, description, skills)
  let bestDomain = OCCUPATIONAL_DOMAINS.general_professional;
  let bestScore = 0;

  for (const domain of Object.values(OCCUPATIONAL_DOMAINS)) {
    let score = 0;
    for (const kw of domain.keywords) {
      if (contextText.includes(kw)) score += 2;
    }
    for (const skill of domain.coreCompetencies) {
      if (contextText.includes(skill.toLowerCase())) score += 3;
    }
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  return enrichDomain(bestDomain);
}

/**
 * Validates whether a project candidate is authentic to the target career domain
 * and rejects cross-domain contaminations (e.g. software microservices for a Chef).
 */
export function validateProjectCandidate(project, domainProfileOrId, careerTitle = '') {
  let domainProfile = domainProfileOrId;
  if (typeof domainProfileOrId === 'string') {
    domainProfile = OCCUPATIONAL_DOMAINS[domainProfileOrId] || classifyCareerDomain(domainProfileOrId || careerTitle);
  }
  if (!domainProfile) {
    domainProfile = classifyCareerDomain(careerTitle || 'General Professional');
  }

  const errors = [];
  if (!project || typeof project !== 'object') {
    return { valid: false, errors: ['Project must be a valid object'], reason: 'Project must be a valid object' };
  }

  const title = String(project.title || '').trim();
  const brief = String(project.brief || '').trim();
  const problemStatement = String(project.problem_statement || project.problemStatement || '').trim();
  const skills = Array.isArray(project.skills) ? project.skills : [];
  const deliverables = Array.isArray(project.deliverables) ? project.deliverables : [];
  const fullText = [title, brief, problemStatement, skills.join(' ')].join(' ').toLowerCase();

  // 1. Minimum content checks
  if (!title) errors.push('Missing project title');
  if (!brief && !problemStatement) errors.push('Missing project brief or problem statement');

  // 2. Cross-domain tech-stack leakage check for non-technical careers
  if (!domainProfile.isTechnical && domainProfile.bannedTechKeywords?.length > 0) {
    const detectedLeakingTerms = [];
    for (const banned of domainProfile.bannedTechKeywords) {
      const regex = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(fullText)) {
        detectedLeakingTerms.push(banned);
      }
    }

    if (detectedLeakingTerms.length > 0) {
      errors.push(
        `Forbidden technical stack detected in non-technical domain (${domainProfile.id}): [${detectedLeakingTerms.slice(0, 3).join(', ')}]. A ${domainProfile.label} project must not require software-engineering deliverables.`
      );
    }

    // Deliverables check: non-technical domains cannot require code_repo or live_demo
    const hasUnrelatedCodeDeliverable = deliverables.some(d => {
      const type = String(d.type || '').toLowerCase();
      return type === 'code_repo' || (type === 'live_demo' && domainProfile.id !== 'geography_gis_environment');
    });
    if (hasUnrelatedCodeDeliverable) {
      errors.push(`Forbidden technical stack: non-technical domain (${domainProfile.id}) cannot have software code_repo/live_demo as required deliverables.`);
    }
  }

  // 3. Domain positive affinity checks
  if (domainProfile.id === 'culinary_hospitality') {
    const hasCulinaryTerms = /menu|recipe|kitchen|culinary|food|hygiene|safety|costing|plating|haccp|allergen|restaurant|dining/i.test(fullText);
    if (!hasCulinaryTerms) {
      errors.push('Culinary project lacks authentic culinary/hospitality focus (menu, recipe, food costing, kitchen operations).');
    }
  } else if (domainProfile.id === 'education_teaching') {
    const hasTeachingTerms = /lesson|curriculum|rubric|syllabus|teaching|student|pedagogy|classroom|assessment|dossier/i.test(fullText);
    if (!hasTeachingTerms) {
      errors.push('Education project lacks authentic teaching focus (lesson plan, curriculum, rubric, syllabus).');
    }
  } else if (domainProfile.id === 'geography_gis_environment') {
    const hasGisTerms = /map|spatial|gis|qgis|cartograph|satellite|remote sensing|geospatial|postgis|terrain/i.test(fullText);
    if (!hasGisTerms) {
      errors.push('GIS project lacks authentic geospatial focus (maps, spatial analysis, cartography, remote sensing).');
    }
  } else if (domainProfile.id === 'healthcare_medicine') {
    const hasHealthTerms = /patient|clinical|health|medical|infection|hospital|nursing|care|safety|vital/i.test(fullText);
    if (!hasHealthTerms) {
      errors.push('Healthcare project lacks clinical/healthcare focus (patient care, medical protocol, clinical audit).');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    reason: errors.join('; ')
  };
}
