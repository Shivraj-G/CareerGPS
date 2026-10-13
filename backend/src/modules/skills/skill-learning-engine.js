import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

// Cache for AI-enriched skill details (in-memory, keyed by careerId + skillName)
const aiSkillCache = new Map();

/**
 * Normalizes string for keying and comparison
 */
export function normalizeString(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9+#]/g, '');
}

/**
 * 1. CLASSIFY SKILL LEARNING LEVEL
 * Evaluates skill difficulty independently from career importance.
 * Returns: 'foundational' | 'intermediate' | 'advanced'
 */
export function classifySkillLevel(skillName = '', existingLevel = null, careerTitle = '') {
  if (existingLevel && ['foundational', 'intermediate', 'advanced'].includes(existingLevel)) {
    return existingLevel;
  }

  const s = String(skillName).trim().toLowerCase();

  // Known Foundational Skills (Level 1)
  const foundationalKeywords = [
    'fundamental', 'basics', 'introductory', 'beginner', 'overview',
    'python', 'html', 'css', 'javascript', 'git', 'excel', 'problem solving',
    'communication', 'presentation', 'physical fitness', 'anatomy', 'physiology',
    'medical terminology', 'medical ethics', 'digital literacy', 'adaptability',
    'business knowledge', 'teamwork', 'office administration', 'statistics',
    'first aid', 'typing', 'elementary', 'principles'
  ];

  // Known Advanced Skills (Level 3)
  const advancedKeywords = [
    'advanced', 'llm', 'rag', 'vector search', 'prompt engineering', 'docker',
    'kubernetes', 'system design', 'distributed', 'microservices', 'cloud architecture',
    'clinical decision support', 'academic writing', 'research methodology',
    'doctoral', 'litigation strategy', 'compiler', 'neural network', 'deep learning',
    'enterprise architecture', 'strategic change', 'quantum'
  ];

  if (advancedKeywords.some(kw => s.includes(kw))) {
    return 'advanced';
  }

  if (foundationalKeywords.some(kw => s.includes(kw))) {
    // Edge case: "advanced python" or "production statistics"
    if (s.includes('advanced') || s.includes('production') || s.includes('distributed')) {
      return 'advanced';
    }
    return 'foundational';
  }

  // Default for applied practical work is intermediate (Level 2)
  return 'intermediate';
}

/**
 * Map learning level to numeric tier
 */
export function getLevelNumber(learningLevel) {
  switch (learningLevel) {
    case 'foundational': return 1;
    case 'advanced': return 3;
    case 'intermediate':
    default: return 2;
  }
}

/**
 * Structured taxonomy definitions for verified database skills
 */
const SKILL_INTELLIGENCE_BASE = {
  // Programming & Dev
  'python': {
    what_it_means: 'Python is a high-level, human-readable programming language known for clean syntax and vast ecosystem libraries for automation, data science, and AI.',
    subtopics: ['Variables, data types, and control flow (if/else, loops)', 'Functions, modules, and error handling', 'Object-Oriented Programming (classes, objects)', 'Virtual environments and package management with pip'],
    prerequisites: ['None (Entry-friendly programming language)'],
    effort: '2–3 weeks (planning estimate)',
    exercise: 'Write a script that reads a CSV dataset, filters rows based on a condition, and calculates summary metrics.'
  },
  'javascript': {
    what_it_means: 'JavaScript is the fundamental programming language of the web, enabling interactive web interfaces and server-side runtimes like Node.js.',
    subtopics: ['ES6+ syntax (const/let, arrow functions, destructuring)', 'Asynchronous programming (Promises, async/await)', 'DOM manipulation and event handling', 'Module imports and JSON handling'],
    prerequisites: ['HTML and basic CSS fundamentals'],
    effort: '2–3 weeks (planning estimate)',
    exercise: 'Build an interactive web counter and task tracker that saves items to local storage.'
  },
  'html': {
    what_it_means: 'HyperText Markup Language (HTML) provides the semantic skeleton and document structure for web applications and digital content.',
    subtopics: ['Semantic markup (<header>, <main>, <article>, <footer>)', 'Accessible form elements and input validation', 'Media embedding (images, video, audio)', 'SEO meta tags and document head elements'],
    prerequisites: ['None (Entry-friendly foundational web markup)'],
    effort: '1 week (planning estimate)',
    exercise: 'Construct a multi-section accessible profile page using pure semantic HTML5.'
  },
  'css': {
    what_it_means: 'Cascading Style Sheets (CSS) controls presentation, responsive layouts, colors, typography, and visual animations in web applications.',
    subtopics: ['Box model (margin, border, padding, content)', 'Flexbox and CSS Grid layout systems', 'Responsive design and media queries', 'CSS variables, transitions, and hover states'],
    prerequisites: ['Basic HTML structure'],
    effort: '1–2 weeks (planning estimate)',
    exercise: 'Style a responsive 3-column card grid that collapses cleanly into a single column on mobile screens.'
  },
  'git': {
    what_it_means: 'Git is a distributed version control system that records changes to code over time, enabling team collaboration and project rollback.',
    subtopics: ['Repository initialization and commit lifecycle', 'Branching, merging, and merge conflict resolution', 'Remote repositories (cloning, pushing, pulling)', 'Git log inspection and clean commit hygiene'],
    prerequisites: ['Basic terminal or command-line familiarity'],
    effort: '1 week (planning estimate)',
    exercise: 'Create a local repository, make feature branch commits, resolve a simulated merge conflict, and push to GitHub.'
  },
  'react': {
    what_it_means: 'React is a component-based JavaScript library for building responsive, declarative user interfaces with reusable UI elements.',
    subtopics: ['Component lifecycle and JSX syntax', 'State management with useState and useEffect', 'Component props and unidirectional data flow', 'Custom hooks and API fetching integration'],
    prerequisites: ['JavaScript ES6+ fundamentals', 'HTML & CSS basics'],
    effort: '3–4 weeks (planning estimate)',
    exercise: 'Build a searchable catalog component that fetches data from an API and filters results in real-time.'
  },
  'node.js': {
    what_it_means: 'Node.js is an open-source, cross-platform JavaScript runtime environment that executes code outside a web browser, powering backend APIs.',
    subtopics: ['Node.js event loop and asynchronous I/O', 'Built-in modules (fs, path, http)', 'Package management with npm', 'Environment variables and process configuration'],
    prerequisites: ['JavaScript fundamentals (ES6+, async/await)'],
    effort: '2–3 weeks (planning estimate)',
    exercise: 'Build a small Node.js CLI script that processes file directories and outputs JSON summaries.'
  },
  'express.js': {
    what_it_means: 'Express.js is a minimalist web framework for Node.js that simplifies routing, middleware pipelines, and RESTful API creation.',
    subtopics: ['REST endpoint routing (GET, POST, PUT, DELETE)', 'Custom middleware and error handlers', 'Request body parsing and validation', 'CORS and security headers integration'],
    prerequisites: ['Node.js runtime basics', 'JavaScript async/await'],
    effort: '2 weeks (planning estimate)',
    exercise: 'Build a 3-endpoint REST API with input validation and centralized error handling.'
  },
  'sql': {
    what_it_means: 'Structured Query Language (SQL) is the standard language for storing, querying, aggregating, and managing data in relational databases.',
    subtopics: ['SELECT, WHERE, ORDER BY, and LIMIT queries', 'INNER JOIN, LEFT JOIN, and table relationships', 'Aggregation functions (COUNT, SUM, AVG, GROUP BY, HAVING)', 'Data modification (INSERT, UPDATE, DELETE) and transactions'],
    prerequisites: ['Basic logical thinking and spreadsheet familiarity'],
    effort: '2–3 weeks (planning estimate)',
    exercise: 'Write a multi-table JOIN query that aggregates monthly sales volume per department.'
  },
  'postgresql': {
    what_it_means: 'PostgreSQL is a powerful, open-source object-relational database system known for reliability, robust SQL compliance, and JSONB support.',
    subtopics: ['Relational schema design and primary/foreign keys', 'Indexes (B-tree, GIN) and EXPLAIN query analysis', 'JSONB semi-structured data querying', 'Transactions, ACID compliance, and connection pooling'],
    prerequisites: ['Standard SQL query fundamentals'],
    effort: '2–3 weeks (planning estimate)',
    exercise: 'Design a normalized schema with foreign keys and a B-tree index on search columns.'
  },
  'rest apis': {
    what_it_means: 'Representational State Transfer (REST) is a software architectural style that defines how web services exchange JSON data over HTTP.',
    subtopics: ['HTTP methods (GET, POST, PUT, PATCH, DELETE)', 'Status codes (200, 201, 400, 401, 404, 500)', 'URL endpoint design best practices', 'Authentication headers and token transmission'],
    prerequisites: ['Basic web fundamentals and HTTP concepts'],
    effort: '1–2 weeks (planning estimate)',
    exercise: 'Test and document a complete CRUD API using HTTP client calls and Postman/curl.'
  },
  'docker': {
    what_it_means: 'Docker is a containerization platform that packages software code alongside all its dependencies so it runs reliably across any environment.',
    subtopics: ['Container concepts vs virtual machines', 'Writing efficient Dockerfiles', 'Building, tagging, and running containers', 'Docker Compose for multi-service environments'],
    prerequisites: ['Linux command line basics', 'Backend runtime experience (Node/Python)'],
    effort: '2–3 weeks (planning estimate)',
    exercise: 'Containerize a Node.js web server with a Dockerfile and verify it runs identically locally and in isolated containers.'
  },

  // AI & Data Science
  'machine learning': {
    what_it_means: 'Machine Learning (ML) focuses on developing algorithms that train on historical data to identify patterns, make predictions, and automate decisions.',
    subtopics: ['Supervised vs Unsupervised learning workflows', 'Feature engineering and data preprocessing', 'Scikit-Learn model training (Linear, Trees, Ensemble)', 'Model evaluation metrics (RMSE, Accuracy, Precision, Recall, ROC-AUC)'],
    prerequisites: ['Python fundamentals', 'Basic statistics (mean, variance, correlation)'],
    effort: '4–6 weeks (planning estimate)',
    exercise: 'Train a regression or classification model on a real-world tabular dataset and evaluate generalization with cross-validation.'
  },
  'statistics': {
    what_it_means: 'Statistics provides mathematical tools for collecting, analyzing, interpreting, and presenting empirical numerical data.',
    subtopics: ['Descriptive statistics (mean, median, standard deviation)', 'Probability distributions (Normal, Binomial)', 'Hypothesis testing and p-values', 'Confidence intervals and regression analysis'],
    prerequisites: ['High school algebra and arithmetic'],
    effort: '2–3 weeks (planning estimate)',
    exercise: 'Perform an A/B hypothesis test on two sample distributions and compute the p-value.'
  },
  'problem solving': {
    what_it_means: 'Problem Solving is the analytical capability to break complex, ambiguous challenges into structured, solvable steps.',
    subtopics: ['Root cause identification and problem decomposition', 'Algorithm and flowchart planning', 'Evaluating trade-offs and edge cases', 'Iterative testing and validation'],
    prerequisites: ['None (Foundational cognitive competency)'],
    effort: '1–2 weeks (planning estimate)',
    exercise: 'Map a multi-step debugging workflow for an unexpected system failure using a decision tree.'
  },
  'llm concepts': {
    what_it_means: 'Large Language Model (LLM) concepts encompass the architecture, tokenization, attention mechanisms, and prompt workflows powering modern generative AI.',
    subtopics: ['Transformer architecture and self-attention fundamentals', 'Tokens, context windows, and latency trade-offs', 'Prompt engineering and system prompt patterns', 'Temperature, top_p, and structured JSON output constraints'],
    prerequisites: ['Python basics', 'Machine Learning workflows overview'],
    effort: '3–4 weeks (planning estimate)',
    exercise: 'Build an API client that interfaces with an LLM, sets strict temperature, and validates schema responses.'
  },
  'rag': {
    what_it_means: 'Retrieval-Augmented Generation (RAG) combines semantic database retrieval with LLMs to provide grounded, hallucination-resistant answers from private documents.',
    subtopics: ['Document chunking strategies and embedding models', 'Vector databases and cosine similarity search', 'Query expansion and context injection pipelines', 'Hallucination prevention and source citations'],
    prerequisites: ['Python programming', 'LLM Concepts', 'Basic SQL or database querying'],
    effort: '3–4 weeks (planning estimate)',
    exercise: 'Create a mini-RAG pipeline that ingests a PDF text, computes vector embeddings, and answers queries citing specific chunks.'
  },
  'data cleaning': {
    what_it_means: 'Data Cleaning involves detecting, correcting, and normalizing corrupt, inaccurate, or missing records in datasets before analysis.',
    subtopics: ['Handling missing values (imputation vs deletion)', 'Deduplication and string standardisation', 'Detecting outliers and distribution anomalies', 'Date/time parsing and categorical encoding'],
    prerequisites: ['Excel or Python/pandas fundamentals'],
    effort: '2 weeks (planning estimate)',
    exercise: 'Clean a messy raw customer dataset with duplicate emails, mismatched phone numbers, and null entries.'
  },
  'data visualisation': {
    what_it_means: 'Data Visualisation is the practice of translating raw quantitative information into visual charts, dashboards, and graphs that communicate insights.',
    subtopics: ['Choosing appropriate visual formats (scatter, bar, line, heatmap)', 'Visual hierarchy and color psychology', 'Dashboard layout and interactive filtering', 'Communicating key takeaways to non-technical stakeholders'],
    prerequisites: ['Basic spreadsheet or data literacy'],
    effort: '2 weeks (planning estimate)',
    exercise: 'Create an executive dashboard comparing quarterly performance across 4 regional territories.'
  },
  'power bi': {
    what_it_means: 'Microsoft Power BI is a business analytics service that provides interactive visualisations and business intelligence capabilities with self-service reporting.',
    subtopics: ['Data connection and Power Query ETL transformations', 'Data modeling and table relationships (Star schema)', 'DAX formulas (CALCULATE, SUMX, RELATED)', 'Report publishing and interactive filter slicers'],
    prerequisites: ['Excel fundamentals', 'Basic SQL query concepts'],
    effort: '3–4 weeks (planning estimate)',
    exercise: 'Build a multi-page operational dashboard connecting two tables with cross-filtering slicers.'
  },
  'excel': {
    what_it_means: 'Microsoft Excel is an industry-standard spreadsheet application for tabular data calculation, financial modeling, and operational tracking.',
    subtopics: ['Core formulas (SUM, AVERAGE, IF, XLOOKUP, INDEX/MATCH)', 'Pivot Tables and dynamic data summaries', 'Conditional formatting and data validation', 'Workbook design and automated formula auditing'],
    prerequisites: ['None (Foundational office tool)'],
    effort: '1–2 weeks (planning estimate)',
    exercise: 'Build a dynamic budget spreadsheet utilizing XLOOKUP and automated conditional alerts.'
  },
  'business analysis': {
    what_it_means: 'Business Analysis is the discipline of identifying business needs, determining solutions, and facilitating organizational change through requirement elicitation.',
    subtopics: ['Stakeholder interview and requirements gathering', 'Functional vs non-functional requirements documentation', 'Process flow mapping (BPMN diagrams)', 'Gap analysis and acceptance criteria specification'],
    prerequisites: ['Communication and professional collaboration basics'],
    effort: '3–4 weeks (planning estimate)',
    exercise: 'Document a 3-page business requirements specification (BRD) for an automated expense approval workflow.'
  },
  'erp concepts': {
    what_it_means: 'Enterprise Resource Planning (ERP) concepts cover the architecture of integrated software systems that manage core business processes like supply chain, finance, and HR.',
    subtopics: ['Modular system architectures (Finance, SCM, CRM, HR)', 'Master data management and transaction posting', 'Role-based access control and segregation of duties', 'ERP implementation lifecycle and change adoption'],
    prerequisites: ['Business knowledge and basic database familiarity'],
    effort: '3–4 weeks (planning estimate)',
    exercise: 'Map how a purchase order flows through procurement, inventory receipt, and invoice matching in an ERP.'
  },

  // Healthcare
  'anatomy': {
    what_it_means: 'Anatomy is the foundational branch of medical science concerned with the bodily structure of humans, organ systems, and spatial tissue relationships.',
    subtopics: ['Musculoskeletal, cardiovascular, and nervous systems', 'Major organs and visceral cavities', 'Anatomical terminology, planes, and directions', 'Surface landmarks and palpation fundamentals'],
    prerequisites: ['Basic high school biology'],
    effort: '6–8 weeks (planning estimate)',
    exercise: 'Map the blood circulation pathway through the four chambers of the heart and major systemic vessels.'
  },
  'physiology': {
    what_it_means: 'Physiology is the study of how organs, tissues, and cellular systems work together to sustain life and maintain biological homeostasis.',
    subtopics: ['Cellular function and membrane transport', 'Cardiovascular, respiratory, and renal regulation', 'Endocrine signaling and feedback loops', 'Pathophysiological responses to trauma and infection'],
    prerequisites: ['Basic biology and foundational anatomy'],
    effort: '6–8 weeks (planning estimate)',
    exercise: 'Trace the biological feedback loop that stabilizes blood pressure following acute postural changes.'
  },
  'medical terminology': {
    what_it_means: 'Medical Terminology is the standardized linguistic framework of prefixes, roots, and suffixes used by healthcare professionals for precise clinical communication.',
    subtopics: ['Greek and Latin medical word roots', 'Standard anatomical prefixes and suffixes', 'Clinical abbreviations and do-not-use lists', 'Translating complex medical notes into plain patient explanations'],
    prerequisites: ['None (Entry-friendly medical foundation)'],
    effort: '2–3 weeks (planning estimate)',
    exercise: 'Deconstruct 15 clinical diagnostic abbreviations into their constituent morphological roots.'
  },
  'medical ethics': {
    what_it_means: 'Medical Ethics provides the moral framework governing clinical practice, focusing on autonomy, beneficence, non-maleficence, and justice.',
    subtopics: ['Informed consent and patient autonomy', 'Doctor-patient confidentiality and statutory exceptions', 'Beneficence, non-maleficence, and clinical conflict resolution', 'End-of-life care and ethical decision frameworks'],
    prerequisites: ['None (Foundational clinical standard)'],
    effort: '2 weeks (planning estimate)',
    exercise: 'Evaluate an ethical case study involving informed consent refusal and document the justifiable clinical path.'
  },
  'clinical history taking': {
    what_it_means: 'Clinical History Taking is the systematic interviewing process used by clinicians to elicit a patient’s presenting complaints, medical history, and symptoms.',
    subtopics: ['SOCRATES pain assessment framework', 'Past medical, surgical, and medication history review', 'Social history and lifestyle risk evaluation', 'Building rapport and active empathetic listening'],
    prerequisites: ['Medical terminology', 'Basic communication skills'],
    effort: '3–4 weeks (planning estimate)',
    exercise: 'Conduct a structured simulated clinical intake interview using the SOCRATES protocol.'
  },
  'clinical documentation': {
    what_it_means: 'Clinical Documentation involves recording accurate, timely, and legally defensible patient care encounters using recognized structures like SOAP notes.',
    subtopics: ['SOAP note format (Subjective, Objective, Assessment, Plan)', 'Electronic Health Record (EHR) entry standards', 'Legally compliant charting and signature hygiene', 'Confidentiality and record security protocols'],
    prerequisites: ['Medical terminology', 'Clinical history taking'],
    effort: '2–3 weeks (planning estimate)',
    exercise: 'Draft a complete clinical SOAP note for a simulated patient consultation encounter.'
  },
  'clinical decision support': {
    what_it_means: 'Clinical Decision Support involves using evidence-based guidelines, diagnostic algorithms, and digital tools to assist clinicians in diagnostic and therapeutic choices.',
    subtopics: ['Evidence-based medicine hierarchies and clinical trials', 'Diagnostic likelihood ratios and sensitivity/specificity', 'Computerized alerts, drug interaction screening, and clinical pathways', 'Managing diagnostic cognitive bias'],
    prerequisites: ['Anatomy, Physiology, and Clinical history taking'],
    effort: '4–6 weeks (planning estimate)',
    exercise: 'Evaluate differential diagnosis possibilities for an acute abdomen presentation using clinical likelihood ratios.'
  },

  // Education
  'teaching/pedagogy': {
    what_it_means: 'Pedagogy encompasses the theory, methods, and practices of teaching, focusing on how knowledge is structured, conveyed, and absorbed by diverse learners.',
    subtopics: ['Constructivist and active learning methodologies', 'Classroom management and engagement dynamics', 'Differentiated instruction for diverse learning needs', 'Formative check-ins and lesson scaffolding'],
    prerequisites: ['Subject matter knowledge', 'Strong communication skills'],
    effort: '4–6 weeks (planning estimate)',
    exercise: 'Design an interactive 45-minute lesson plan featuring a 10-minute active inquiry exercise.'
  },
  'curriculum development': {
    what_it_means: 'Curriculum Development is the structured process of designing educational courses, establishing learning outcomes, and aligning assessments with standards.',
    subtopics: ['Bloom’s Taxonomy and learning outcome definition', 'Backward design methodology (Wiggins & McTighe)', 'Syllabus drafting and resource sequencing', 'Curriculum review and continuous improvement loops'],
    prerequisites: ['Teaching fundamentals and subject expertise'],
    effort: '3–4 weeks (planning estimate)',
    exercise: 'Develop a 4-week module outline with measurable learning objectives mapped to Bloom’s Taxonomy.'
  },
  'assessment and evaluation': {
    what_it_means: 'Assessment and Evaluation covers creating rubrics, exams, and diagnostic tools to fairly measure learner comprehension and educational progress.',
    subtopics: ['Formative vs Summative assessment design', 'Grading rubric construction and fairness criteria', 'Item analysis and test question validity', 'Constructive feedback delivery protocols'],
    prerequisites: ['Basic pedagogy principles'],
    effort: '2–3 weeks (planning estimate)',
    exercise: 'Create an analytical 4-tier grading rubric for evaluating a student research presentation.'
  },
  'academic writing': {
    what_it_means: 'Academic Writing is formal, structured expository writing that communicates empirical research, theoretical arguments, and scholarly discoveries.',
    subtopics: ['Literature review synthesis and citation ethics (APA, IEEE)', 'Constructing rigorous theoretical arguments', 'Structuring research papers (IMRaD framework)', 'Peer review processes and academic revisions'],
    prerequisites: ['Strong written communication', 'Basic research literacy'],
    effort: '4–6 weeks (planning estimate)',
    exercise: 'Write an abstract and literature review synthesis analyzing three peer-reviewed studies on a domain topic.'
  },
  'research methodology': {
    what_it_means: 'Research Methodology covers systematic procedures used to formulate hypotheses, collect empirical data, and test scientific arguments.',
    subtopics: ['Qualitative vs Quantitative research paradigms', 'Sampling design and instrument validation', 'Ethical approval and research participant safeguarding', 'Statistical data analysis and reporting standards'],
    prerequisites: ['Statistics basics', 'Academic writing'],
    effort: '6–8 weeks (planning estimate)',
    exercise: 'Draft a complete research methodology proposal specifying sampling criteria, instruments, and validity checks.'
  }
};

/**
 * Returns clean beginner-friendly definition and subtopics for any skill
 */
export function getBaseSkillIntelligence(skillName = '') {
  const norm = normalizeString(skillName);
  
  // 1. Exact match first
  for (const [key, val] of Object.entries(SKILL_INTELLIGENCE_BASE)) {
    if (norm === normalizeString(key)) {
      return { ...val, matchedKey: key };
    }
  }

  // 2. Token/Word match (ensuring word boundaries)
  const skillWords = String(skillName).toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean);
  for (const [key, val] of Object.entries(SKILL_INTELLIGENCE_BASE)) {
    const keyWords = key.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean);
    // If all words of the key match words of the skill name
    if (keyWords.length > 0 && keyWords.every(kw => skillWords.includes(kw))) {
      return { ...val, matchedKey: key };
    }
  }

  // Generative fallback for any unlisted skill

  return {
    what_it_means: `Practical capability in ${skillName}, focusing on core principles, industry standards, and domain execution.`,
    subtopics: [
      `Foundational concepts and terminology of ${skillName}`,
      `Standard workflows, methods, and practical tools`,
      `Common edge cases, problem-solving, and error handling`,
      `Quality validation and execution of deliverables`
    ],
    prerequisites: ['General analytical thinking and basic domain literacy'],
    effort: '2–3 weeks (planning estimate)',
    exercise: `Complete a focused practice task or mini-project demonstrating end-to-end execution of ${skillName}.`
  };
}

/**
 * 2. BUILD STRUCTURED LEARNING METADATA
 * Contextualizes the skill to the specific career being viewed.
 */
export function buildLearningMetadata(skill, careerTitle = 'Professional Role') {
  const skillName = skill.name || 'Competency';
  const intelligence = getBaseSkillIntelligence(skillName);
  const level = skill.learning_level || classifySkillLevel(skillName, skill.learning_level, careerTitle);
  const importance = skill.importance || 'important';

  // Career-contextualized why_needed
  let whyNeeded = '';
  const cLower = careerTitle.toLowerCase();
  const sLower = skillName.toLowerCase();

  if (cLower.includes('ai') && sLower.includes('python')) {
    whyNeeded = `AI Engineers write Python daily to design machine learning pipelines, manipulate numerical tensors with NumPy, train neural networks in PyTorch, and connect LLM APIs.`;
  } else if (cLower.includes('ai') && sLower.includes('machine learning')) {
    whyNeeded = `Core to the AI Engineer role: enables training predictive algorithms, evaluating model generalization, and validating production ML systems.`;
  } else if (cLower.includes('ai') && (sLower.includes('llm') || sLower.includes('rag'))) {
    whyNeeded = `Modern AI systems heavily leverage Retrieval-Augmented Generation to connect Large Language Models with private enterprise data without hallucinations.`;
  } else if (cLower.includes('doctor') || cLower.includes('surgeon')) {
    if (sLower.includes('anatomy') || sLower.includes('physiology')) {
      whyNeeded = `Medical practitioners must possess deep anatomical and physiological knowledge to accurately locate pathologies, interpret symptoms, and prescribe safe treatments.`;
    } else if (sLower.includes('clinical history') || sLower.includes('clinical documentation')) {
      whyNeeded = `Physicians must take structured patient histories to uncover root causes and document findings in legally compliant medical records.`;
    } else {
      whyNeeded = `Directly applied in clinical care workflows to ensure patient safety, accurate diagnosis, and collaborative treatment.`;
    }
  } else if (cLower.includes('erp')) {
    whyNeeded = `ERP Specialists use ${skillName} to integrate cross-departmental business workflows, ensure data integrity across modules, and deliver reliable enterprise reporting.`;
  } else if (cLower.includes('data') && (sLower.includes('sql') || sLower.includes('excel') || sLower.includes('python'))) {
    whyNeeded = `Data Analysts require ${skillName} to extract raw records from databases, validate accuracy, and transform data into actionable management insights.`;
  } else if (cLower.includes('teacher') || cLower.includes('professor')) {
    whyNeeded = `Educators apply ${skillName} to structure engaging learning experiences, assess student comprehension objectively, and foster academic growth.`;
  } else {
    whyNeeded = `Applied regularly in ${careerTitle} workflows to carry out specialized responsibilities, maintain quality standards, and collaborate with team members.`;
  }

  // Practical application description
  const practicalApp = `In actual work as a ${careerTitle}, practitioners apply ${skillName} during core operational tasks, using verified tools to meet project standards and requirements.`;

  // Learning resources: Strictly verified platform curriculum & guidance topics
  const learningResources = [
    {
      title: `CareerGPS Interactive Guide: Mastering ${skillName}`,
      type: 'Curriculum Guide',
      verified: true,
      provider: 'CareerGPS Intelligence System',
      description: `Structured curriculum modules focusing on core principles, practical exercises, and workplace application.`
    },
    {
      title: `Standard Industry Competency Framework: ${skillName}`,
      type: 'Competency Framework',
      verified: true,
      provider: 'Verified Sector Standards',
      description: `Official capabilities benchmark detailing foundational, intermediate, and advanced performance criteria.`
    }
  ];

  // Concrete recommended next action
  const recAction = level === 'foundational'
    ? `Dedicate 30 minutes today to learn core syntax and complete the hands-on exercise.`
    : level === 'intermediate'
    ? `Build a practical scenario project to demonstrate working application in ${careerTitle} workflows.`
    : `Implement an end-to-end architecture prototype solving a complex real-world challenge.`;

  return {
    what_it_means: intelligence.what_it_means,
    why_needed: whyNeeded,
    what_to_learn: intelligence.subtopics,
    prerequisites: intelligence.prerequisites,
    practical_application: practicalApp,
    hands_on_exercise: intelligence.exercise,
    estimated_effort: intelligence.effort,
    learning_resources: learningResources,
    recommended_action: recAction
  };
}

/**
 * 3. PERSONALIZE SKILL FOR AN AUTHENTICATED USER PROFILE
 * Connects profile evidence (saved skills, custom skills, gap analysis) without altering the goal.
 */
export function personalizeSkill({
  skill,
  careerTitle,
  userSkillsMap = new Map(),
  userProfile = {},
  gapData = null
}) {
  const normName = normalizeString(skill.name);
  const matchedUserSkill = userSkillsMap.get(normName) || userSkillsMap.get(skill.id);

  let userStatus = 'not_reported';
  let isDemonstrated = false;
  let readinessNotes = '';
  let isRecommendedNext = false;

  // Determine user's profile status
  if (matchedUserSkill) {
    if (matchedUserSkill.verified) {
      userStatus = 'demonstrated';
      isDemonstrated = true;
      readinessNotes = `Verified competency in your profile. You have demonstrated capability in this area.`;
    } else {
      userStatus = 'self_reported';
      readinessNotes = `Recorded on your profile (${matchedUserSkill.level || 'self-reported'}). Reviewing advanced application in ${careerTitle} will build higher confidence.`;
    }
  } else if (gapData) {
    // Check if flagged as a priority gap
    const isMissing = Array.isArray(gapData.missing_skills) && gapData.missing_skills.some(m => normalizeString(m.skill || m.name) === normName);
    const isNeedingDev = Array.isArray(gapData.skills_needing_development) && gapData.skills_needing_development.some(m => normalizeString(m.skill || m.name) === normName);
    if (isMissing || isNeedingDev) {
      userStatus = 'assessed_gap';
      readinessNotes = `Identified as a development priority for ${careerTitle}. Developing this skill will directly increase your role alignment.`;
    }
  }

  if (userStatus === 'not_reported') {
    readinessNotes = `Not currently recorded on your profile. Starting with foundational topics provides an accessible path into this competency.`;
  }

  // Personalize readiness based on prerequisites
  const metadata = skill.learning_metadata || buildLearningMetadata(skill, careerTitle);
  const prereqs = Array.isArray(metadata.prerequisites) ? metadata.prerequisites : [];
  
  // Check if prerequisites are met
  const missingPrereqs = [];
  for (const pr of prereqs) {
    const prNorm = normalizeString(pr);
    if (!prNorm.includes('none') && !prNorm.includes('entryfriendly')) {
      let found = userSkillsMap.has(prNorm);
      if (!found) {
        // Check if any user skill name matches a keyword in the prerequisite
        for (const [key, val] of userSkillsMap.entries()) {
          const kNorm = normalizeString(typeof key === 'string' ? key : val?.name || '');
          if (kNorm.length >= 3 && prNorm.includes(kNorm)) {
            found = true;
            break;
          }
        }
      }
      if (!found) {
        missingPrereqs.push(pr);
      }
    }
  }


  if (missingPrereqs.length > 0 && userStatus !== 'demonstrated' && userStatus !== 'self_reported') {
    readinessNotes += ` Note: Learning ${missingPrereqs.slice(0, 2).join(' and ')} first will establish a stronger foundation before tackling this topic.`;
  } else if (missingPrereqs.length === 0 && userStatus === 'assessed_gap') {
    // If all prerequisites are met and it's a gap, this is an ideal next recommendation!
    isRecommendedNext = true;
  }

  // Avoid recommending a skill user already mastered as their first new task
  if (isDemonstrated || userStatus === 'self_reported') {
    isRecommendedNext = false;
  }

  return {
    user_status: userStatus,
    is_demonstrated: isDemonstrated,
    readiness_notes: readinessNotes,
    is_recommended_next: isRecommendedNext
  };
}

/**
 * 4. FULL PIPELINE: ENRICH CAREER SKILLS LIST
 * Classifies skills into 3 levels, keeps importance separate, generates rich metadata, and personalizes.
 */
export function enrichCareerSkillsList({
  skills = [],
  career = {},
  userSkills = [],
  customSkills = [],
  userProfile = {},
  gapData = null
}) {
  const careerTitle = career.title || 'Career Guide';

  // Build lookup map for user's profile skills
  const userSkillsMap = new Map();
  for (const s of userSkills) {
    userSkillsMap.set(normalizeString(s.name), s);
    if (s.id) userSkillsMap.set(s.id, s);
  }
  for (const s of customSkills) {
    userSkillsMap.set(normalizeString(s.name), { ...s, verified: false, is_custom: true });
    if (s.id) userSkillsMap.set(s.id, { ...s, verified: false, is_custom: true });
  }

  let foundationalCount = 0;
  let intermediateCount = 0;
  let advancedCount = 0;

  const enriched = skills.map((skill) => {
    // 1. Difficulty Tier (Foundational, Intermediate, Advanced)
    const learningLevel = classifySkillLevel(skill.name, skill.learning_level, careerTitle);
    const levelNumber = getLevelNumber(learningLevel);

    if (learningLevel === 'foundational') foundationalCount++;
    else if (learningLevel === 'advanced') advancedCount++;
    else intermediateCount++;

    // 2. Career Importance: STRICTLY PRESERVED from database ('required', 'important', 'useful')
    const importance = skill.importance || 'important';

    // 3. Learning Metadata
    const existingMeta = (skill.learning_metadata && Object.keys(skill.learning_metadata).length > 0)
      ? skill.learning_metadata
      : null;
    const metadata = existingMeta || buildLearningMetadata({ ...skill, learning_level: learningLevel }, careerTitle);

    // 4. Personalized status for user
    const personalization = personalizeSkill({
      skill: { ...skill, learning_level: learningLevel, learning_metadata: metadata },
      careerTitle,
      userSkillsMap,
      userProfile,
      gapData
    });

    return {
      id: skill.id,
      name: skill.name,
      description: skill.description || metadata.what_it_means,
      learning_level: learningLevel,
      level_number: levelNumber,
      importance: importance,
      origin: skill.origin || 'curated',
      verification_status: skill.verification_status || 'verified',
      learning_metadata: metadata,
      user_status: personalization.user_status,
      is_demonstrated: personalization.is_demonstrated,
      readiness_notes: personalization.readiness_notes,
      is_recommended_next: personalization.is_recommended_next
    };
  });

  // Sort by Level (1, 2, 3), then by Importance (required, important, useful), then Name
  enriched.sort((a, b) => {
    if (a.level_number !== b.level_number) return a.level_number - b.level_number;
    const impWeights = { required: 1, important: 2, useful: 3 };
    const diffImp = (impWeights[a.importance] || 2) - (impWeights[b.importance] || 2);
    if (diffImp !== 0) return diffImp;
    return a.name.localeCompare(b.name);
  });

  return {
    skills: enriched,
    summary: {
      foundational_count: foundationalCount,
      intermediate_count: intermediateCount,
      advanced_count: advancedCount,
      total_count: enriched.length
    }
  };
}

/**
 * 5. OPTIONAL AI ENRICHMENT INTEGRATION
 * Calls ai-service if available, validates response, with zero-fail fallback.
 */
export async function enrichSkillWithAi(skillName, careerTitle, importance = 'important') {
  const cacheKey = `${normalizeString(careerTitle)}_${normalizeString(skillName)}`;
  if (aiSkillCache.has(cacheKey)) {
    return aiSkillCache.get(cacheKey);
  }

  if (!env.AI_SERVICE_URL) {
    const fallback = buildLearningMetadata({ name: skillName, importance }, careerTitle);
    aiSkillCache.set(cacheKey, fallback);
    return fallback;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4s strict budget
    const res = await fetch(`${env.AI_SERVICE_URL}/internal/v1/skills/detail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.INTERNAL_SERVICE_TOKEN ? { 'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN } : {})
      },
      body: JSON.stringify({
        skill_name: skillName,
        career_title: careerTitle,
        importance
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.what_it_means && Array.isArray(data.what_to_learn)) {
        aiSkillCache.set(cacheKey, data);
        return data;
      }
    }
  } catch (err) {
    logger.warn('[SkillLearningEngine] AI enrichment timed out or failed, using deterministic fallback', {
      skill: skillName,
      career: careerTitle,
      error: err.message
    });
  }

  const fallback = buildLearningMetadata({ name: skillName, importance }, careerTitle);
  aiSkillCache.set(cacheKey, fallback);
  return fallback;
}
