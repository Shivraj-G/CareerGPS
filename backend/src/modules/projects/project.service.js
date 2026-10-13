import crypto from 'node:crypto';
import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { updateProgress } from '../pathways/pathway.service.js';
import { classifyCareerDomain, validateProjectCandidate } from '../careers/domain-taxonomy.js';

/**
 * Call the AI service with budget-aware timeout and fallback handling.
 */
async function callAi(path, payload, timeoutMs = 15000) {
  if (!env.AI_SERVICE_URL) {
    logger.warn('[ProjectStudio] AI_SERVICE_URL is not set, using database fallback');
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { 'content-type': 'application/json' };
    if (env.INTERNAL_SERVICE_TOKEN) {
      headers['x-internal-service-token'] = env.INTERNAL_SERVICE_TOKEN;
    }
    const response = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      logger.warn(`[ProjectStudio] AI service returned HTTP ${response.status}`, { path, text: text.substring(0, 300) });
      return null;
    }
    return await response.json();
  } catch (err) {
    logger.warn(`[ProjectStudio] AI service call failed or timed out: ${err.message}`, { path });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Compute user experience tier from profile, education, experience, and acquired skills.
 */
export function calculateUserExperienceTier(profile = {}, userSkills = [], completedMilestones = [], existingProjects = []) {
  const education = Array.isArray(profile.education) ? profile.education : [];
  const experience = Array.isArray(profile.experience) ? profile.experience : [];

  let totalExpYears = 0;
  for (const exp of experience) {
    const yrs = Number(exp.years) || (exp.duration ? parseFloat(exp.duration) : 0) || 0;
    totalExpYears += yrs;
  }

  const hasSeniorRole = experience.some(exp => {
    const r = (exp.role || exp.title || '').toLowerCase();
    return r.includes('senior') || r.includes('lead') || r.includes('head') || r.includes('manager') || r.includes('engineer');
  });

  const hasDegree = education.some(e => {
    const deg = (e.degree || e.current_program || e.level || '').toLowerCase();
    return deg.includes('bachelor') || deg.includes('master') || deg.includes('bca') || deg.includes('btech') || deg.includes('bsc') || deg.includes('phd');
  });

  const milestonesCount = completedMilestones.length;
  const projectsCount = existingProjects.length;

  if (totalExpYears >= 3.0 || (totalExpYears >= 1.0 && hasSeniorRole) || milestonesCount >= 4 || projectsCount >= 2) {
    return { tier: 'experienced', totalExpYears, recommendedLevel: 3, label: 'Career-Ready' };
  }
  if (totalExpYears >= 1.0 || hasDegree || userSkills.length >= 3 || milestonesCount >= 2) {
    return { tier: 'intermediate', totalExpYears, recommendedLevel: 2, label: 'Practical' };
  }
  return { tier: 'beginner', totalExpYears, recommendedLevel: 1, label: 'Starter' };
}

/**
 * Deterministic fallback projects generator for any career domain.
 * Guarantees that users never receive an empty list when catalogue or AI service is unavailable.
 */
export function generateFallbackProjects(careerTitle = 'General Professional', userTier = 'beginner', recommendedLevel = 1, domainProfileOrId = null) {
  const norm = String(careerTitle || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const recLvl = recommendedLevel || (userTier === 'experienced' ? 3 : (userTier === 'intermediate' ? 2 : 1));
  let domainId = null;
  if (typeof domainProfileOrId === 'string') {
    domainId = domainProfileOrId;
  } else if (domainProfileOrId?.id) {
    domainId = domainProfileOrId.id;
  } else {
    try {
      domainId = classifyCareerDomain(careerTitle).id;
    } catch {
      domainId = 'general_professional';
    }
  }

  // 1. Chef / Culinary Arts / Hospitality / Kitchen / Baker
  if (domainId === 'culinary_hospitality' || norm.includes('chef') || norm.includes('cook') || norm.includes('culinary') || norm.includes('hospitality') || norm.includes('baker') || norm.includes('kitchen')) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Level 1 — Menu Planning, Recipe Standardization & Food Safety Protocol',
        difficulty_level: 1,
        difficulty_label: 'Starter',
        tier: 1,
        project_type: 'culinary_hospitality',
        estimated_effort: '1 week (8-10 hours)',
        estimated_hours: '8-10',
        brief: 'Design a balanced 3-course menu for a defined audience, create standardized recipe specification sheets with portion calculations, and draft a kitchen food-safety checklist.',
        problem_statement: 'Kitchens suffer inconsistent food quality, cross-contamination risks, and unstandardized portion costs when recipes and safety procedures lack formal documentation.',
        learning_objectives: [
          'Design and document a balanced menu for a target dining audience',
          'Create recipe-standardization sheets with ingredient quantities, preparation steps, and portion yields',
          'Develop a comprehensive food-safety, allergen, and kitchen-preparation checklist adhering to FSSAI/HACCP standards'
        ],
        prerequisites: ['Basic kitchen tools and culinary fundamentals'],
        tasks: [
          { order: 1, title: 'Menu Concept & Target Audience Definition', description: 'Define dining concept, dietary balance, and target customer profile.', deliverable_hint: 'Menu concept summary' },
          { order: 2, title: 'Recipe Standardization Sheets', description: 'Formulate 3 standardized recipe cards specifying exact weights, yields, temperatures, and plating steps.', deliverable_hint: 'Standardized recipe sheets' },
          { order: 3, title: 'Food Safety & Kitchen Prep Checklist', description: 'Compile critical control point checklist covering cross-contamination, holding temperatures, and prep stations.', deliverable_hint: 'HACCP kitchen checklist PDF' }
        ],
        deliverables: [
          { type: 'report_doc', title: 'Standardized Recipe & Menu Portfolio (.pdf)', description: 'Document containing 3-course menu, recipe cards, portion yields, and presentation guide.', format_hint: 'PDF recipe specification document', required: true },
          { type: 'checklist', title: 'Kitchen Food-Safety & Mise en Place Protocol', description: 'Structured operational checklist for food safety, allergen management, and workstation setup.', format_hint: 'PDF checklist document', required: true }
        ],
        acceptance_criteria: [
          'Recipes include precise ingredient quantities (metric/grams), portion counts, and preparation timing',
          'Food safety checklist covers critical temperature zones, allergen identification, and sanitization schedules',
          'Menu structure demonstrates nutritional and flavor balance suitable for target guests'
        ],
        evaluation_rubric: [
          { dimension: 'Culinary Technical Accuracy', criteria: 'Exact ingredient measurements, temperature controls, and standardized preparation instructions' },
          { dimension: 'Food Safety Compliance', criteria: 'Rigorous identification of allergens, cross-contamination safeguards, and hygiene protocols' }
        ],
        skills: ['Culinary Skills', 'Food Safety & HACCP', 'Recipe Standardization', 'Portion Control'],
        starter_template: { title: 'Professional Recipe Standardization Template', description: 'Culinary arts recipe card and kitchen checklist scaffold.', free_alternative: '100% free with open Google Docs / Sheets', url: 'https://careergps.local/templates/recipe-card.docx' },
        reflection_prompts: [
          'What factors did you consider to keep portion yields consistent?',
          'How does formal recipe standardization prevent food waste in busy service?'
        ],
        next_step: 'Advance to Level 2: Build a commercial food costing, allergen matrix, and kitchen workflow study.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 2 — Food Costing, Allergen Matrix & Kitchen Waste-Reduction Case Study',
        difficulty_level: 2,
        difficulty_label: 'Practical',
        tier: 2,
        project_type: 'culinary_hospitality',
        estimated_effort: '2-3 weeks (20 hours)',
        estimated_hours: '20',
        brief: 'Produce a comprehensive food costing model for a small restaurant menu, plan an ingredient procurement and preparation schedule, and develop a kitchen workflow and waste-reduction case study.',
        problem_statement: 'Culinary ventures fail financially when ingredient yields are unmeasured, menu pricing ignores overhead, and preparation delays cause excessive food spoilage.',
        learning_objectives: [
          'Calculate plate costs, food cost percentages (targeting 28-32%), and pricing models',
          'Build an allergen matrix mapping the 14 major allergens across all dishes',
          'Analyze kitchen preparation workflows and develop a measurable food waste minimization strategy'
        ],
        prerequisites: ['Level 1 Recipe Standardization or basic food costing familiarity'],
        tasks: [
          { order: 1, title: 'Ingredient Sourcing & Yield Testing', description: 'Calculate edible portion (EP) vs as-purchased (AP) costs for all recipe ingredients.', deliverable_hint: 'Cost breakdown spreadsheet' },
          { order: 2, title: 'Menu Pricing & Margin Analysis', description: 'Formulate dish pricing based on targeted food cost percentage and local competitive benchmarks.', deliverable_hint: 'Pricing model with margin curves' },
          { order: 3, title: 'Allergen Matrix & Kitchen Prep Timeline', description: 'Map allergens across all dishes and schedule prep batches (mise en place) for service.', deliverable_hint: 'Allergen matrix & prep timetable' },
          { order: 4, title: 'Kitchen Workflow & Waste Reduction Study', description: 'Document food waste tracking audit and practical scrap re-utilization techniques.', deliverable_hint: 'Waste reduction report' }
        ],
        deliverables: [
          { type: 'dataset', title: 'Menu Costing & Margin Workbook (.xlsx)', description: 'Spreadsheet detailing AP/EP ingredient costs, plate costs, selling prices, and food cost percentages.', format_hint: 'Excel spreadsheet or Sheets link', required: true },
          { type: 'report_doc', title: 'Kitchen Workflow & Waste-Reduction Case Study', description: 'Document detailing allergen controls, preparation schedules, and waste reduction audit.', format_hint: 'PDF case study document', required: true }
        ],
        acceptance_criteria: [
          'Costing workbook separates ingredient costs, gross margin, and tax with formula-driven calculations',
          'Allergen matrix accurately maps all dishes against statutory food declaration requirements',
          'Waste-reduction study outlines concrete methods (e.g. stock production, trim utilization) with estimated savings'
        ],
        evaluation_rubric: [
          { dimension: 'Financial Acumen', criteria: 'Accurate plate costing, realistic yield adjustments, and viable restaurant margin targets' },
          { dimension: 'Kitchen Operations', criteria: 'Practical service preparation timelines and thorough waste management procedures' }
        ],
        skills: ['Food Costing & Pricing', 'Kitchen Operations', 'Inventory Management', 'Allergen Compliance', 'Waste Minimization'],
        starter_template: { title: 'Culinary Food Costing & Allergen Workbook', description: 'Excel template with dynamic plate cost formulas and allergen tracking matrix.', free_alternative: 'Free Google Sheets template', url: 'https://careergps.local/templates/food-costing.xlsx' },
        reflection_prompts: [
          'Which ingredient had the biggest impact on your plate margin, and how would you manage supplier price swings?',
          'How does your preparation schedule prevent bottlenecks during peak dining rush?'
        ],
        next_step: 'Advance to Level 3: Deliver a comprehensive restaurant dining concept and operational capstone.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 3 — Restaurant Concept, Operational Plan & Capstone Menu Case Study',
        difficulty_level: 3,
        difficulty_label: 'Career-Ready',
        tier: 3,
        project_type: 'culinary_hospitality',
        estimated_effort: '3-4 weeks (35+ hours)',
        estimated_hours: '35',
        brief: 'Develop a complete restaurant culinary concept and operational case study including signature menu design, standardized recipe portfolios, procurement logistics, kitchen equipment layout, and executive dining presentation.',
        problem_statement: 'Executive chefs and culinary entrepreneurs must integrate creative gastronomy with strict commercial viability, regulatory hygiene, and high-volume kitchen operations.',
        learning_objectives: [
          'Formulate a distinct dining concept, market positioning, and full seasonal menu',
          'Develop end-to-end back-of-house operations: station workflows, staff scheduling, and supplier contracts',
          'Assemble a presentation-ready culinary portfolio case study for restaurant owners or investors'
        ],
        prerequisites: ['Level 2 Food Costing & Kitchen Operations or culinary diploma/experience'],
        tasks: [
          { order: 1, title: 'Dining Concept & Market Positioning', description: 'Define culinary theme, target demographic, seasonal sourcing philosophy, and competitive niche.', deliverable_hint: 'Restaurant concept charter' },
          { order: 2, title: 'Signature Menu & Full Recipe Folio', description: 'Curate appetizers, mains, desserts, and beverage pairings with plating guides and standardized cards.', deliverable_hint: 'Complete menu & plating folio' },
          { order: 3, title: 'Kitchen Operations & Equipment Architecture', description: 'Design kitchen station layout (hot line, cold larder, pastry, wash-up) and service communication protocol.', deliverable_hint: 'Kitchen layout and station SOPs' },
          { order: 4, title: 'Executive Culinary Presentation & Business Case', description: 'Synthesize operational case study and present 12-slide investor/owner concept pitch deck.', deliverable_hint: 'Executive concept deck & full case study' }
        ],
        deliverables: [
          { type: 'presentation', title: 'Culinary Concept & Investor Presentation Deck', description: 'Slide deck detailing restaurant vision, signature dishes, operational model, and financial projections.', format_hint: 'Slide deck PDF', required: true },
          { type: 'report_doc', title: 'Comprehensive Culinary Operations & Menu Case Study', description: 'Extensive operating manual with complete recipes, costing sheets, supplier specifications, and kitchen SOPs.', format_hint: 'Full PDF case study document', required: true }
        ],
        acceptance_criteria: [
          'Case study synthesizes creative culinary identity with rigorous financial modeling and realistic food cost percentages',
          'Kitchen layout addresses clean-to-dirty workflow, cross-contamination separation, and peak-hour service ergonomics',
          'Menu folio documents seasonal ingredient sourcing, dietary accommodations, and standardized plating guidelines'
        ],
        evaluation_rubric: [
          { dimension: 'Culinary Leadership', criteria: 'Cohesive gastronomic concept supported by professional recipe development and presentation' },
          { dimension: 'Operational Viability', criteria: 'Comprehensive kitchen management plan balancing food safety, staffing, and profitability' }
        ],
        skills: ['Culinary Leadership', 'Menu Engineering', 'Kitchen Layout & Operations', 'Staff Management', 'Gastronomy', 'Presentation Skills'],
        starter_template: { title: 'Restaurant Opening & Culinary Case Study Framework', description: 'Executive pitch deck and kitchen operational manual template.', free_alternative: 'Free Google Slides and Docs templates', url: 'https://careergps.local/templates/restaurant-concept.pptx' },
        reflection_prompts: [
          'How did you balance creative culinary ambition with operational kitchen speed during rush service?',
          'What food safety and regulatory licensing considerations were critical to your operating plan?'
        ],
        next_step: 'Capstone completed! Feature this project in your CareerGPS Portfolio.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      }
    ];
  }

  // 2. Cybersecurity Analyst / Security Engineer / InfoSec
  if (norm.includes('cyber') || norm.includes('security') || norm.includes('infosec')) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Level 1 — Network Packet Analysis & Vulnerability Scanning Audit',
        difficulty_level: 1,
        difficulty_label: 'Starter',
        tier: 1,
        project_type: 'technical',
        estimated_effort: '1 week (8-12 hours)',
        estimated_hours: '8-12',
        brief: 'Capture and inspect network traffic with Wireshark, execute structured Nmap vulnerability scans against a test lab, and document discovered security findings in an audit memo.',
        problem_statement: 'Unmonitored network perimeters leave critical ports exposed and fail to detect unauthorized internal traffic patterns.',
        learning_objectives: [
          'Capture and analyze TCP/IP handshakes, DNS queries, and TLS negotiations using Wireshark',
          'Execute targeted port scans, service version detection, and OS fingerprinting with Nmap',
          'Author a professional vulnerability remediation memo prioritizing discovered security risks'
        ],
        prerequisites: ['Basic networking concepts (IP, TCP/UDP, DNS) and Linux terminal fundamentals'],
        tasks: [
          { order: 1, title: 'Network Packet Capture & Protocol Inspection', description: 'Analyze PCAP capture file to trace unencrypted traffic and suspicious port interactions.', deliverable_hint: 'PCAP analysis notes' },
          { order: 2, title: 'Nmap Port & Vulnerability Scan', description: 'Run structured Nmap scans against target lab IP addresses and map open attack surfaces.', deliverable_hint: 'Nmap scan outputs' },
          { order: 3, title: 'Vulnerability Remediation Memo', description: 'Document CVSS scores, risk impact, and step-by-step mitigation advice for each finding.', deliverable_hint: 'Remediation memo PDF' }
        ],
        deliverables: [
          { type: 'report_doc', title: 'Network Vulnerability Audit & Remediation Memo', description: 'Formal security assessment document summarizing scan methodology, findings, and fix guidelines.', format_hint: 'PDF document', required: true }
        ],
        acceptance_criteria: [
          'Audit report ranks vulnerabilities using standard CVSS severity ratings',
          'Packet analysis traces protocol conversations with exact timestamp and port references',
          'Mitigation guidance provides concrete firewall rules or configuration patches'
        ],
        evaluation_rubric: [
          { dimension: 'Technical Analysis', criteria: 'Accurate packet interpretation and comprehensive vulnerability discovery' },
          { dimension: 'Security Reporting', criteria: 'Actionable executive and technical remediation guidance' }
        ],
        skills: ['Cybersecurity', 'Wireshark', 'Nmap', 'Vulnerability Assessment', 'Network Security'],
        starter_template: { title: 'Security Audit & Remediation Scaffold', description: 'Template for technical security assessment reports.', free_alternative: '100% free with open-source Wireshark and Nmap', url: 'https://nmap.org' },
        reflection_prompts: ['What anomalous traffic pattern was most revealing during packet inspection?', 'How do false positives complicate automated vulnerability scanning?'],
        next_step: 'Advance to Level 2: Conduct an automated security assessment and web application penetration test.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 2 — Web Application Security Assessment & OWASP Top 10 Penetration Test',
        difficulty_level: 2,
        difficulty_label: 'Practical',
        tier: 2,
        project_type: 'technical',
        estimated_effort: '2-3 weeks (20 hours)',
        estimated_hours: '20',
        brief: 'Conduct a systematic penetration test against an intentional test lab (OWASP Juice Shop) targeting OWASP Top 10 vulnerabilities (SQLi, XSS, Broken Auth), and compile an actionable penetration testing report.',
        problem_statement: 'Modern web applications leak sensitive user records through unvalidated input vectors and broken access control checks.',
        learning_objectives: [
          'Intercept and modify HTTP payloads using Burp Suite community edition',
          'Identify and verify OWASP Top 10 flaws including SQL Injection and Cross-Site Scripting (XSS)',
          'Author an industry-standard penetration testing report with proof-of-concept exploits and defensive code fixes'
        ],
        prerequisites: ['Level 1 Network Vulnerability Audit or Web Security fundamentals'],
        tasks: [
          { order: 1, title: 'Reconnaissance & Threat Modeling', description: 'Map application endpoints, authentication surfaces, and input parameters.', deliverable_hint: 'Threat model diagram' },
          { order: 2, title: 'Vulnerability Exploitation & Verification', description: 'Verify 3 distinct vulnerabilities using Burp Suite with documented proof-of-concept payloads.', deliverable_hint: 'PoC evidence logs' },
          { order: 3, title: 'Defensive Remediation Code Patches', description: 'Provide parameterized query and input sanitation code examples to fix each flaw.', deliverable_hint: 'Remediation code diffs' },
          { order: 4, title: 'Comprehensive Penetration Testing Report', description: 'Synthesize methodology, vulnerability descriptions, CVSS scores, and executive summary.', deliverable_hint: 'Penetration testing report PDF' }
        ],
        deliverables: [
          { type: 'report_doc', title: 'Web Application Penetration Testing Report', description: 'Professional penetration testing report with PoC screenshots and defensive patches.', format_hint: 'PDF report', required: true }
        ],
        acceptance_criteria: [
          'Report details at least 3 verified OWASP Top 10 vulnerabilities with reproducible steps',
          'Each vulnerability includes CVSS vector, business impact, and verified defensive code patches',
          'Strict compliance disclaimer stating test was executed on authorized lab environment'
        ],
        evaluation_rubric: [
          { dimension: 'Penetration Testing Rigor', criteria: 'Sound exploitation methodology and thorough vulnerability verification' },
          { dimension: 'Remediation Guidance', criteria: 'Robust, defense-in-depth code recommendations' }
        ],
        skills: ['Penetration Testing', 'Burp Suite', 'OWASP Top 10', 'Web Security', 'Vulnerability Assessment'],
        starter_template: { title: 'OWASP Penetration Test Report Scaffold', description: 'Standard security consulting penetration test report structure.', free_alternative: '100% free with OWASP Juice Shop and Burp Suite Community', url: 'https://owasp.org' },
        reflection_prompts: ['Why are client-side input validations insufficient to prevent injection attacks?', 'How does threat modeling help prioritize testing effort?'],
        next_step: 'Advance to Level 3: Deliver a complete Security Operations Center (SOC) incident response and threat hunting capstone.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 3 — Security Operations Center (SOC) Incident Response & Threat Hunting Capstone',
        difficulty_level: 3,
        difficulty_label: 'Career-Ready',
        tier: 3,
        project_type: 'technical',
        estimated_effort: '3-4 weeks (35+ hours)',
        estimated_hours: '35',
        brief: 'Deploy a simulated Security Operations Center (SOC) environment with SIEM log aggregation (Wazuh / Splunk / Elastic), configure automated detection rules, investigate a simulated multi-stage cyber incident, and deliver a full Incident Response Post-Mortem.',
        problem_statement: 'Organizations face persistent advanced threats where mean-time-to-detect (MTTD) directly determines breach severity and regulatory fines.',
        learning_objectives: [
          'Configure a SIEM log collector and author custom detection rules mapped to MITRE ATT&CK techniques',
          'Perform digital forensics analysis reconstructing attack timelines from endpoint and firewall telemetry',
          'Lead incident containment and author an executive Incident Response Post-Mortem with root cause analysis'
        ],
        prerequisites: ['Level 2 Web Application Security Assessment', 'Linux sysadmin and log analysis experience'],
        tasks: [
          { order: 1, title: 'SIEM Deployment & Log Ingestion', description: 'Deploy Elastic/Wazuh test stack with agent log collection for auth, syslog, and web access.', deliverable_hint: 'SIEM architecture setup' },
          { order: 2, title: 'MITRE ATT&CK Detection Rule Authoring', description: 'Write 4 Sigma/SIEM detection rules targeting privilege escalation and credential dumping.', deliverable_hint: 'Detection rule files' },
          { order: 3, title: 'Simulated Breach Investigation & Timeline Reconstruction', description: 'Investigate attack scenario, trace lateral movement, and isolate infected endpoints.', deliverable_hint: 'Forensic timeline analysis' },
          { order: 4, title: 'Executive Post-Mortem & Security Strategy Brief', description: 'Author formal breach post-mortem, disaster recovery review, and present 10-slide executive deck.', deliverable_hint: 'Post-mortem PDF and slide deck' }
        ],
        deliverables: [
          { type: 'report_doc', title: 'SOC Incident Response Post-Mortem Report', description: 'Comprehensive incident investigation report with timeline, IOCs, and root cause analysis.', format_hint: 'PDF document', required: true },
          { type: 'code_repo', title: 'SIEM Detection Rules & SOC Configuration Repository', description: 'GitHub repo containing Sigma rules, SIEM queries, and setup documentation.', format_hint: 'GitHub URL', required: true },
          { type: 'presentation', title: 'CISO Executive Incident Briefing Deck', description: 'Slide deck summarizing incident impact, dwell time, containment actions, and strategic investments.', format_hint: 'Slide deck PDF', required: true }
        ],
        acceptance_criteria: [
          'Detection rules successfully trigger on simulated adversary techniques mapped to MITRE ATT&CK IDs',
          'Forensic timeline documents exact timestamps, IP addresses, user accounts, and process hashes',
          'Post-mortem includes quantifiable containment timeline (MTTD/MTTR) and preventative safeguards'
        ],
        evaluation_rubric: [
          { dimension: 'SOC Operations & Forensics', criteria: 'Rigorous log analysis, correlation, and evidence preservation' },
          { dimension: 'Executive Incident Leadership', criteria: 'Clear, authoritative communication of cyber risks to leadership' }
        ],
        skills: ['Incident Response', 'SIEM & Log Analysis', 'Threat Hunting', 'MITRE ATT&CK', 'Digital Forensics', 'Cybersecurity'],
        starter_template: { title: 'Enterprise Incident Response Capstone Scaffold', description: 'Wazuh/Docker Compose SIEM setup and incident post-mortem template.', free_alternative: '100% free with open-source Wazuh and local Docker', url: 'https://wazuh.com' },
        reflection_prompts: ['What indicator of compromise (IOC) proved most crucial to isolating the attacker?', 'How does threat hunting differ from passive alert monitoring?'],
        next_step: 'Capstone completed! Feature this cybersecurity case study in your CareerGPS Portfolio.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      }
    ];
  }

  // 3. Software / Web / Backend Developer
  if (domainId === 'software_engineering_it' || norm.includes('backend') || norm.includes('software') || norm.includes('web developer') || norm.includes('full stack')) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Level 1 — Validated CRUD REST API Service',
        difficulty_level: 1,
        difficulty_label: 'Starter',
        tier: 1,
        project_type: 'technical',
        estimated_effort: '1 week (8-12 hours)',
        estimated_hours: '8-12',
        brief: 'Build and document a validated, error-handled HTTP REST API that performs complete CRUD operations on a single domain entity.',
        problem_statement: 'Client applications crash or corrupt data when server endpoints fail to validate payloads or return wrong HTTP codes.',
        learning_objectives: ['Design clean REST endpoint contracts', 'Implement request body validation with schemas', 'Build standardized error handling middleware'],
        prerequisites: ['Basic JavaScript or Python syntax', 'HTTP methods understanding'],
        tasks: [
          { order: 1, title: 'Setup Project Structure', description: 'Initialize Node.js Express or FastAPI project with clean folder layout.', deliverable_hint: 'Project package.json' },
          { order: 2, title: 'Define Validation Schemas', description: 'Write strict validation schemas for creating and updating resources.', deliverable_hint: 'Schema validation module' },
          { order: 3, title: 'Implement CRUD Endpoints', description: 'Implement GET, POST, PUT, DELETE with appropriate HTTP status codes.', deliverable_hint: 'Route controllers' },
          { order: 4, title: 'Error Middleware & README Documentation', description: 'Catch unhandled errors and document endpoints in a README.', deliverable_hint: 'README with curl examples' }
        ],
        deliverables: [
          { type: 'code_repo', title: 'Source Code Repository', description: 'Public GitHub repository with clean commit history.', format_hint: 'GitHub URL', required: true },
          { type: 'api_doc', title: 'API Documentation & README', description: 'Markdown documenting endpoints and sample requests.', format_hint: 'Repository README', required: true }
        ],
        acceptance_criteria: ['All CRUD endpoints return correct HTTP status codes', 'Malformed input returns 400 with descriptive error', 'Central error middleware prevents server crashes'],
        evaluation_rubric: [{ dimension: 'Architecture', criteria: 'Clean separation of routes, controllers, and schemas' }, { dimension: 'Validation', criteria: 'Strict payload validation' }],
        skills: ['REST APIs', 'Node.js', 'Express.js', 'Input Validation'],
        starter_template: { title: 'Express Starter Scaffold', description: 'Node.js Express project template with dotenv.', free_alternative: 'Runs 100% locally with zero cloud fees', url: 'https://github.com/expressjs/express' },
        reflection_prompts: ['What HTTP edge cases were trickiest to handle?', 'How does input validation protect backend stability?'],
        next_step: 'Advance to Level 2: Build an authenticated API backed by PostgreSQL.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 2 — Authenticated API with PostgreSQL, Transactions & Automated Tests',
        difficulty_level: 2,
        difficulty_label: 'Practical',
        tier: 2,
        project_type: 'technical',
        estimated_effort: '2-3 weeks (20-30 hours)',
        estimated_hours: '20-30',
        brief: 'Build a multi-entity backend service featuring user registration, JWT/bcrypt authentication, relational PostgreSQL schema, and automated tests.',
        problem_statement: 'Unprotected endpoints and unindexed SQL queries cause security breaches and race conditions under concurrent load.',
        learning_objectives: ['Implement JWT authentication and bcrypt password hashing', 'Design normalized PostgreSQL schemas with foreign keys', 'Write automated integration tests covering error boundaries'],
        prerequisites: ['Level 1 CRUD API or equivalent experience', 'Basic SQL queries'],
        tasks: [
          { order: 1, title: 'Database Schema & Migrations', description: 'Write SQL migrations creating users and relational resource tables.', deliverable_hint: 'SQL migration files' },
          { order: 2, title: 'Auth Middleware & Route Protection', description: 'Implement /auth/register and /auth/login with JWT verification middleware.', deliverable_hint: 'Auth controller & middleware' },
          { order: 3, title: 'Relational Queries & Transactions', description: 'Implement business logic with SQL JOINs and transactions.', deliverable_hint: 'Service layer with parameterized queries' },
          { order: 4, title: 'Automated Integration Test Suite', description: 'Write automated tests with Vitest/Supertest covering auth and database operations.', deliverable_hint: 'Test suite with passing results' }
        ],
        deliverables: [
          { type: 'code_repo', title: 'Source Code & Migrations', description: 'Git repository with migrations, code, and automated tests.', format_hint: 'GitHub URL', required: true },
          { type: 'test_results', title: 'Automated Test Suite Output', description: 'Log or screenshot showing passing integration tests.', format_hint: 'Test runner report', required: true }
        ],
        acceptance_criteria: ['Passwords are never stored in plaintext and verified using bcrypt', 'Protected routes return 401 when token is missing', 'Automated test suite contains at least 8 passing tests'],
        evaluation_rubric: [{ dimension: 'Security', criteria: 'Proper password hashing, JWT expiration, and parameterized SQL queries' }, { dimension: 'Testing', criteria: 'Comprehensive integration test suite covering happy and failure paths' }],
        skills: ['PostgreSQL', 'JWT Authentication', 'Database Migrations', 'Integration Testing'],
        starter_template: { title: 'PostgreSQL Auth Starter', description: 'Express + PostgreSQL template with connection pooling and migrations.', free_alternative: 'Runs locally with local PostgreSQL', url: 'https://careergps.local/templates' },
        reflection_prompts: ['How did you ensure database transactions remain atomic?', 'What was the advantage of foreign key constraints?'],
        next_step: 'Advance to Level 3: Deliver a distributed, scalable microservices capstone.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 3 — Distributed Asynchronous Backend Architecture Capstone',
        difficulty_level: 3,
        difficulty_label: 'Career-Ready',
        tier: 3,
        project_type: 'technical',
        estimated_effort: '3-4 weeks (35+ hours)',
        estimated_hours: '35',
        brief: 'Design and implement a production-grade distributed backend with asynchronous job processing, Redis caching, structured rate limiting, and observability telemetry.',
        problem_statement: 'Monolithic synchronous backends fail under burst traffic and block user threads when processing heavy background tasks.',
        learning_objectives: ['Implement asynchronous job queues with Redis and workers', 'Design cache invalidation strategies and database read replicas', 'Instrument structured logging, Prometheus metrics, and distributed tracing'],
        prerequisites: ['Level 2 Authenticated API', 'Relational database indexing and async architecture'],
        tasks: [
          { order: 1, title: 'Asynchronous Job Worker Setup', description: 'Configure background worker queue with retries, exponential backoff, and dead-letter queue.', deliverable_hint: 'Worker queue module' },
          { order: 2, title: 'Caching & Rate Limiting Layer', description: 'Implement Redis caching with TTL and IP/user rate limiting middleware.', deliverable_hint: 'Cache middleware' },
          { order: 3, title: 'Observability & Metrics Dashboard', description: 'Add structured JSON logging with request IDs and health check metrics endpoints.', deliverable_hint: 'Telemetry setup' },
          { order: 4, title: 'Load Testing & Architecture Case Study', description: 'Perform load testing with k6/Autocannon and document architectural decisions and benchmarks.', deliverable_hint: 'Benchmark report & case study' }
        ],
        deliverables: [
          { type: 'code_repo', title: 'Complete Distributed Architecture Repository', description: 'Full source code with Docker Compose, queue workers, and integration tests.', format_hint: 'GitHub URL', required: true },
          { type: 'report_doc', title: 'Architecture & Load Benchmark Case Study', description: 'Comprehensive report detailing architecture diagrams, benchmark charts, and design trade-offs.', format_hint: 'Case study PDF', required: true }
        ],
        acceptance_criteria: ['Queue workers handle background jobs asynchronously without blocking the HTTP thread', 'Load test verifies sustained throughput under high concurrency', 'System includes comprehensive error telemetry and graceful shutdown handling'],
        evaluation_rubric: [{ dimension: 'System Design', criteria: 'Resilient asynchronous queue patterns, caching, and rate limiting' }, { dimension: 'Production Readiness', criteria: 'Observability, automated tests, and Docker containerization' }],
        skills: ['System Design', 'Redis', 'Message Queues', 'Docker', 'Performance Optimization'],
        starter_template: { title: 'Production Backend Capstone Scaffold', description: 'Docker Compose setup with Redis, Postgres, and worker pipelines.', free_alternative: 'Runs locally with free Docker Desktop', url: 'https://careergps.local/templates' },
        reflection_prompts: ['What failure scenarios did you test for queue workers?', 'How did Redis caching impact your database query latency?'],
        next_step: 'Capstone completed! Feature this project in your CareerGPS Portfolio.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      }
    ];
  }

  // 3. Education / Teaching / Assistant Professor
  if (domainId === 'education_teaching' || norm.includes('teacher') || norm.includes('professor') || norm.includes('faculty') || norm.includes('educator') || norm.includes('pedagogy') || norm.includes('lecturer')) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Level 1 — Outcome-Based Lesson Plan & Learning Objectives Design',
        difficulty_level: 1,
        difficulty_label: 'Starter',
        tier: 1,
        project_type: 'academic',
        estimated_effort: '1 week (6-8 hours)',
        estimated_hours: '6-8',
        brief: 'Design an outcome-based higher education lesson plan for an undergraduate module, mapping Course Outcomes using Bloom’s Revised Taxonomy.',
        problem_statement: 'Lectures that lack structured outcome-based alignment result in low student engagement and fail accreditation evaluation benchmarks.',
        learning_objectives: ['Formulate measurable student learning outcomes using Bloom’s Taxonomy', 'Structure a 60-minute interactive university lecture breakdown', 'Design formative classroom quick-assessment questions'],
        prerequisites: ['Postgraduate domain knowledge in chosen discipline'],
        tasks: [
          { order: 1, title: 'Select Unit Topic & Formulate Course Outcomes', description: 'Choose a core topic and write 3 specific learning objectives mapped to Bloom levels.', deliverable_hint: 'Course outcome matrix' },
          { order: 2, title: 'Structure 60-Minute Lesson Timeline', description: 'Detail pedagogical activities: introductory hook, direct concept instruction, student exercise, and closing.', deliverable_hint: 'Structured lesson outline' },
          { order: 3, title: 'Design In-Class Formative Check', description: 'Create 3 formative check-for-understanding questions and expected student response guide.', deliverable_hint: 'Assessment questions & answer keys' }
        ],
        deliverables: [
          { type: 'lesson_plan', title: 'Outcome-Based Lesson Plan Document', description: 'Complete lesson plan document with Bloom taxonomy mapping and timing breakdown.', format_hint: 'PDF document or Word template', required: true },
          { type: 'report_doc', title: 'Pedagogical Rationale Statement', description: 'Brief explanation of active learning strategies selected for this subject.', format_hint: 'Section within lesson plan document', required: true }
        ],
        acceptance_criteria: ['Learning objectives use measurable action verbs', 'Lesson timeline accounts for all 60 minutes with dedicated active learning', 'Formative assessment directly evaluates stated learning outcomes'],
        evaluation_rubric: [{ dimension: 'Pedagogical Rigor', criteria: 'Accurate Bloom taxonomy alignment and outcome-based education (OBE) design' }, { dimension: 'Instructional Clarity', criteria: 'Practical lecture guidance that another instructor could execute' }],
        skills: ['Teaching/Pedagogy', 'Curriculum Development', 'Communication', 'Bloom Taxonomy'],
        starter_template: { title: 'OBE Lesson Plan Template', description: 'Standard university lesson plan document aligned with UGC/NAAC guidelines.', free_alternative: 'Free downloadable document template', url: 'https://careergps.local/templates/lesson-plan.docx' },
        reflection_prompts: ['How did you ensure the active learning segment engages quiet students?', 'Which Bloom taxonomy level does your primary objective target?'],
        next_step: 'Advance to Level 2: Design a multi-week course sequence with grading rubrics and sample teaching materials.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 2 — Course Module Sequence, Grading Rubric & Sample Teaching Materials',
        difficulty_level: 2,
        difficulty_label: 'Practical',
        tier: 2,
        project_type: 'academic',
        estimated_effort: '2-3 weeks (20 hours)',
        estimated_hours: '20',
        brief: 'Develop a comprehensive 4-week undergraduate course sequence complete with lecture slide materials, reading guides, and an analytic assessment grading rubric.',
        problem_statement: 'Vague grading criteria create grading bias, student disputes, and fail modern outcome-based assessment standards required by universities.',
        learning_objectives: ['Develop a progressive 4-week syllabus module with cumulative competencies', 'Author sample lecture presentation slides and supplementary student study guide', 'Construct an analytic 4-tier grading rubric'],
        prerequisites: ['Level 1 Outcome-Based Lesson Plan or teaching experience'],
        tasks: [
          { order: 1, title: '4-Week Syllabus Module Map', description: 'Map 12 lecture topics across 4 weeks with weekly reading assignments and milestone outcomes.', deliverable_hint: 'Module syllabus document' },
          { order: 2, title: 'Sample Teaching Slide Deck & Handout', description: 'Create a clean 15-20 slide presentation deck and a 2-page student summary handout for Week 2.', deliverable_hint: 'Slide deck PDF & Handout PDF' },
          { order: 3, title: 'Analytic Assessment Rubric Design', description: 'Build a multi-dimensional rubric for a mid-term assignment or seminar presentation.', deliverable_hint: 'Grading rubric matrix' }
        ],
        deliverables: [
          { type: 'lesson_plan', title: '4-Week Course Sequence Syllabus', description: 'Documented curriculum sequence with weekly readings and learning objectives.', format_hint: 'PDF document', required: true },
          { type: 'presentation', title: 'Lecture Slide Deck (15-20 slides)', description: 'High-quality academic lecture presentation deck.', format_hint: 'PDF slides or Google Slides link', required: true },
          { type: 'report_doc', title: 'Analytic Grading Rubric Matrix', description: 'Rubric detailing 4 performance levels across 4 evaluation criteria.', format_hint: 'PDF table or spreadsheet', required: true }
        ],
        acceptance_criteria: ['4-week syllabus shows clear pedagogical progression from foundational to analytical concepts', 'Slide deck is well-formatted, contains clear diagrams/examples, and includes citations', 'Rubric defines concrete observable behaviors for each performance tier'],
        evaluation_rubric: [{ dimension: 'Curriculum Architecture', criteria: 'Progressive, logically sequenced course design matching university standards' }, { dimension: 'Assessment Precision', criteria: 'Objective, unambiguous rubric criteria that eliminate subjective bias' }],
        skills: ['Teaching/Pedagogy', 'Curriculum Development', 'Academic Writing', 'Presentation Skills'],
        starter_template: { title: 'University Module & Rubric Scaffold', description: 'Document templates for semester module design and AAC&U VALUE rubrics.', free_alternative: 'Free templates for Google Docs and Slides', url: 'https://careergps.local/templates/academic-module.docx' },
        reflection_prompts: ['How does your rubric clearly distinguish between "Proficient" and "Exemplary" work?', 'What active learning techniques were embedded in the slide deck?'],
        next_step: 'Advance to Level 3: Assemble a complete Academic Teaching Portfolio & Research Dossier for college recruitment.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 3 — Academic Teaching Dossier, Statement of Philosophy & Research Evidence',
        difficulty_level: 3,
        difficulty_label: 'Career-Ready',
        tier: 3,
        project_type: 'academic',
        estimated_effort: '3-4 weeks (30+ hours)',
        estimated_hours: '30',
        brief: 'Build a professional Academic Teaching Portfolio containing a Statement of Teaching Philosophy, syllabus design, assessment artifacts, reflective teaching notes, and documented research publications.',
        problem_statement: 'College and university selection committees evaluate verified Academic Performance Indicator (API) evidence and pedagogical maturity before appointing faculty.',
        learning_objectives: ['Write a compelling 2-page Statement of Teaching Philosophy grounded in pedagogical theory', 'Compile representative course materials, student feedback/rubrics, and reflective practice notes', 'Structure an academic CV detailing qualifications, publications, and research contributions'],
        prerequisites: ['Master’s degree in subject discipline', 'UGC-NET / SET preparation or qualification'],
        tasks: [
          { order: 1, title: 'Author Teaching Philosophy Statement', description: 'Write a 2-page personal philosophy addressing student learning, inclusivity, and instructional methods.', deliverable_hint: 'Philosophy statement document' },
          { order: 2, title: 'Compile Academic Teaching Artifacts', description: 'Assemble your best course syllabus, sample lecture slides, assessment rubric, and assignment prompts.', deliverable_hint: 'Course artifacts dossier' },
          { order: 3, title: 'Research Profile & Scholarly Publications Summary', description: 'Document peer-reviewed publications, conference proceedings, or dissertation research synopsis.', deliverable_hint: 'Scholarly publications list' },
          { order: 4, title: 'Reflective Teaching Practice Notes & Academic CV', description: 'Write reflections on classroom challenges and format an official university-compliant academic CV.', deliverable_hint: 'Reflective notes and Academic CV' }
        ],
        deliverables: [
          { type: 'report_doc', title: 'Academic Teaching Portfolio & Dossier (Complete PDF)', description: 'Comprehensive digital dossier compiling philosophy, syllabi, sample materials, and reflection.', format_hint: 'Consolidated PDF dossier link', required: true },
          { type: 'presentation', title: 'Recorded Mock Lecture or Presentation Slides', description: 'Link to a 15-minute recorded lecture demonstration or presentation deck.', format_hint: 'Video link or PDF slides', required: true },
          { type: 'report_doc', title: 'Academic CV & Publications List', description: 'Formatted academic curriculum vitae highlighting qualifications and research contributions.', format_hint: 'Academic CV PDF', required: true }
        ],
        acceptance_criteria: ['Teaching philosophy articulates concrete classroom methods rather than generic clichés', 'Dossier contains verified lesson materials, assessment rubrics, and reflective teaching notes', 'Academic CV follows standard format documenting qualifying degrees and NET/Ph.D. status', 'Note clearly explains that formal statutory qualifications are mandatory alongside portfolio work'],
        evaluation_rubric: [{ dimension: 'Academic Maturity', criteria: 'Thoughtful, evidence-grounded teaching philosophy and rigorous course designs' }, { dimension: 'Scholarly Integrity', criteria: 'Accurate publication citations and clear compliance with recruitment guidelines' }],
        skills: ['Teaching/Pedagogy', 'Academic Writing', 'Research Methodology', 'Presentation Skills', 'Communication'],
        starter_template: { title: 'Academic Dossier Portfolio Scaffold', description: 'Standard Higher Education faculty recruitment dossier structure.', free_alternative: 'Free templates formatted to university standards', url: 'https://careergps.local/templates/faculty-dossier.docx' },
        reflection_prompts: ['How has your teaching approach evolved when handling diverse student learning speeds?', 'How do you connect your research discipline directly to undergraduate classroom examples?'],
        next_step: 'Capstone completed! Feature this teaching dossier prominently in your CareerGPS Portfolio.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      }
    ];
  }

  // 4. Geography / GIS Analyst / Remote Sensing / Urban Planning
  if (domainId === 'geography_gis_environment' || norm.includes('gis') || norm.includes('geography') || norm.includes('geospatial') || norm.includes('cartograph') || norm.includes('spatial')) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Level 1 — Publication-Quality Thematic Map & Vector Cartography in QGIS',
        difficulty_level: 1,
        difficulty_label: 'Starter',
        tier: 1,
        project_type: 'geospatial',
        estimated_effort: '1 week (8-10 hours)',
        estimated_hours: '8-10',
        brief: 'Acquire open municipal or census boundary data, clean attribute tables, perform coordinate reference system (CRS) reprojection, and produce a publication-grade thematic choropleth map in QGIS.',
        problem_statement: 'Geospatial analyses fail to communicate findings when cartographers use unprojected coordinates, distorted color scales, or omit standard cartographic elements (scale, north arrow, data source).',
        learning_objectives: ['Handle vector spatial datasets (GeoJSON/Shapefile) and reproject to appropriate local UTM CRS', 'Clean tabular attribute data and join demographic counts to administrative polygons', 'Apply cartographic best practices (ColorBrewer ramps, visual hierarchy, legend) to export print-ready PDF maps'],
        prerequisites: ['Basic computer literacy and open-source QGIS installed'],
        tasks: [
          { order: 1, title: 'Data Acquisition & Attribute Cleaning', description: 'Download open administrative boundaries and demographic census data; verify geometries and resolve invalid nodes.', deliverable_hint: 'Cleaned GeoJSON dataset' },
          { order: 2, title: 'Spatial Join & Choropleth Classification', description: 'Join census tabular fields to spatial polygons; classify data using Natural Breaks (Jenks) or Quantiles in QGIS.', deliverable_hint: 'Classified QGIS project (.qgz)' },
          { order: 3, title: 'Print Layout Composition & Export', description: 'Design map layout in QGIS Layout Manager with dynamic scale bar, north arrow, data citation, and export 300 DPI PDF.', deliverable_hint: 'Publication-quality map PDF' }
        ],
        deliverables: [
          { type: 'report_doc', title: 'Publication-Quality Thematic Map PDF (300 DPI)', description: 'Full print-ready cartographic layout meeting standard publishing guidelines.', format_hint: 'PDF map export', required: true },
          { type: 'dataset', title: 'Cleaned GeoPackage / Spatial Dataset', description: 'Vector spatial file with joined attributes and verified spatial CRS metadata.', format_hint: 'GeoPackage (.gpkg) file', required: true }
        ],
        acceptance_criteria: ['Map includes scale bar, north arrow, title, legend, and data source citations', 'Coordinates use appropriate local projected coordinate system (e.g. UTM) rather than unprojected WGS84 degrees', 'Choropleth color scheme is colorblind-safe and logically classified'],
        evaluation_rubric: [{ dimension: 'Cartographic Design', criteria: 'Visual hierarchy, typography, balanced layout, and color harmony' }, { dimension: 'Geospatial Accuracy', criteria: 'Correct CRS projection, geometry validity, and sound classification methodology' }],
        skills: ['QGIS / ArcGIS', 'Cartography & Map Design', 'Spatial Data Analysis', 'Coordinate Reference Systems (CRS)'],
        starter_template: { title: 'QGIS Thematic Map Layout Template', description: 'Pre-configured QGIS A4 print composer layout with dynamic metadata blocks.', free_alternative: '100% free with open-source QGIS and open government data', url: 'https://qgis.org' },
        reflection_prompts: ['Why did you choose Natural Breaks (Jenks) over Equal Interval classification?', 'How does reprojection from EPSG:4326 to a local UTM zone prevent shape distortion?'],
        next_step: 'Advance to Level 2: Execute a multi-criteria GIS suitability analysis with raster reclassification.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 2 — Multi-Criteria GIS Suitability Analysis & Spatial Buffer Modeling',
        difficulty_level: 2,
        difficulty_label: 'Practical',
        tier: 2,
        project_type: 'geospatial',
        estimated_effort: '2-3 weeks (20 hours)',
        estimated_hours: '20',
        brief: 'Execute an end-to-end multi-criteria site suitability analysis for urban infrastructure or ecological conservation using weighted overlay, spatial buffers, slope rasters, and distance grids in QGIS.',
        problem_statement: 'Infrastructure site selection often causes environmental degradation or budget overrun when spatial constraints (flood risk, slope, protected zones, transit distance) are evaluated intuitively rather than with objective multi-criteria spatial modeling.',
        learning_objectives: ['Generate digital elevation model (DEM) derivatives (slope, aspect) and euclidean distance rasters', 'Perform multi-criteria raster reclassification and Weighted Raster Overlay (WRO) analysis', 'Author a spatial methodology report with constraint tables, weight sensitivity notes, and final recommendations'],
        prerequisites: ['Level 1 Thematic Map or basic QGIS vector analysis'],
        tasks: [
          { order: 1, title: 'Criteria Definition & Spatial Layer Assembly', description: 'Define 4 spatial criteria (e.g., distance to transit, slope < 15%, outside flood zone) and collect input rasters and vectors.', deliverable_hint: 'Criteria matrix table' },
          { order: 2, title: 'Proximity Buffers & Raster Reclassification', description: 'Generate euclidean distance grids and reclassify all raster criteria into standardized 1-5 suitability scales.', deliverable_hint: 'Reclassified raster layers' },
          { order: 3, title: 'Weighted Raster Overlay & Candidate Filtering', description: 'Apply Analytical Hierarchy Process (AHP) weights using QGIS Raster Calculator; extract top candidate parcels.', deliverable_hint: 'Suitability heatmap raster' },
          { order: 4, title: 'Spatial Report & Map Series Production', description: 'Author a 5-page planning memo documenting weight rationale, criteria maps, and ranked parcel table.', deliverable_hint: 'Methodology report PDF' }
        ],
        deliverables: [
          { type: 'report_doc', title: 'GIS Suitability Analysis & Planning Report', description: 'Comprehensive report detailing criteria weights, methodology flowchart, and candidate ranking.', format_hint: 'PDF document', required: true },
          { type: 'dataset', title: 'Suitability Analysis Raster & Vector Candidates', description: 'GeoTIFF suitability raster and GeoPackage containing top-ranked candidate parcels.', format_hint: 'GeoTIFF / GeoPackage archive', required: true }
        ],
        acceptance_criteria: ['Report outlines clear AHP or pairwise criteria weights totaling 100%', 'Exclusion masks (e.g. water bodies, restricted zones) strictly filter out unsuitable areas', 'Final candidate parcel recommendations include area metrics (hectares) and spatial coordinates'],
        evaluation_rubric: [{ dimension: 'Spatial Modeling Rigor', criteria: 'Methodologically sound raster algebra, standardized scales, and criteria justification' }, { dimension: 'Analytical Reporting', criteria: 'Clear planning recommendations supported by maps, charts, and sensitivity discussions' }],
        skills: ['Spatial Data Analysis', 'QGIS / ArcGIS', 'Raster Modeling & Surface Analysis', 'Multi-Criteria Evaluation (MCE)'],
        starter_template: { title: 'GIS Multi-Criteria Suitability Workflow Scaffold', description: 'Step-by-step QGIS graphical modeler script and criteria weighting spreadsheet.', free_alternative: '100% free with QGIS and SRTM open elevation data', url: 'https://careergps.local/templates/gis-suitability.xlsx' },
        reflection_prompts: ['How did varying criterion weights in your sensitivity analysis shift the top candidate locations?', 'What real-world ground conditions might challenge the model’s top recommendation?'],
        next_step: 'Advance to Level 3: Deliver an end-to-end satellite remote sensing and spatial PostGIS case study.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 3 — Satellite Remote Sensing, Spatial SQL & Interactive Web-GIS Portfolio Case Study',
        difficulty_level: 3,
        difficulty_label: 'Career-Ready',
        tier: 3,
        project_type: 'geospatial',
        estimated_effort: '3-4 weeks (35+ hours)',
        estimated_hours: '35',
        brief: 'Conduct an end-to-end geospatial case study integrating Sentinel-2 multispectral satellite imagery, a PostGIS spatial SQL database, and an interactive web map.',
        problem_statement: 'Environmental agencies and spatial consultancies need temporal monitoring and scalable spatial query capabilities rather than static desktop files.',
        learning_objectives: ['Acquire and process multispectral Sentinel-2 imagery to compute temporal vegetation (NDVI) change', 'Load, index, and query spatial geometry in PostgreSQL using PostGIS and spatial SQL', 'Publish interactive web-GIS maps using Leaflet.js or MapLibre'],
        prerequisites: ['Level 2 GIS Suitability Analysis', 'Basic SQL knowledge'],
        tasks: [
          { order: 1, title: 'Satellite Imagery Acquisition & NDVI Processing', description: 'Download 2 temporal Sentinel-2 scenes; calculate NDVI index and difference map.', deliverable_hint: 'NDVI change raster' },
          { order: 2, title: 'PostGIS Spatial Database Modeling & Querying', description: 'Load spatial data into PostgreSQL PostGIS; write spatial queries (ST_Intersects, ST_DWithin).', deliverable_hint: 'SQL script with spatial queries' },
          { order: 3, title: 'Interactive Web-GIS Viewer Build', description: 'Create interactive Leaflet.js or MapLibre web map hosting GeoJSON layers with popups.', deliverable_hint: 'Web map on GitHub Pages' },
          { order: 4, title: 'Full Case Study & Portfolio Assembly', description: 'Compile comprehensive case study detailing findings, SQL code, and live map.', deliverable_hint: 'Published case study & repo' }
        ],
        deliverables: [
          { type: 'live_demo', title: 'Interactive Web-GIS Map URL', description: 'Live web map on GitHub Pages showing layers and popups.', format_hint: 'Live web map URL', required: true },
          { type: 'code_repo', title: 'PostGIS SQL & Web-GIS Repository', description: 'GitHub repository with spatial SQL scripts and web map code.', format_hint: 'GitHub URL', required: true },
          { type: 'report_doc', title: 'Geospatial Case Study Document', description: 'Full case study report with maps, methodology, and recommendations.', format_hint: 'PDF document', required: true }
        ],
        acceptance_criteria: ['Satellite analysis includes multi-temporal comparison with quantified area change', 'PostGIS queries demonstrate spatial indexing (GiST) and spatial joins', 'Interactive web map responds quickly and supports layer toggles'],
        evaluation_rubric: [{ dimension: 'Remote Sensing & PostGIS', criteria: 'Mastery of satellite spectral analysis and relational spatial SQL' }, { dimension: 'Web-GIS Presentation', criteria: 'Clean, interactive web mapping delivery' }],
        skills: ['Remote Sensing & Satellite Imagery', 'Spatial SQL & PostGIS', 'Spatial Data Analysis', 'QGIS / ArcGIS'],
        starter_template: { title: 'Geospatial Portfolio Scaffold', description: 'GitHub Pages template with Leaflet.js and sample PostGIS SQL schema.', free_alternative: '100% free with Copernicus Sentinel browser and local PostgreSQL/PostGIS', url: 'https://browser.dataspace.copernicus.eu' },
        reflection_prompts: ['How did cloud cover and seasonal atmospheric moisture affect satellite surface reflectance?', 'What performance advantages did PostGIS spatial indexing provide over shapefiles?'],
        next_step: 'Capstone completed! Feature this project in your CareerGPS Portfolio.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      }
    ];
  }

  // 5. Marketing / Communications / SEO / Content
  if (domainId === 'marketing_communications' || norm.includes('market') || norm.includes('advertising') || norm.includes('copywrit') || norm.includes('public relations') || norm.includes('brand')) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Level 1 — Comprehensive Campaign Brief for a Targeted Audience',
        difficulty_level: 1,
        difficulty_label: 'Starter',
        tier: 1,
        project_type: 'marketing',
        estimated_effort: '1 week (6-8 hours)',
        estimated_hours: '6-8',
        brief: 'Create an actionable campaign brief defining target customer personas, key value propositions, tone of voice, promotional channels, and measurable KPIs for a product launch.',
        problem_statement: 'Marketing campaigns burn budget without generating leads when creative teams operate without a clear brief defining target audience pain points and success metrics.',
        learning_objectives: ['Define a detailed buyer persona with demographics, goals, and pain points', 'Establish core value propositions and brand messaging hierarchy', 'Specify channel allocation and quantifiable campaign metrics (CTR, CPL, ROAS)'],
        prerequisites: ['Basic marketing concepts and business communication'],
        tasks: [
          { order: 1, title: 'Customer Persona Profile', description: 'Develop target persona detailing motivations, pain points, and media habits.', deliverable_hint: 'Persona summary sheet' },
          { order: 2, title: 'Core Messaging & Creative Angle', description: 'Author headline hook, 3 key messaging pillars, and primary call-to-action.', deliverable_hint: 'Messaging hierarchy table' },
          { order: 3, title: 'Channel Selection & KPI Matrix', description: 'Select 3 marketing channels and define target benchmarks (impressions, conversion rate, CPL).', deliverable_hint: 'Completed campaign brief PDF' }
        ],
        deliverables: [
          { type: 'report_doc', title: 'Campaign Brief Document', description: 'Structured 3-page campaign brief document ready for creative execution.', format_hint: 'PDF document or Google Doc', required: true }
        ],
        acceptance_criteria: ['Brief clearly defines specific target persona rather than generic everyone audience', 'Value proposition directly addresses a documented customer pain point', 'KPIs include realistic target numerical benchmarks rather than vague goals'],
        evaluation_rubric: [{ dimension: 'Audience Insight', criteria: 'Demonstrates sharp understanding of customer behavior and pain points' }, { dimension: 'Strategic Clarity', criteria: 'Clear channel rationale and concrete measurable performance indicators' }],
        skills: ['Campaign Management', 'Audience Segmentation', 'Content Marketing', 'Branding'],
        starter_template: { title: 'Industry Standard Campaign Brief Template', description: 'Campaign brief template used by marketing agencies.', free_alternative: '100% free with Google Docs', url: 'https://careergps.local/templates/campaign-brief.docx' },
        reflection_prompts: ['Why did you choose these specific marketing channels for this persona?', 'What single message is most likely to trigger customer action?'],
        next_step: 'Advance to Level 2: Develop a multi-channel campaign with creative content samples.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 2 — Multi-Channel Digital Campaign with Creative Assets & Channel Matrix',
        difficulty_level: 2,
        difficulty_label: 'Practical',
        tier: 2,
        project_type: 'marketing',
        estimated_effort: '2-3 weeks (20 hours)',
        estimated_hours: '20',
        brief: 'Develop an integrated marketing campaign complete with sample ad copy, email nurture sequence, social media creative specifications, and an audience segmentation matrix.',
        problem_statement: 'Inconsistent messaging across email, social, and search channels confuses potential customers and lowers conversion rates.',
        learning_objectives: ['Author high-converting ad copy and social media creative briefs across platforms', 'Write a 3-part email nurture sequence with subject line A/B test hypotheses', 'Map audience segments to specific channel touchpoints throughout the buyer journey'],
        prerequisites: ['Level 1 Campaign Brief or marketing copywriting familiarity'],
        tasks: [
          { order: 1, title: 'Audience Segmentation & Journey Map', description: 'Segment audience into Top/Middle/Bottom of funnel cohorts with tailored touchpoints.', deliverable_hint: 'Funnel journey map' },
          { order: 2, title: 'Social & Search Ad Copy Portfolio', description: 'Write 6 ad variations across Meta and Google Search with headlines and descriptions.', deliverable_hint: 'Ad copy spreadsheet' },
          { order: 3, title: 'Email Nurture Sequence Design', description: 'Draft a 3-email sequence (Welcome, Value/Proof, Offer) with subject lines.', deliverable_hint: 'Email campaign drafts' },
          { order: 4, title: 'Measurement & A/B Testing Plan', description: 'Outline 2 A/B tests with stated hypotheses, testing variables, and success metrics.', deliverable_hint: 'A/B testing protocol' }
        ],
        deliverables: [
          { type: 'report_doc', title: 'Integrated Campaign Package', description: 'Document containing funnel strategy, ad copy, email sequence, and testing plan.', format_hint: 'PDF document or presentation', required: true },
          { type: 'design_work', title: 'Creative Asset Mockups', description: 'Figma link or image exports showing ad creative layout and visual branding.', format_hint: 'Figma link or PDF visual deck', required: true }
        ],
        acceptance_criteria: ['Messaging maintains consistent brand voice across all ad and email touchpoints', 'Email sequence includes clear calls-to-action and mobile-friendly formatting', 'A/B testing plans isolate single variables to yield statistically valid conclusions'],
        evaluation_rubric: [{ dimension: 'Copywriting Quality', criteria: 'Persuasive, engaging copy adhering to platform character limits and best practices' }, { dimension: 'Channel Strategy', criteria: 'Well-reasoned funnel progression and rigorous A/B testing methodology' }],
        skills: ['Content Marketing', 'Email Marketing', 'Social Media Marketing', 'Audience Segmentation'],
        starter_template: { title: 'Multi-Channel Campaign Asset Scaffold', description: 'Canva / Figma ad templates and email sequence structure.', free_alternative: '100% free with Canva Free tier and Google Docs', url: 'https://canva.com' },
        reflection_prompts: ['How did your ad copy change between cold prospects and warm retargeting audiences?', 'What was your rationale for the email sequence timing?'],
        next_step: 'Advance to Level 3: Deliver a comprehensive marketing case study with strategy, analytics design, and outcomes.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 3 — End-to-End Marketing Strategy & Growth Case Study',
        difficulty_level: 3,
        difficulty_label: 'Career-Ready',
        tier: 3,
        project_type: 'marketing',
        estimated_effort: '3-4 weeks (30+ hours)',
        estimated_hours: '30',
        brief: 'Produce a comprehensive marketing case study analyzing market positioning, attribution modeling, budget allocation, conversion funnels, and verified lessons learned.',
        problem_statement: 'Employers look beyond vanity impressions; they want growth marketers who understand customer acquisition cost (CAC), lifetime value (LTV), and full-funnel attribution.',
        learning_objectives: ['Design an omni-channel growth strategy with detailed budget allocation and expected ROI', 'Set up web analytics tracking architecture (GA4 event taxonomy, UTM governance)', 'Document realistic campaign performance, conversion bottlenecks, and strategic lessons learned'],
        prerequisites: ['Level 2 Multi-Channel Campaign', 'Understanding of digital advertising metrics and analytics'],
        tasks: [
          { order: 1, title: 'Market Landscape & Competitive Audit', description: 'Analyze 3 competitors, pricing models, content gaps, and unique positioning opportunities.', deliverable_hint: 'Competitive matrix' },
          { order: 2, title: 'Full-Funnel Growth Strategy & Budget', description: 'Map budget distribution across paid, organic, referral channels with projected CAC and ROAS.', deliverable_hint: 'Budget & ROI projection model' },
          { order: 3, title: 'Analytics Tracking & UTM Governance Framework', description: 'Design event taxonomy for GA4 (page views, button clicks, lead submissions) and naming conventions.', deliverable_hint: 'Analytics taxonomy document' },
          { order: 4, title: 'Comprehensive Strategy Presentation & Case Study', description: 'Assemble executive presentation deck detailing campaign design, analysis, limitations, and lessons.', deliverable_hint: 'Slide deck and written case study' }
        ],
        deliverables: [
          { type: 'presentation', title: 'Executive Marketing Strategy Presentation', description: 'Slide deck walking through market analysis, creative assets, and numbers.', format_hint: 'Slide deck PDF link', required: true },
          { type: 'report_doc', title: 'Complete Marketing Case Study Document', description: 'Detailed case study report covering positioning, budget models, analytics setup, and lessons.', format_hint: 'Comprehensive PDF report', required: true }
        ],
        acceptance_criteria: ['Strategy includes realistic budget breakdown with transparent financial assumptions', 'Analytics measurement framework demonstrates clean event tracking without metric vanity', 'Case study candidly identifies risks, conversion friction points, and optimization remedies'],
        evaluation_rubric: [{ dimension: 'Strategic Acumen', criteria: 'Sound understanding of customer acquisition unit economics (CAC, LTV, conversion rates)' }, { dimension: 'Data-Driven Marketing', criteria: 'Rigorous tracking design, realistic attribution reasoning, and honest post-mortem analysis' }],
        skills: ['Marketing Analytics', 'Campaign Management', 'Conversion Rate Optimization', 'Web Analytics'],
        starter_template: { title: 'Growth Marketing Case Study Template', description: 'Agency-grade deck format for marketing case study presentations.', free_alternative: 'Free templates for Google Slides and Sheets', url: 'https://careergps.local/templates/marketing-case-study.pptx' },
        reflection_prompts: ['What was the weakest link in your conversion funnel, and how would you fix it?', 'Why is relying solely on last-click attribution misleading?'],
        next_step: 'Capstone completed! Feature this project in your CareerGPS Portfolio.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      }
    ];
  }

  // 6a. Accounting / Bookkeeping / Audit (Dedicated for Accountant)
  if (norm.includes('account') || norm.includes('bookkeep') || norm.includes('tax consultant')) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Level 1 — Double-Entry Bookkeeping Ledger, Bank Reconciliation & Trial Balance Workbook',
        difficulty_level: 1,
        difficulty_label: 'Starter',
        tier: 1,
        project_type: 'business_finance',
        estimated_effort: '1 week (8-10 hours)',
        estimated_hours: '8-10',
        brief: 'Set up a standardized 5-category chart of accounts for a small enterprise, record 20 realistic dual-entry debit and credit journal transactions in a general ledger, perform an end-of-month bank statement reconciliation with adjusting entries, and compile a verified working trial balance spreadsheet.',
        problem_statement: 'Small businesses face cash-flow blindness and tax penalties when ledger transactions lack double-entry integrity and bank accounts remain unreconciled.',
        learning_objectives: [
          'Structure a chart of accounts across Assets, Liabilities, Equity, Revenue, and Expenses',
          'Post dual-entry general journal entries enforcing the fundamental accounting equation (Assets = Liabilities + Equity)',
          'Reconcile book cash balances against bank statements, identifying outstanding checks, bank charges, and timing differences'
        ],
        prerequisites: ['Foundational understanding of debit and credit principles and spreadsheet literacy'],
        tasks: [
          { order: 1, title: 'Chart of Accounts & General Journal Setup', description: 'Design standardized account numbers and record 20 transaction entries with dates, references, and debits/credits.', deliverable_hint: 'General journal workbook tab' },
          { order: 2, title: 'Bank Reconciliation & Adjusting Entries', description: 'Reconcile ledger cash balance with bank statement and post adjusting journal entries for bank fees and interest.', deliverable_hint: 'Bank reconciliation schedule' },
          { order: 3, title: 'Working Trial Balance Compilation', description: 'Aggregate ending balances into Debit and Credit columns, verify mathematical equality, and draft reconciliation notes.', deliverable_hint: 'Balanced trial balance spreadsheet' }
        ],
        deliverables: [
          { type: 'dataset', title: 'General Ledger & Bank Reconciliation Workbook (.xlsx)', description: 'Excel or Sheets workbook with dynamic formulas verifying debits equal credits and bank reconciliation schedule.', format_hint: 'Excel spreadsheet or Google Sheets link', required: true },
          { type: 'report_doc', title: 'Accounting Reconciliation & Internal Controls Memo', description: 'Memorandum documenting adjusting entries, reconciliation variance analysis, and cash control observations.', format_hint: 'PDF memorandum document', required: true }
        ],
        acceptance_criteria: [
          'Every transaction strictly adheres to double-entry accounting with equal total debits and credits',
          'Bank reconciliation isolates uncredited deposits, unpresented checks, and bank charges without plugs',
          'Trial balance sums match perfectly without manual balancing overrides'
        ],
        evaluation_rubric: [
          { dimension: 'Accounting Accuracy', criteria: 'Rigorous application of GAAP debit/credit rules and accurate ledger posting' },
          { dimension: 'Reconciliation Rigor', criteria: 'Methodical isolation of timing variances and thorough adjusting documentation' }
        ],
        skills: ['Double-Entry Accounting', 'Bank Reconciliation', 'General Ledger', 'Financial Records', 'Excel / Spreadsheets'],
        starter_template: { title: 'General Ledger & Reconciliation Scaffold', description: 'Excel accounting workbook template with pre-built trial balance checks.', free_alternative: '100% free with Google Sheets or LibreOffice Calc', url: 'https://careergps.local/templates' },
        reflection_prompts: [
          'What adjusting entry was most critical to reconciling the true cash balance at month-end?',
          'How does dual-entry bookkeeping prevent undetected fraud or arithmetic errors?'
        ],
        next_step: 'Advance to Level 2: Prepare full financial statements with variance analysis and internal controls audit.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 2 — Financial Statements Preparation, Ratio Analysis & Internal Controls Audit Memo',
        difficulty_level: 2,
        difficulty_label: 'Practical',
        tier: 2,
        project_type: 'business_finance',
        estimated_effort: '2-3 weeks (20 hours)',
        estimated_hours: '20',
        brief: 'Generate full multi-period financial statements (Balance Sheet, Income Statement, Statement of Cash Flows) linking directly to an adjusted trial balance, calculate key liquidity, solvency, and profitability ratios, and author an executive internal controls audit memo evaluating segregation of duties.',
        problem_statement: 'Management and financial institutions reject unaudited bookkeeping records when statements lack formal multi-period comparative formats, accrual adjustments, and operational variance analysis.',
        learning_objectives: [
          'Formulate classified Balance Sheets and multi-step Income Statements under accrual accounting',
          'Construct indirect Cash Flow Statements reconciling net income to operational cash generation',
          'Analyze liquidity (Current, Quick), leverage (Debt-to-Equity), and efficiency metrics across comparative fiscal periods'
        ],
        prerequisites: ['Level 1 Bookkeeping Ledger or intermediate corporate accounting knowledge'],
        tasks: [
          { order: 1, title: 'Multi-Step Financial Statements Generation', description: 'Build dynamically linked Balance Sheet, Income Statement, and Retained Earnings schedules.', deliverable_hint: 'Financial statements workbook' },
          { order: 2, title: 'Cash Flow Statement (Indirect Method)', description: 'Model operating, investing, and financing cash flows adjusting for depreciation, working capital, and debt servicing.', deliverable_hint: 'Cash flow schedule' },
          { order: 3, title: 'Financial Ratio & Variance Analysis', description: 'Calculate 8 core financial ratios and compute period-over-period horizontal and vertical percentage variances.', deliverable_hint: 'Ratio analysis dashboard tab' },
          { order: 4, title: 'Internal Controls & Governance Audit Memo', description: 'Audit procure-to-pay and payroll cycles for segregation of duties risks and draft mitigation controls.', deliverable_hint: 'Internal controls audit memo PDF' }
        ],
        deliverables: [
          { type: 'dataset', title: 'Comprehensive Financial Statements & Ratio Workbook (.xlsx)', description: 'Multi-tab spreadsheet with dynamic three-statement linkage, ratio formulas, and variance charts.', format_hint: 'Excel spreadsheet or Google Sheets link', required: true },
          { type: 'report_doc', title: 'Financial Variance & Internal Controls Audit Report', description: 'Formal report interpreting ratio trends, operational risks, inventory discrepancies, and control remedies.', format_hint: 'PDF report document', required: true }
        ],
        acceptance_criteria: [
          'Balance Sheet balances across all periods with assets equaling liabilities plus shareholder equity',
          'Cash Flow Statement ending cash matches the Balance Sheet cash account exactly',
          'Internal controls memo details concrete dual-authorization and segregation-of-duties recommendations'
        ],
        evaluation_rubric: [
          { dimension: 'Financial Reporting Rigor', criteria: 'Clean three-statement integration adhering to standard GAAP presentation' },
          { dimension: 'Audit & Analytical Insight', criteria: 'Incisive variance interpretation and robust internal control recommendations' }
        ],
        skills: ['Financial Statements', 'Ratio Analysis', 'Variance Analysis', 'Internal Controls', 'Corporate Accounting', 'Excel / Financial Modeling'],
        starter_template: { title: 'Three-Statement Financial Model Scaffold', description: 'Standard accounting template with integrated Balance Sheet, P&L, and Cash Flow schedules.', free_alternative: '100% free with Google Sheets', url: 'https://careergps.local/templates' },
        reflection_prompts: [
          'Why did operational cash flow diverge from net accrual profit during the comparative quarter?',
          'What vulnerability in the procure-to-pay workflow posed the highest risk of unauthorized disbursement?'
        ],
        next_step: 'Advance to Level 3: Deliver a comprehensive corporate financial audit, tax compliance, and board advisory capstone.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 3 — Corporate Financial Audit Capstone, Statutory Tax Compliance & Advisory Report',
        difficulty_level: 3,
        difficulty_label: 'Career-Ready',
        tier: 3,
        project_type: 'business_finance',
        estimated_effort: '3-4 weeks (35+ hours)',
        estimated_hours: '35',
        brief: 'Execute a comprehensive simulated corporate financial audit engagement: formulate audit planning materiality, execute substantive tests on revenue recognition and accounts receivable aging, calculate corporate income tax reconciliations (book vs taxable income), and author a Board Audit Committee presentation deck.',
        problem_statement: 'Corporate boards and investors require independent financial verification and tax compliance rigor to prevent material misstatements, fraud, and regulatory sanctions.',
        learning_objectives: [
          'Establish audit risk matrices, planning materiality thresholds, and substantive testing sample plans',
          'Execute audit tests on revenue recognition timing, bad debt provisions, and inventory cut-offs',
          'Calculate corporate tax adjustments (permanent vs temporary book-to-tax timing differences and deferred tax)',
          'Present independent audit findings and strategic governance improvements to executive leadership'
        ],
        prerequisites: ['Level 2 Financial Statements Preparation', 'Auditing standards and corporate taxation familiarity'],
        tasks: [
          { order: 1, title: 'Audit Planning & Materiality Matrix', description: 'Determine benchmark materiality, evaluate fraud risks, and document audit engagement scope.', deliverable_hint: 'Audit planning memorandum' },
          { order: 2, title: 'Substantive Audit Testing & Aging Analysis', description: 'Perform substantive audit testing on accounts receivable aging, unrecorded liabilities, and cut-off dates.', deliverable_hint: 'Audit working papers & test schedules' },
          { order: 3, title: 'Statutory Corporate Tax Reconciliation', description: 'Model permanent and temporary book-to-tax differences, depreciation adjustments, and deferred tax assets/liabilities.', deliverable_hint: 'Tax reconciliation schedule' },
          { order: 4, title: 'Board Audit Committee Presentation Deck & Report', description: 'Author independent audit findings report and compile a 12-slide Board presentation deck.', deliverable_hint: 'Board presentation deck & audit report' }
        ],
        deliverables: [
          { type: 'report_doc', title: 'Comprehensive Financial Audit Working Papers & Dossier', description: 'Professional audit engagement report with materiality calculations, test sampling notes, and tax reconciliation.', format_hint: 'PDF audit dossier', required: true },
          { type: 'presentation', title: 'Board Audit Committee Executive Presentation Deck', description: 'Executive slide deck presenting key audit findings, control deficiencies, financial health metrics, and statutory tax positions.', format_hint: 'Slide deck PDF or presentation link', required: true }
        ],
        acceptance_criteria: [
          'Working papers provide clear audit trail with sample testing methodology and documented evidence',
          'Tax reconciliation clearly distinguishes permanent differences from timing differences affecting deferred tax',
          'Presentation deck conveys technical audit findings in clear executive language suitable for directors'
        ],
        evaluation_rubric: [
          { dimension: 'Auditing Rigor', criteria: 'Methodical risk assessment, sound materiality thresholds, and thorough substantive testing' },
          { dimension: 'Executive Advisory Leadership', criteria: 'Clear, authoritative communication of financial risks and regulatory compliance' }
        ],
        skills: ['Financial Auditing', 'Tax Compliance', 'GAAP / IFRS', 'Financial Due Diligence', 'Risk Governance', 'Accountancy'],
        starter_template: { title: 'Corporate Audit Engagement & Board Deck Scaffold', description: 'Professional audit workpaper template and executive slide deck framework.', free_alternative: 'Free downloadable accounting templates', url: 'https://careergps.local/templates' },
        reflection_prompts: [
          'How did you evaluate whether an accounts receivable variance represented an isolated error or systemic fraud?',
          'What statutory tax timing difference had the greatest impact on deferred tax balances?'
        ],
        next_step: 'Capstone completed! Feature this Accounting & Audit engagement in your CareerGPS Portfolio.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      }
    ];
  }

  // 6. Business / Finance / Operations
  if (domainId === 'business_finance_operations' || norm.includes('business') || norm.includes('finance') || (norm.includes('analyst') && !norm.includes('data'))) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Level 1 — Business Scenario Analysis and Executive Memo',
        difficulty_level: 1,
        difficulty_label: 'Starter',
        tier: 1,
        project_type: 'business_finance',
        estimated_effort: '1 week (8-10 hours)',
        estimated_hours: '8-10',
        brief: 'Analyse a small business operational scenario, evaluate workflow bottlenecks, and prepare a concise executive recommendation memo with documented assumptions.',
        problem_statement: 'Small enterprises leak revenue through disorganized workflow handoffs and unclear departmental metrics.',
        learning_objectives: ['Map existing business processes using workflow diagrams', 'Identify operational friction points and cost leakages', 'Author a concise executive memo with prioritized recommendations'],
        prerequisites: ['Basic business understanding and spreadsheet literacy'],
        tasks: [
          { order: 1, title: 'Process Workflow Mapping', description: 'Map the current-state workflow from customer request to fulfillment.', deliverable_hint: 'Process flow diagram' },
          { order: 2, title: 'Bottleneck Identification and Impact Calculation', description: 'Calculate hours lost and financial cost of delays.', deliverable_hint: 'Quantified impact spreadsheet' },
          { order: 3, title: 'Executive Recommendation Memo', description: 'Formulate 3 actionable steps with expected savings.', deliverable_hint: '2-page memo document' }
        ],
        deliverables: [
          { type: 'report_doc', title: 'Executive Recommendation Memo', description: 'Concise memo outlining process findings and financial impact.', format_hint: 'PDF memo document', required: true },
          { type: 'architecture', title: 'Current vs Future Process Flow Diagram', description: 'Visual workflow map comparing current state to proposed state.', format_hint: 'PDF or image diagram', required: true }
        ],
        acceptance_criteria: ['Process flow diagram clearly distinguishes roles and sequential handoffs', 'Recommendations include quantified financial or operational impact estimates', 'Documented assumptions are clearly stated without hiding uncertainty'],
        evaluation_rubric: [{ dimension: 'Business Insight', criteria: 'Root-cause analysis rather than superficial observation' }, { dimension: 'Executive Clarity', criteria: 'Concise, professional presentation suitable for leadership' }],
        skills: ['Business Analysis', 'Reporting', 'Problem Solving', 'Process Improvement'],
        starter_template: { title: 'Business Analysis Memo Template', description: 'Standard management consulting memo format.', free_alternative: 'Google Docs template', url: 'https://careergps.local/templates/ba-memo.docx' },
        reflection_prompts: ['What unexpected bottleneck emerged when mapping the workflow?', 'How did you validate your financial assumptions?'],
        next_step: 'Advance to Level 2: Build a financial or operational analysis with documented assumptions.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 2 — Operational and Financial Model with Documented Assumptions',
        difficulty_level: 2,
        difficulty_label: 'Practical',
        tier: 2,
        project_type: 'business_finance',
        estimated_effort: '2-3 weeks (20 hours)',
        estimated_hours: '20',
        brief: 'Produce a dynamic operational and financial model evaluating business expansion or automation investment with sensitivity scenarios (Best, Base, Worst).',
        problem_statement: 'Capital investments fail when models lack dynamic sensitivity testing and rely on single-point optimistic assumptions.',
        learning_objectives: ['Build dynamic 3-statement financial or operational models in Excel', 'Perform sensitivity analysis across pricing, cost, and volume variables', 'Document all underlying assumptions, sources, and limitation boundaries'],
        prerequisites: ['Level 1 Business Memo or intermediate spreadsheet modeling'],
        tasks: [
          { order: 1, title: 'Model Architecture and Assumption Sheet', description: 'Establish dynamic input drivers separated from calculated outputs.', deliverable_hint: 'Input assumption tab' },
          { order: 2, title: 'Build 3-Year Projection Schedule', description: 'Model monthly revenues, variable costs, and fixed overhead.', deliverable_hint: 'Financial projection model' },
          { order: 3, title: 'Sensitivity Matrix and Scenario Analysis', description: 'Build sensitivity tables testing profitability under demand fluctuations.', deliverable_hint: 'Sensitivity analysis table' },
          { order: 4, title: 'Executive Decision Brief', description: 'Synthesize findings into an investment committee brief.', deliverable_hint: 'Decision brief PDF' }
        ],
        deliverables: [
          { type: 'dataset', title: 'Dynamic Financial / Operational Model (.xlsx)', description: 'Spreadsheet with active formulas, input drivers, and sensitivity tables.', format_hint: 'Excel or Google Sheets link', required: true },
          { type: 'report_doc', title: 'Investment Committee Decision Brief', description: 'Document summarizing investment thesis, risks, and ROI timeline.', format_hint: 'PDF brief', required: true }
        ],
        acceptance_criteria: ['All formulas are dynamic and link directly to the assumption driver sheet', 'Model incorporates Best, Base, and Worst case scenario toggles', 'Breakeven point and net margin curves are documented and visually graphed'],
        evaluation_rubric: [{ dimension: 'Financial Modeling Rigor', criteria: 'Clean formula structure without hardcoded numbers in calculation cells' }, { dimension: 'Risk & Sensitivity Analysis', criteria: 'Realistic scenario stress-testing and thorough risk assessment' }],
        skills: ['Business Analysis', 'Excel / Financial Modeling', 'Data Handling', 'Financial Analysis'],
        starter_template: { title: 'Financial Modeling Starter Workbook', description: 'Excel template with dynamic sensitivity table layout.', free_alternative: 'Google Sheets financial model', url: 'https://careergps.local/templates/fin-model.xlsx' },
        reflection_prompts: ['Which variable was your model most sensitive to?', 'How would unexpected inflation alter the breakeven timeline?'],
        next_step: 'Advance to Level 3: Deliver a complete business feasibility or strategic valuation capstone.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 3 — Business Feasibility and Strategic Valuation Capstone',
        difficulty_level: 3,
        difficulty_label: 'Career-Ready',
        tier: 3,
        project_type: 'business_finance',
        estimated_effort: '3-4 weeks (35+ hours)',
        estimated_hours: '35',
        brief: 'Conduct a full commercial feasibility study for a new market entry or acquisition, including market sizing, competitor benchmarking, financial valuation, and risk governance.',
        problem_statement: 'Strategic decisions risk multimillion-dollar write-downs when organizations expand without rigorous commercial due diligence and governance.',
        learning_objectives: ['Perform top-down and bottom-up Total Addressable Market (TAM) sizing', 'Conduct DCF or multiple-based valuation with risk-adjusted hurdle rates', 'Present strategic recommendations to leadership with visual dashboards and governance limits'],
        prerequisites: ['Level 2 Financial Model', 'Corporate finance and strategy fundamentals'],
        tasks: [
          { order: 1, title: 'Market Sizing and Competitive Landscape', description: 'Size addressable market (TAM, SAM, SOM) and benchmark 4 market competitors.', deliverable_hint: 'Market sizing analysis' },
          { order: 2, title: 'Valuation and Return on Investment Schedule', description: 'Construct discounted cash flow (DCF) or payback model with hurdle rates.', deliverable_hint: 'Valuation model' },
          { order: 3, title: 'Risk Matrix and Governance Framework', description: 'Identify strategic, regulatory, and operational risks with mitigation protocols.', deliverable_hint: 'Risk matrix' },
          { order: 4, title: 'Board Presentation Deck and Full Case Study', description: 'Synthesize comprehensive case study and 12-slide board recommendation deck.', deliverable_hint: 'Slide deck and case study report' }
        ],
        deliverables: [
          { type: 'presentation', title: 'Board of Directors Presentation Deck', description: 'Executive slide deck presenting strategic case, financials, and risk mitigation.', format_hint: 'Slide deck PDF', required: true },
          { type: 'report_doc', title: 'Comprehensive Feasibility Study Report', description: 'Full consulting-style report with detailed methodology, assumptions, and limitations.', format_hint: 'PDF document or report link', required: true }
        ],
        acceptance_criteria: ['Market sizing combines credible bottom-up and top-down calculation methodologies', 'Valuation model includes clear cost of capital and discount rate justification', 'Strategic recommendations provide actionable phase-gate milestones and explicit exit criteria'],
        evaluation_rubric: [{ dimension: 'Strategic Depth', criteria: 'Rigorous market sizing, competitive positioning, and financial valuation' }, { dimension: 'Executive Decision-Making', criteria: 'Compelling board deck that balances growth ambition with prudent risk management' }],
        skills: ['Business Analysis', 'Financial Modeling', 'Data Visualisation', 'Reporting', 'Critical Thinking'],
        starter_template: { title: 'Strategic Feasibility Study Template', description: 'Management consulting case study and slide deck framework.', free_alternative: 'Free Google Slides and Docs templates', url: 'https://careergps.local/templates/feasibility-study.pptx' },
        reflection_prompts: ['What regulatory or competitive hurdle posed the biggest threat to profitability?', 'How did you determine the appropriate discount rate?'],
        next_step: 'Capstone completed! Feature this project in your CareerGPS Portfolio.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      }
    ];
  }

  // 7. Healthcare / Nursing / Public Health
  if (domainId === 'healthcare_medicine' || norm.includes('nurse') || norm.includes('nursing') || norm.includes('doctor') || norm.includes('health') || norm.includes('clinical') || norm.includes('medical')) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Level 1 — Clinical Patient-Safety Protocol & Handover SOP Simulation',
        difficulty_level: 1,
        difficulty_label: 'Starter',
        tier: 1,
        project_type: 'healthcare_medicine',
        estimated_effort: '1 week (8-10 hours)',
        estimated_hours: '8-10',
        brief: 'Develop a structured clinical handover standard operating procedure (SBAR model) and patient-safety checklist simulation for inpatient shift transitions.',
        problem_statement: 'Communication breakdowns during clinical handovers represent one of the leading root causes of preventable medical errors and delayed patient interventions.',
        learning_objectives: ['Apply the SBAR (Situation-Background-Assessment-Recommendation) clinical communication framework', 'Design a standardized shift handover checklist incorporating critical medication reconciliation', 'Document non-identifiable clinical simulation notes adhering strictly to patient confidentiality regulations'],
        prerequisites: ['Foundational nursing/clinical education or allied health coursework'],
        tasks: [
          { order: 1, title: 'Handover Framework & Risk Audit', description: 'Review clinical communication failure points and establish SBAR structure.', deliverable_hint: 'Risk audit summary' },
          { order: 2, title: 'Standardized Handover Protocol & Checklist', description: 'Draft comprehensive handover SOP with critical patient status indicators.', deliverable_hint: 'SBAR checklist SOP' },
          { order: 3, title: 'Simulated Patient Transition Case Note', description: 'Write 2 anonymized handover vignettes demonstrating correct protocol execution.', deliverable_hint: 'Simulated case vignettes' }
        ],
        deliverables: [
          { type: 'report_doc', title: 'Clinical Handover Protocol & SBAR Checklist SOP', description: 'Detailed Standard Operating Procedure for nursing shift handovers.', format_hint: 'PDF document', required: true },
          { type: 'checklist', title: 'Patient Safety & Medication Verification Checklist', description: 'Operational checklist covering patient identity, allergies, and scheduled infusions.', format_hint: 'PDF checklist', required: true }
        ],
        acceptance_criteria: ['Checklist adheres strictly to the SBAR clinical framework', 'Contains explicit verification steps for high-alert medications and patient identification', 'Explicitly disclaims that this simulated exercise is for educational demonstration and does not substitute for licensed clinical training'],
        evaluation_rubric: [{ dimension: 'Clinical Communication Rigor', criteria: 'Structured, objective information flow adhering to recognized patient safety guidelines' }, { dimension: 'Patient Confidentiality & Ethics', criteria: 'Strict adherence to de-identification and privacy compliance standards' }],
        skills: ['Patient Safety', 'Clinical Documentation', 'SBAR Protocol', 'Healthcare Quality Standards'],
        starter_template: { title: 'SBAR Handover Template', description: 'Clinical handover protocol based on WHO patient safety standards.', free_alternative: 'Free downloadable clinical template', url: 'https://careergps.local/templates/sbar-sop.docx' },
        reflection_prompts: ['How does structured SBAR formatting reduce cognitive fatigue during emergency handovers?', 'What escalation trigger would prompt immediate senior clinician involvement?'],
        next_step: 'Advance to Level 2: Design a comprehensive nursing care plan and infection control quality audit.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 2 — Evidence-Based Nursing Care Plan & Infection Control Quality Audit',
        difficulty_level: 2,
        difficulty_label: 'Practical',
        tier: 2,
        project_type: 'healthcare_medicine',
        estimated_effort: '2-3 weeks (20 hours)',
        estimated_hours: '20',
        brief: 'Design a comprehensive evidence-based nursing care plan for a complex chronic comorbidity scenario, alongside an infection prevention and control (IPC) quality improvement audit.',
        problem_statement: 'Hospital-acquired infections and fragmented care plans increase length of stay and readmission rates for vulnerable patients.',
        learning_objectives: ['Formulate NANDA-I nursing diagnoses, realistic measurable outcomes (NOC), and interventions (NIC)', 'Conduct a simulated clinical audit of hand hygiene and aseptic technique compliance', 'Draft quality improvement recommendations with timeline and staff training goals'],
        prerequisites: ['Level 1 Clinical Handover Protocol or nursing clinical rotations'],
        tasks: [
          { order: 1, title: 'Comprehensive Care Plan Formulation', description: 'Develop 5-part care plan: Assessment, Diagnosis, Planning, Implementation, Evaluation.', deliverable_hint: 'Nursing care plan matrix' },
          { order: 2, title: 'Infection Prevention Quality Audit Design', description: 'Formulate audit criteria tracking central line or surgical site care adherence.', deliverable_hint: 'Audit tool spreadsheet' },
          { order: 3, title: 'Quality Improvement (QI) Strategy Report', description: 'Synthesize audit findings and outline PDCA (Plan-Do-Check-Act) quality cycle.', deliverable_hint: 'QI report document' }
        ],
        deliverables: [
          { type: 'report_doc', title: 'Evidence-Based Nursing Care Plan Document', description: 'Detailed clinical care plan with rationale, pharmacological monitoring, and patient teaching notes.', format_hint: 'PDF document', required: true },
          { type: 'report_doc', title: 'Infection Control Quality Improvement Audit Report', description: 'Clinical audit documenting compliance metrics, risk points, and corrective action plans.', format_hint: 'PDF report', required: true }
        ],
        acceptance_criteria: ['Care plan includes evidence-based clinical rationales for each proposed intervention', 'Audit tool incorporates measurable compliance metrics and root cause analysis', 'Emphasizes interprofessional collaboration with physicians, pharmacists, and dieticians'],
        evaluation_rubric: [{ dimension: 'Evidence-Based Practice', criteria: 'Rigorous application of clinical guidelines and nursing process frameworks' }, { dimension: 'Quality Improvement', criteria: 'Actionable audit methodology and realistic corrective recommendations' }],
        skills: ['Nursing Assessment', 'Infection Control', 'Clinical Care Planning', 'Quality Improvement'],
        starter_template: { title: 'Nursing Care Plan & Audit Scaffold', description: 'Standard hospital nursing care plan and infection control audit format.', free_alternative: 'Free downloadable templates', url: 'https://careergps.local/templates/care-plan.docx' },
        reflection_prompts: ['How did you prioritize competing nursing diagnoses in a patient with multiple comorbidities?', 'What behavioral barriers exist to 100% hand hygiene compliance among ward staff?'],
        next_step: 'Advance to Level 3: Deliver a clinical governance case study and public health community intervention proposal.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 3 — Healthcare Clinical Governance Case Study & Community Health Initiative',
        difficulty_level: 3,
        difficulty_label: 'Career-Ready',
        tier: 3,
        project_type: 'healthcare_medicine',
        estimated_effort: '3-4 weeks (35+ hours)',
        estimated_hours: '35',
        brief: 'Produce a comprehensive clinical governance case study and community preventive health initiative addressing maternal/neonatal outcomes or non-communicable disease prevention.',
        problem_statement: 'Healthcare systems require clinical leaders who understand healthcare policy, clinical risk mitigation, resource allocation, and preventive community engagement.',
        learning_objectives: ['Analyze clinical governance pillars: patient safety, clinical audit, risk management, and staff education', 'Design a community preventive health intervention with measurable screening and educational milestones', 'Present strategic healthcare recommendations to simulated hospital administration'],
        prerequisites: ['Level 2 Nursing Care Plan or clinical healthcare qualification'],
        tasks: [
          { order: 1, title: 'Clinical Governance Incident & Risk Review', description: 'Analyze a simulated near-miss clinical event using root-cause analysis (Fishbone diagram).', deliverable_hint: 'Root cause analysis document' },
          { order: 2, title: 'Community Health Program Charter', description: 'Develop preventive outreach plan with target demographics, screening protocols, and referral workflows.', deliverable_hint: 'Program charter PDF' },
          { order: 3, title: 'Executive Healthcare Presentation Deck', description: 'Prepare 12-slide presentation deck presenting governance findings and public health impact.', deliverable_hint: 'Slide deck presentation' }
        ],
        deliverables: [
          { type: 'report_doc', title: 'Comprehensive Clinical Governance Case Study', description: 'Full investigation report covering risk analysis, policy recommendations, and clinical audit schedule.', format_hint: 'PDF document', required: true },
          { type: 'presentation', title: 'Hospital Executive Leadership Presentation Deck', description: 'Slide deck synthesizing incident review, governance enhancements, and community program ROI.', format_hint: 'Slide deck PDF', required: true }
        ],
        acceptance_criteria: ['Root cause analysis identifies systemic vulnerabilities rather than assigning individual blame', 'Community intervention defines clear epidemiological metrics and realistic community partnerships', 'Explicit note clarifies that clinical licensing, statutory nursing registration, and supervision are mandatory in practice'],
        evaluation_rubric: [{ dimension: 'Clinical Leadership', criteria: 'System-level perspective on patient safety, ethics, and healthcare management' }, { dimension: 'Governance & Public Health', criteria: 'Rigorous risk analysis and practical community health promotion strategies' }],
        skills: ['Clinical Governance', 'Public Health', 'Risk Management', 'Healthcare Leadership', 'Communication'],
        starter_template: { title: 'Clinical Governance & QI Framework', description: 'Hospital quality improvement and clinical incident investigation framework.', free_alternative: 'Free downloadable healthcare governance templates', url: 'https://careergps.local/templates/clinical-governance.pptx' },
        reflection_prompts: ['How does a "just culture" encourage transparent incident reporting among healthcare workers?', 'What community determinants of health were most influential in your outreach plan?'],
        next_step: 'Capstone completed! Feature this healthcare case study in your CareerGPS Portfolio.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      }
    ];
  }

  // 7b. Data Engineering & Pipeline Architecture (Dedicated for Data Engineer)
  if (domainId === 'data_engineering' || norm.includes('data engineer') || norm.includes('etl') || norm.includes('data pipeline') || norm.includes('lakehouse') || norm.includes('data warehouse')) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Level 1 — Batch Data Ingestion, Schema Validation & Quality Audit Pipeline',
        difficulty_level: 1,
        difficulty_label: 'Starter',
        tier: 1,
        project_type: 'data_engineering',
        estimated_effort: '1 week (8-10 hours)',
        estimated_hours: '8-10',
        brief: 'Build a production-grade automated Python batch ingestion script that reads multi-format source data (CSV/JSON), parses and validates records against strict schemas using Pydantic, handles corrupted records gracefully in a dead-letter log, and outputs sanitized datasets to PostgreSQL or SQLite with an automated Data Quality Audit report.',
        problem_statement: 'Downstream data pipelines and analytics crash when raw source feeds suffer silent schema drift, corrupted timestamps, missing mandatory fields, and untyped nulls.',
        learning_objectives: [
          'Design resilient batch data ingestion workflows parsing semi-structured and delimited feeds',
          'Implement schema enforcement, field type coercion, and boundary validations using Pydantic',
          'Isolate invalid records into a dead-letter quarantine file and generate an automated data quality scorecard'
        ],
        prerequisites: ['Basic Python programming', 'Relational database concepts (SQL)'],
        tasks: [
          { order: 1, title: 'Source Data Profiling & Schema Definition', description: 'Inspect raw data files, catalog anomaly types (nulls, malformed dates, outliers), and author strict Pydantic models for validation.', deliverable_hint: 'Data schema and profiling script' },
          { order: 2, title: 'Resilient Ingestion & Dead-Letter Quarantine', description: 'Implement ingestion pipeline in Python handling file parsing, type coercion, deduplication, and dead-letter quarantine routing.', deliverable_hint: 'Python ingestion module' },
          { order: 3, title: 'Database Staging & Automated Quality Audit', description: 'Load cleaned records into relational staging tables and execute automated row count and uniqueness assertions.', deliverable_hint: 'Database load script and Quality Audit Report PDF' }
        ],
        deliverables: [
          { type: 'code_repo', title: 'Data Ingestion & Schema Validation Repository', description: 'GitHub repository with modular Python ingestion script, Pydantic schemas, and unit tests.', format_hint: 'GitHub URL', required: true },
          { type: 'report_doc', title: 'Data Quality & Validation Audit Report', description: 'Document detailing data profiling findings, schema rules, error quarantine metrics, and execution logs.', format_hint: 'PDF document or Markdown report', required: true }
        ],
        acceptance_criteria: [
          'Ingestion script runs end-to-end without unhandled crashes when fed malformed inputs',
          'Malformed or corrupt records are routed to a structured dead-letter quarantine log rather than silently dropped',
          'Data Quality Audit report quantifies pass/fail rates, null percentages, and primary key uniqueness'
        ],
        evaluation_rubric: [
          { dimension: 'Pipeline Robustness', criteria: 'Error boundary handling, defensive parsing, and strict schema validation' },
          { dimension: 'Data Integrity', criteria: 'Zero unlogged data loss and thorough assertion test coverage' }
        ],
        skills: ['Python', 'SQL', 'Data Pipelines (ETL/ELT)', 'Data Quality & Validation', 'Schema Design', 'Data Engineering'],
        starter_template: { title: 'Python Data Pipeline Starter Scaffold', description: 'Modular Python template with Pydantic schemas, SQLite loader, and test suite.', free_alternative: '100% free with open-source Python and SQLite/PostgreSQL', url: 'https://careergps.local/templates' },
        reflection_prompts: [
          'How did your pipeline handle schema drift or unexpected data types without terminating the entire batch?',
          'What automated quality threshold would prompt an immediate pipeline alert in production?'
        ],
        next_step: 'Advance to Level 2: Build a multi-source relational ETL pipeline with PostgreSQL, Airflow, and incremental UPSERT loading.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 2 — Multi-Source Relational ETL Pipeline with PostgreSQL, Airflow & Incremental Loading',
        difficulty_level: 2,
        difficulty_label: 'Practical',
        tier: 2,
        project_type: 'data_engineering',
        estimated_effort: '2-3 weeks (20 hours)',
        estimated_hours: '20',
        brief: 'Architect and deploy an end-to-end relational ETL pipeline orchestrating data extraction from multiple REST APIs and transactional databases, transforming data into a star-schema data warehouse in PostgreSQL, implementing incremental idempotent UPSERT logic, and scheduling tasks with Airflow or Prefect.',
        problem_statement: 'Analytics queries drag production databases to a halt when organizations lack a dedicated data warehouse with dimensional modeling, incremental update mechanisms, and automated dependency orchestration.',
        learning_objectives: [
          'Design normalized dimensional schemas (Star Schema: Fact and Dimension tables with surrogate keys)',
          'Implement idempotent incremental extraction and merge logic using SQL transactions and audit timestamps',
          'Author and schedule DAG workflows with Airflow or Prefect featuring retries, alerting, and backfill capabilities'
        ],
        prerequisites: ['Level 1 Data Ingestion Pipeline or Python & PostgreSQL experience'],
        tasks: [
          { order: 1, title: 'Star Schema Warehouse Architecture', description: 'Design dimension tables (dim_users, dim_dates) and fact tables (fact_events) with indexes and foreign keys in PostgreSQL.', deliverable_hint: 'Warehouse DDL migration files' },
          { order: 2, title: 'Multi-Source Extract & Transform Workers', description: 'Extract data from external API and CSV sources, perform business transformations, and compute surrogate hash keys.', deliverable_hint: 'Transform worker modules' },
          { order: 3, title: 'Idempotent Incremental UPSERT Loader', description: 'Implement SQL merge/UPSERT operations updating modified records without duplicating existing dimensional rows.', deliverable_hint: 'Incremental load SQL logic' },
          { order: 4, title: 'Orchestration DAG & End-to-End Testing', description: 'Configure Airflow/Prefect DAG with task dependencies, retry intervals, and automated end-to-end integration tests.', deliverable_hint: 'DAG script & test execution logs' }
        ],
        deliverables: [
          { type: 'code_repo', title: 'ETL Pipeline & Warehouse Codebase Repository', description: 'GitHub repo containing Docker Compose environment, Airflow DAGs, SQL migrations, and Python transforms.', format_hint: 'GitHub URL', required: true },
          { type: 'architecture', title: 'Data Lineage & Warehouse Architecture Diagram', description: 'Visual architectural diagram documenting data flows, entity-relationship model, and SLA schedules.', format_hint: 'PDF or PNG architecture diagram', required: true }
        ],
        acceptance_criteria: [
          'Warehouse schema follows sound dimensional modeling principles with primary, foreign, and surrogate keys',
          'Pipeline is completely idempotent: running the DAG multiple times produces identical target table states',
          'Integration tests verify that interrupted loads roll back cleanly without leaving partial transactions'
        ],
        evaluation_rubric: [
          { dimension: 'Dimensional Modeling', criteria: 'Clean separation of facts and dimensions with appropriate granularity and indexing' },
          { dimension: 'Orchestration & Reliability', criteria: 'Robust DAG scheduling, retry policies, and automated failure notifications' }
        ],
        skills: ['PostgreSQL', 'Airflow / Orchestration', 'Data Modeling', 'ETL Pipelines', 'Python', 'Data Warehousing'],
        starter_template: { title: 'Dockerized Airflow & Postgres Warehouse Scaffold', description: 'Docker Compose configuration running Airflow and PostgreSQL with sample seed datasets.', free_alternative: '100% free with local Docker Compose', url: 'https://careergps.local/templates' },
        reflection_prompts: [
          'How did you guarantee that reprocessing a previous day’s partition did not duplicate fact table records?',
          'What trade-offs did you evaluate between surrogate integer keys versus natural composite keys in your dimension tables?'
        ],
        next_step: 'Advance to Level 3: Deliver a scalable distributed lakehouse architecture capstone with dbt, Parquet, and automated CI/CD testing.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 3 — Scalable Distributed Lakehouse Architecture Capstone with dbt, Parquet & Automated Testing',
        difficulty_level: 3,
        difficulty_label: 'Career-Ready',
        tier: 3,
        project_type: 'data_engineering',
        estimated_effort: '3-4 weeks (35+ hours)',
        estimated_hours: '35',
        brief: 'Design and deploy a modern enterprise Data Lakehouse platform processing high-volume event telemetry into partitioned columnar Parquet storage using DuckDB or PySpark, implementing modular transformation layers with dbt, enforcing automated data quality contracts, and delivering an executive performance benchmarking case study.',
        problem_statement: 'Modern enterprises struggle with ballooning cloud warehouse compute bills and slow analytical query speeds when storing raw unstructured logs in rigid row-based transactional databases without columnar partitioning and automated data governance.',
        learning_objectives: [
          'Architect a medallion lakehouse pattern (Bronze raw, Silver curated, Gold analytics marts) in columnar Parquet format',
          'Build modular, tested transformation pipelines using dbt (staging models, ephemeral models, materializations)',
          'Implement CI/CD data testing pipelines verifying schema stability, freshness SLAs, and anomaly detection'
        ],
        prerequisites: ['Level 2 Multi-Source ETL Pipeline', 'Advanced SQL, Python, and data systems architecture'],
        tasks: [
          { order: 1, title: 'Lakehouse Storage & Partitioning Architecture', description: 'Ingest semi-structured streaming/batch logs and store in partitioned Snappy-compressed Parquet files using DuckDB/PySpark.', deliverable_hint: 'Lakehouse ingestion engine' },
          { order: 2, title: 'Modular dbt Transformation & Mart Layer', description: 'Author dbt models transforming Bronze tables into Silver and Gold business marts with documentation and generic tests.', deliverable_hint: 'dbt project with models and yml tests' },
          { order: 3, title: 'Automated CI/CD Data Quality Contracts', description: 'Configure automated pre-commit and CI test suites (dbt test) blocking breaking schema changes.', deliverable_hint: 'CI/CD pipeline workflow & test logs' },
          { order: 4, title: 'Performance Benchmarking & Architecture Case Study', description: 'Benchmark analytical queries across partitioned columnar storage vs unindexed raw storage; author executive engineering memo.', deliverable_hint: 'Benchmark report & Case Study PDF' }
        ],
        deliverables: [
          { type: 'code_repo', title: 'Lakehouse & dbt Pipeline Repository', description: 'Complete GitHub repository with dbt models, PySpark/DuckDB scripts, Docker containerization, and CI actions.', format_hint: 'GitHub URL', required: true },
          { type: 'report_doc', title: 'Lakehouse Architecture & Query Performance Case Study', description: 'Comprehensive engineering report documenting medallion architecture, partitioning strategy, cost-per-query benchmarks, and disaster recovery SLA.', format_hint: 'PDF document or technical paper', required: true }
        ],
        acceptance_criteria: [
          'Lakehouse cleanly partitions datasets by date/category, achieving demonstrable query performance gains over raw scans',
          'dbt models pass all schema tests (not_null, unique, accepted_values, relationships) without warnings',
          'Case study clearly articulates trade-offs between compute latency, storage compression, and cloud operational expenditure'
        ],
        evaluation_rubric: [
          { dimension: 'Modern Data Stack Mastery', criteria: 'Idiomatic dbt modeling, sound columnar lakehouse partitioning, and containerized deployment' },
          { dimension: 'Data Governance & Engineering Rigor', criteria: 'Automated test coverage, strict schema enforcement, and clear technical communication' }
        ],
        skills: ['dbt', 'PySpark / DuckDB', 'Columnar Storage (Parquet)', 'Data Lakehouse', 'Data Governance & CI/CD', 'SQL', 'Data Engineering'],
        starter_template: { title: 'Modern Data Stack Lakehouse Scaffold', description: 'dbt + DuckDB + Parquet repository template with automated GitHub Actions CI testing.', free_alternative: '100% free with local DuckDB and open-source dbt-core', url: 'https://careergps.local/templates' },
        reflection_prompts: [
          'How did your partitioning key choice affect query pruning efficiency and small-file fragmentation?',
          'What automated test in your dbt suite prevented the most critical data degradation scenario?'
        ],
        next_step: 'Capstone completed! Feature this Data Engineering platform in your CareerGPS Portfolio.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      }
    ];
  }

  // 8. Data / AI / Machine Learning
  if (domainId === 'data_ai' || norm.includes('data') || norm.includes('machine learning') || norm.includes('ai engineer') || norm.includes('intelligence')) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Level 1 — Exploratory Data Analysis & Interactive Visual Dashboard',
        difficulty_level: 1,
        difficulty_label: 'Starter',
        tier: 1,
        project_type: 'data_ai',
        estimated_effort: '1 week (8-10 hours)',
        estimated_hours: '8-10',
        brief: 'Clean and explore a multi-variable real-world open dataset with Pandas, detect outliers and missing values, and construct an interactive exploratory dashboard.',
        problem_statement: 'Data teams waste weeks building models when underlying datasets contain duplicate entries, severe skew, and unaddressed missing data.',
        learning_objectives: ['Perform systematic data hygiene (null values, categorical encoding, outlier treatment)', 'Conduct statistical hypothesis testing and bivariate correlation analysis', 'Build an interactive exploratory dashboard in Streamlit or Tableau'],
        prerequisites: ['Basic Python or SQL knowledge'],
        tasks: [
          { order: 1, title: 'Data Cleaning & Hygiene Pipeline', description: 'Inspect distributions, handle missing values, and remove duplicate records.', deliverable_hint: 'Jupyter notebook / script' },
          { order: 2, title: 'Statistical Analysis & Visualizations', description: 'Generate correlation matrices, distribution plots, and group aggregations.', deliverable_hint: 'Analysis plots' },
          { order: 3, title: 'Dashboard Deployment & Insights Summary', description: 'Assemble clean dashboard with filter widgets and write executive takeaways.', deliverable_hint: 'Streamlit app / Tableau workbook' }
        ],
        deliverables: [
          { type: 'code_repo', title: 'Data Analysis Notebook & Source Repository', description: 'GitHub repo with commented analysis code and data dictionary.', format_hint: 'GitHub URL', required: true },
          { type: 'report_doc', title: 'Executive Data Insights Memo', description: 'Summary report highlighting 4 key findings, data limitations, and business implications.', format_hint: 'PDF document', required: true }
        ],
        acceptance_criteria: ['Cleaning script runs end-to-end without errors on raw dataset', 'Visualizations include clear axes, titles, units, and non-distorting scales', 'Analysis documents potential data collection biases and edge cases'],
        evaluation_rubric: [{ dimension: 'Data Rigor', criteria: 'Methodical data hygiene, appropriate statistical measures, and clear documentation' }, { dimension: 'Insight Communication', criteria: 'Actionable visual delivery translating raw numbers into practical insights' }],
        skills: ['Python', 'Pandas', 'Data Visualisation', 'Exploratory Data Analysis', 'SQL'],
        starter_template: { title: 'EDA & Dashboard Starter Scaffold', description: 'Python Jupyter notebook template with clean Pandas pipeline structure.', free_alternative: '100% free with open tools (Jupyter, Python, Streamlit)', url: 'https://github.com/streamlit/streamlit' },
        reflection_prompts: ['What unexpected outlier pattern surprised you during initial inspection?', 'How did your choice of imputation method affect feature correlations?'],
        next_step: 'Advance to Level 2: Build and evaluate a production-grade predictive machine learning model.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 2 — Supervised Machine Learning Pipeline with Cross-Validation & Model Evaluation',
        difficulty_level: 2,
        difficulty_label: 'Practical',
        tier: 2,
        project_type: 'data_ai',
        estimated_effort: '2-3 weeks (20 hours)',
        estimated_hours: '20',
        brief: 'Build an end-to-end predictive machine learning pipeline with feature engineering, cross-validation, hyperparameter tuning, model explainability (SHAP), and an inference API.',
        problem_statement: 'Models that perform well on simple train/test splits often degrade in production due to data leakage, class imbalance, and uninterpretable feature weights.',
        learning_objectives: ['Prevent data leakage using strict cross-validation pipelines (scikit-learn)', 'Benchmark multiple algorithms (LightGBM, Random Forest, Logistic Regression)', 'Explain individual and global predictions using SHAP feature importances'],
        prerequisites: ['Level 1 Data Analysis or Python scikit-learn experience'],
        tasks: [
          { order: 1, title: 'Feature Engineering & Preprocessing Pipeline', description: 'Build scikit-learn Pipeline with scalers, encoders, and imbalance handling.', deliverable_hint: 'Pipeline script' },
          { order: 2, title: 'Model Training, Tuning & Benchmark', description: 'Train candidate models with stratified K-fold cross-validation and hyperparameter search.', deliverable_hint: 'Model benchmark table' },
          { order: 3, title: 'Model Explainability & Error Analysis', description: 'Generate SHAP summary plots and inspect misclassified test samples.', deliverable_hint: 'SHAP analysis notebook' },
          { order: 4, title: 'Inference REST API Service', description: 'Wrap best model in a FastAPI endpoint with payload validation and automated unit test.', deliverable_hint: 'FastAPI app file' }
        ],
        deliverables: [
          { type: 'code_repo', title: 'Machine Learning Pipeline & API Repository', description: 'Complete GitHub repo with training pipeline, test suite, and FastAPI server.', format_hint: 'GitHub URL', required: true },
          { type: 'report_doc', title: 'Model Card & Evaluation Case Study', description: 'Detailed model card documenting performance metrics (ROC-AUC, F1, Precision-Recall), fairness, and limitations.', format_hint: 'PDF document', required: true }
        ],
        acceptance_criteria: ['Pipeline strictly isolates preprocessing within cross-validation folds to avoid leakage', 'Evaluation compares baseline dummy model against tuned algorithms using appropriate metrics', 'Model card details intended use, limitations, and failure modes'],
        evaluation_rubric: [{ dimension: 'ML Engineering', criteria: 'Leakage-free pipeline, rigorous validation methodology, and modular code' }, { dimension: 'Explainability & Ethics', criteria: 'SHAP interpretation, fairness evaluation, and clear disclosure of model risks' }],
        skills: ['Machine Learning', 'scikit-learn', 'Feature Engineering', 'Model Evaluation', 'FastAPI'],
        starter_template: { title: 'Production ML Pipeline Scaffold', description: 'scikit-learn and FastAPI boilerplate with automated tests.', free_alternative: '100% free with local Python', url: 'https://careergps.local/templates' },
        reflection_prompts: ['Why was accuracy an insufficient evaluation metric for your dataset?', 'What trade-offs did you observe between model interpretability and raw performance?'],
        next_step: 'Advance to Level 3: Deliver a production LLM / AI system with retrieval-augmented generation and observability.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 3 — Enterprise AI / Retrieval-Augmented Generation (RAG) System Capstone',
        difficulty_level: 3,
        difficulty_label: 'Career-Ready',
        tier: 3,
        project_type: 'data_ai',
        estimated_effort: '3-4 weeks (35+ hours)',
        estimated_hours: '35',
        brief: 'Design and deploy an enterprise Retrieval-Augmented Generation (RAG) system with semantic chunking, vector indexing, reranking, automated hallucination evaluation (Ragas), and streaming UI.',
        problem_statement: 'Off-the-shelf generative AI wrappers fail in production due to hallucinations, stale knowledge, context window overflow, and lack of systematic evaluation.',
        learning_objectives: ['Implement hybrid search combining BM25 keyword matching with dense vector embeddings', 'Build an automated evaluation pipeline measuring faithfulness, answer relevancy, and context recall', 'Deploy production backend with rate limiting, telemetry, and streaming responses'],
        prerequisites: ['Level 2 Machine Learning Pipeline', 'Python async programming and vector databases'],
        tasks: [
          { order: 1, title: 'Document Ingestion & Chunking Pipeline', description: 'Process PDF/HTML documents with semantic chunking and generate vector embeddings.', deliverable_hint: 'Ingestion pipeline module' },
          { order: 2, title: 'Hybrid Retrieval & Reranker Service', description: 'Implement vector database index with cross-encoder reranking for top-K results.', deliverable_hint: 'Retrieval service' },
          { order: 3, title: 'Evaluation Framework & Benchmark Suite', description: 'Implement automated Ragas test suite evaluating 30 synthetic question/ground-truth pairs.', deliverable_hint: 'Evaluation benchmark report' },
          { order: 4, title: 'Full Application Deployment & Case Study', description: 'Containerize system with Docker Compose and publish live demo and architecture report.', deliverable_hint: 'Live demo & case study PDF' }
        ],
        deliverables: [
          { type: 'code_repo', title: 'Complete AI / RAG System Repository', description: 'GitHub repo with Docker Compose, embedding pipelines, rerankers, and tests.', format_hint: 'GitHub URL', required: true },
          { type: 'live_demo', title: 'Live Streaming AI Application Demo', description: 'Working web demo with question-answering, citation highlights, and response streaming.', format_hint: 'Web application URL', required: true },
          { type: 'report_doc', title: 'Architecture Case Study & Benchmark Report', description: 'Report detailing retrieval precision, latency benchmarks, cost analysis, and guardrails.', format_hint: 'PDF document', required: true }
        ],
        acceptance_criteria: ['System returns source citations matching retrieved context passages', 'Automated evaluation suite quantifies answer faithfulness with score above 0.85', 'Docker Compose runs locally with single command without manual configuration'],
        evaluation_rubric: [{ dimension: 'System Architecture', criteria: 'Robust hybrid retrieval, reranking, and streaming response architecture' }, { dimension: 'Evaluation & Reliability', criteria: 'Rigorous benchmark methodology and effective mitigation of hallucination risks' }],
        skills: ['Generative AI & LLMs', 'Vector Databases', 'RAG Architecture', 'System Evaluation', 'Docker', 'Python'],
        starter_template: { title: 'Production RAG System Scaffold', description: 'FastAPI, ChromaDB/pgvector, and React UI template for enterprise RAG.', free_alternative: 'Runs locally with Ollama and ChromaDB without API charges', url: 'https://careergps.local/templates' },
        reflection_prompts: ['How did adding a cross-encoder reranker impact latency versus answer quality?', 'What failure cases did your evaluation benchmark expose in the LLM’s responses?'],
        next_step: 'Capstone completed! Feature this project in your CareerGPS Portfolio.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      }
    ];
  }

  // 9. Design / Graphic Design / UI/UX
  if (domainId === 'design_creative' || norm.includes('design') || norm.includes('ui') || norm.includes('ux') || norm.includes('visual') || norm.includes('graphic')) {
    return [
      {
        id: crypto.randomUUID(),
        title: 'Level 1 — Visual Identity Design & Brand Style Guide',
        difficulty_level: 1,
        difficulty_label: 'Starter',
        tier: 1,
        project_type: 'design_creative',
        estimated_effort: '1 week (8-10 hours)',
        estimated_hours: '8-10',
        brief: 'Create a cohesive brand identity for a designated venture including primary logo mark, color system with WCAG contrast compliance, typography hierarchy, and a brand style guide.',
        problem_statement: 'Inconsistent visual branding creates customer distrust and inaccessible interfaces that fail digital readability standards.',
        learning_objectives: ['Develop a logo mark with vector precision and export formats (SVG, PNG)', 'Curate an accessible 5-color palette tested against WCAG 2.1 AA contrast ratios', 'Format a professional brand style guide outlining rules of usage and visual assets'],
        prerequisites: ['Basic design software familiarity (Figma, Illustrator, or Canva)'],
        tasks: [
          { order: 1, title: 'Concept Ideation & Moodboard', description: 'Research competitive visual landscapes and compile reference moodboards.', deliverable_hint: 'Moodboard sheet' },
          { order: 2, title: 'Logo System & Vector Drafting', description: 'Draft primary, secondary, and monochrome logo lockups in vector format.', deliverable_hint: 'Vector logo exports' },
          { order: 3, title: 'Brand Style Guide Assembly', description: 'Compile color codes, typography pairings, spacing rules, and misuse examples.', deliverable_hint: 'Brand guideline PDF' }
        ],
        deliverables: [
          { type: 'design_work', title: 'Brand Identity Style Guide (Complete PDF)', description: 'Multi-page brand manual detailing logo rules, color swatches, typography, and applications.', format_hint: 'PDF document or Figma link', required: true },
          { type: 'design_work', title: 'Vector Asset Package (.svg / .png)', description: 'Zip archive or Figma file containing vector logo marks and icon assets.', format_hint: 'Figma file link', required: true }
        ],
        acceptance_criteria: ['Color palette includes contrast ratio documentation verifying WCAG AA accessibility', 'Style guide clearly documents forbidden logo treatments and minimum clearspace rules', 'Typography hierarchy specifies font families, weights, line heights, and usage context'],
        evaluation_rubric: [{ dimension: 'Visual Aesthetics', criteria: 'Harmonious composition, balanced proportions, and cohesive brand personality' }, { dimension: 'Design Systems Rigor', criteria: 'Precise vector execution, accessibility compliance, and thorough documentation' }],
        skills: ['Brand Identity Design', 'Typography', 'Color Theory & Accessibility', 'Figma / Illustrator'],
        starter_template: { title: 'Figma Brand Guidelines Kit', description: 'Standard Figma community style guide framework with auto-layout.', free_alternative: '100% free with Figma Free tier', url: 'https://figma.com' },
        reflection_prompts: ['How did contrast testing influence your choice of primary and accent colors?', 'What brand personality traits does your typography hierarchy communicate?'],
        next_step: 'Advance to Level 2: Design an interactive mobile/web user interface case study with usability testing.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 2 — Interactive Product UI/UX Case Study with Usability Testing',
        difficulty_level: 2,
        difficulty_label: 'Practical',
        tier: 2,
        project_type: 'design_creative',
        estimated_effort: '2-3 weeks (20 hours)',
        estimated_hours: '20',
        brief: 'Execute an end-to-end user experience case study: user research, user journey maps, wireframing, high-fidelity interactive prototype in Figma, and documented usability testing with 3 users.',
        problem_statement: 'Product designs that look visually appealing frequently fail in production when user flows are confusing and untested with real people.',
        learning_objectives: ['Map user problem statements and synthesize findings into task-flow wireframes', 'Build an interactive high-fidelity clickable prototype in Figma using components and auto-layout', 'Conduct moderated usability testing, identify friction points, and iterate design based on findings'],
        prerequisites: ['Level 1 Brand Style Guide or basic Figma wireframing'],
        tasks: [
          { order: 1, title: 'User Research & Journey Flow', description: 'Interview 2 potential users and diagram current vs optimal journey flow.', deliverable_hint: 'User flow diagram' },
          { order: 2, title: 'Wireframes & Information Architecture', description: 'Design low-fidelity grayscale wireframes exploring 2 distinct navigational layouts.', deliverable_hint: 'Wireframe boards' },
          { order: 3, title: 'High-Fidelity Prototype in Figma', description: 'Build interactive clickable screens with component design tokens and micro-interactions.', deliverable_hint: 'Figma prototype link' },
          { order: 4, title: 'Usability Testing & Design Iteration', description: 'Run test sessions on 3 core tasks, log task completion rates, and implement improvements.', deliverable_hint: 'Usability findings report' }
        ],
        deliverables: [
          { type: 'design_work', title: 'Interactive Figma Prototype Link', description: 'Shareable Figma prototype URL demonstrating key task flows with active interactions.', format_hint: 'Figma prototype link', required: true },
          { type: 'report_doc', title: 'UI/UX Design Case Study & Usability Report', description: 'Full case study document detailing user research, wireframe evolution, testing data, and final UI.', format_hint: 'PDF document or Notion link', required: true }
        ],
        acceptance_criteria: ['Figma file utilizes reusable components, variants, and responsive auto-layout', 'Usability test report quantifies task completion time and quotes specific user feedback', 'Case study documents before-and-after iterations driven by empirical test findings'],
        evaluation_rubric: [{ dimension: 'Interaction Design', criteria: 'Intuitive navigation, consistent design system token usage, and delightful interaction details' }, { dimension: 'User-Centered Research', criteria: 'Sound research methodology, objective usability logging, and responsive iteration' }],
        skills: ['UI/UX Design', 'User Research', 'Wireframing & Prototyping', 'Usability Testing', 'Figma'],
        starter_template: { title: 'UI/UX Case Study Scaffold', description: 'Figma case study slide deck and user testing script template.', free_alternative: '100% free with Figma Free tier', url: 'https://figma.com' },
        reflection_prompts: ['What unexpected friction point did users encounter during testing?', 'How did user testing feedback overturn an assumption you made during wireframing?'],
        next_step: 'Advance to Level 3: Deliver a comprehensive enterprise design system and multi-platform portfolio case study.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      },
      {
        id: crypto.randomUUID(),
        title: 'Level 3 — Enterprise Design System, Multi-Platform UI & Capstone Portfolio Dossier',
        difficulty_level: 3,
        difficulty_label: 'Career-Ready',
        tier: 3,
        project_type: 'design_creative',
        estimated_effort: '3-4 weeks (35+ hours)',
        estimated_hours: '35',
        brief: 'Build a comprehensive multi-platform design system in Figma with design tokens, responsive components, accessibility documentation, and a portfolio case study website.',
        problem_statement: 'Design teams struggle to maintain visual consistency and developer handoff efficiency across web, iOS, and Android without unified design systems.',
        learning_objectives: ['Construct scalable design tokens (color, spacing, elevation, typography) in Figma variables', 'Architect 20+ atomic components with variants, states (hover, focus, disabled), and accessibility notes', 'Package work into an executive portfolio case study presenting problem, methodology, and measurable business impact'],
        prerequisites: ['Level 2 UI/UX Case Study', 'Advanced Figma component architecture'],
        tasks: [
          { order: 1, title: 'Design Token Architecture & Variables', description: 'Define semantic token layers (global, alias, component) using Figma variables.', deliverable_hint: 'Figma token architecture' },
          { order: 2, title: 'Component Library & Accessibility Specs', description: 'Build buttons, modals, form controls, navigation bars with full interactive states.', deliverable_hint: 'Component library in Figma' },
          { order: 3, title: 'Multi-Platform Implementation Mockups', description: 'Apply design system to responsive desktop and mobile screens showing real context.', deliverable_hint: 'High-fidelity mockups' },
          { order: 4, title: 'Design System Documentation & Case Study', description: 'Publish documentation detailing component anatomy, dos and don’ts, and developer specs.', deliverable_hint: 'Design system site / case study' }
        ],
        deliverables: [
          { type: 'design_work', title: 'Complete Figma Design System File Link', description: 'Comprehensive Figma library containing tokens, components, variants, and documentation.', format_hint: 'Figma file link', required: true },
          { type: 'report_doc', title: 'Design System Governance & Case Study Document', description: 'Detailed case study describing token naming conventions, component architecture, and developer handoff.', format_hint: 'PDF document or live portfolio link', required: true }
        ],
        acceptance_criteria: ['Design system includes full semantic token architecture with Figma variables', 'Every component documents interactive states and keyboard navigation focus indicators', 'Case study articulates governance model for updating components without breaking downstream products'],
        evaluation_rubric: [{ dimension: 'System Architecture', criteria: 'Sophisticated token hierarchy, variant structures, and maintainable auto-layout' }, { dimension: 'Design Leadership', criteria: 'Clear developer documentation, accessibility standards, and compelling portfolio narrative' }],
        skills: ['Design Systems', 'Design Tokens', 'Figma', 'UI/UX Design', 'Accessibility (WCAG)'],
        starter_template: { title: 'Enterprise Design System Starter Kit', description: 'Figma template configured with variable collections and documentation cards.', free_alternative: '100% free with Figma Free tier', url: 'https://figma.com' },
        reflection_prompts: ['How did semantic tokens improve design consistency across desktop and mobile?', 'What developer handoff guidelines did you formulate to ensure fidelity in code?'],
        next_step: 'Capstone completed! Feature this design system in your CareerGPS Portfolio.',
        origin: 'curated',
        verification_status: 'verified',
        is_suggested: true
      }
    ];
  }

  // 10. General Professional Fallback for any other career
  return [
    {
      id: crypto.randomUUID(),
      title: `Level 1 — Practical Baseline Deliverable for ${careerTitle}`,
      difficulty_level: 1,
      difficulty_label: 'Starter',
      tier: 1,
      project_type: 'professional_practice',
      estimated_effort: '1 week (8-10 hours)',
      estimated_hours: '8-10',
      brief: `Produce an introductory workplace artifact practicing core entry skills required for a ${careerTitle}.`,
      problem_statement: `Early-career practitioners struggle to demonstrate competence in ${careerTitle} without a concrete piece of practical work.`,
      learning_objectives: [
        `Apply foundational methods and workflows used by a ${careerTitle}`,
        'Produce a structured professional deliverable meeting industry standards',
        'Document practical problem-solving methodology and underlying assumptions'
      ],
      prerequisites: ['Basic domain orientation and foundational understanding'],
      tasks: [
        { order: 1, title: 'Scenario Definition & Scope', description: 'Select a common operational problem in this field and define parameters.', deliverable_hint: 'Scenario summary' },
        { order: 2, title: 'Deliverable Creation', description: 'Draft the practical deliverable according to professional industry standards.', deliverable_hint: 'Draft deliverable' },
        { order: 3, title: 'Review & Final Documentation', description: 'Review against quality acceptance criteria and write brief reflective notes.', deliverable_hint: 'Completed artifact' }
      ],
      deliverables: [
        { type: 'report_doc', title: `Initial Practice Deliverable for ${careerTitle}`, description: 'Documented workplace artifact demonstrating baseline competence.', format_hint: 'PDF document or repository link', required: true }
      ],
      acceptance_criteria: [
        'Deliverable addresses the stated workplace scenario clearly and systematically',
        'Work reflects standard industry formatting, documentation, and quality standards',
        'Key operational assumptions are explicitly documented'
      ],
      evaluation_rubric: [
        { dimension: 'Domain Competence', criteria: 'Accurate application of core domain techniques and knowledge' },
        { dimension: 'Professional Clarity', criteria: 'Clear, structured presentation suitable for client or employer review' }
      ],
      skills: ['Problem Solving', 'Documentation', 'Communication', 'Domain Fundamentals'],
      starter_template: { title: `${careerTitle} Starter Guide`, description: 'Structured template for developing practical deliverables.', free_alternative: '100% free with open tools', url: 'https://careergps.local/templates' },
      reflection_prompts: [
        'What was the most challenging aspect of developing this initial deliverable?',
        'What skills would you develop further in the next phase?'
      ],
      next_step: 'Advance to Level 2: Build an applied multi-skill project.',
      origin: 'curated',
      verification_status: 'verified',
      is_suggested: true
    },
    {
      id: crypto.randomUUID(),
      title: `Level 2 — Applied Professional Project for ${careerTitle}`,
      difficulty_level: 2,
      difficulty_label: 'Practical',
      tier: 2,
      project_type: 'professional_practice',
      estimated_effort: '2-3 weeks (20 hours)',
      estimated_hours: '20',
      brief: `Execute a realistic applied project combining multiple competencies for ${careerTitle} across a multi-stage scenario.`,
      problem_statement: `Employers need demonstrable evidence of combined skill application across realistic workflow scenarios in ${careerTitle}.`,
      learning_objectives: [
        `Integrate multiple core competencies required for ${careerTitle}`,
        'Solve a multi-step domain challenge with realistic workplace constraints',
        'Evaluate operational trade-offs and document quality verification findings'
      ],
      prerequisites: [`Level 1 Deliverable or foundational knowledge in ${careerTitle}`],
      tasks: [
        { order: 1, title: 'Project Scope & Requirements', description: 'Define scope, constraints, and business or operational requirements.', deliverable_hint: 'Requirements document' },
        { order: 2, title: 'Core Execution & Implementation', description: 'Execute primary project activities and build required artifacts.', deliverable_hint: 'Implementation artifacts' },
        { order: 3, title: 'Evaluation & Quality Verification', description: 'Evaluate outputs against requirements and verify quality standards.', deliverable_hint: 'Quality verification notes' }
      ],
      deliverables: [
        { type: 'report_doc', title: `Applied Project Artifact for ${careerTitle}`, description: 'Substantial practical deliverable with documented methodology and findings.', format_hint: 'PDF document or project link', required: true }
      ],
      acceptance_criteria: [
        'Project solves the stated domain problem with rigorous multi-step execution',
        'Deliverable follows industry quality, formatting, and safety standards',
        'Documentation explains methodology, trade-offs, and empirical findings'
      ],
      evaluation_rubric: [
        { dimension: 'Applied Competence', criteria: 'Effective integration of multiple domain skills and tools' },
        { dimension: 'Operational Rigor', criteria: 'Thorough testing or validation of project outputs' }
      ],
      skills: ['Critical Thinking', 'Problem Solving', 'Applied Execution', 'Project Planning'],
      starter_template: { title: 'Practical Project Framework', description: 'Step-by-step project scaffolding for applied work.', free_alternative: '100% free with open tools', url: 'https://careergps.local/templates' },
      reflection_prompts: [
        'How did combining multiple competencies alter your approach to problem-solving?',
        'What would you improve if you had more time or additional resources?'
      ],
      next_step: 'Advance to Level 3: Deliver a comprehensive career-ready capstone.',
      origin: 'curated',
      verification_status: 'verified',
      is_suggested: true
    },
    {
      id: crypto.randomUUID(),
      title: `Level 3 — Career-Ready Capstone & Portfolio Case Study for ${careerTitle}`,
      difficulty_level: 3,
      difficulty_label: 'Career-Ready',
      tier: 3,
      project_type: 'professional_practice',
      estimated_effort: '3-4 weeks (35+ hours)',
      estimated_hours: '35',
      brief: `Deliver a comprehensive professional capstone demonstrating end-to-end capability in ${careerTitle} packaged for employer and institutional review.`,
      problem_statement: `Transitioning into ${careerTitle} requires substantial demonstrable proof of capability that stands out to hiring committees and clients.`,
      learning_objectives: [
        `Demonstrate comprehensive mastery of professional ${careerTitle} workflows`,
        'Deliver production-grade, publication-grade, or executive-ready evidence',
        'Present strategic insights, operational limitations, and recommendations'
      ],
      prerequisites: [`Level 2 Project in ${careerTitle} or equivalent experience`],
      tasks: [
        { order: 1, title: 'Comprehensive Problem Definition', description: 'Formulate strategic challenge and outline end-to-end project charter.', deliverable_hint: 'Charter document' },
        { order: 2, title: 'Execution of Core Deliverables', description: 'Build, analyze, or design all required capstone outputs.', deliverable_hint: 'Primary deliverables suite' },
        { order: 3, title: 'Case Study & Executive Presentation', description: 'Author full written case study and executive presentation deck.', deliverable_hint: 'Case study & presentation deck' }
      ],
      deliverables: [
        { type: 'presentation', title: 'Executive Presentation Deck', description: 'Professional slide deck walking through approach, artifacts, and results.', format_hint: 'Slide deck PDF', required: true },
        { type: 'report_doc', title: 'Comprehensive Capstone Case Study', description: 'Detailed report covering problem, approach, deliverables, limitations, and lessons.', format_hint: 'Case study document', required: true }
      ],
      acceptance_criteria: [
        'Capstone demonstrates comprehensive professional capability matching industry standards',
        'Presents real outcomes, operational limitations, and lessons learned honestly',
        'Artifacts are packaged for employer and institutional review'
      ],
      evaluation_rubric: [
        { dimension: 'Professional Mastery', criteria: 'End-to-end execution matching industry hiring standards' },
        { dimension: 'Strategic Communication', criteria: 'Compelling presentation of findings and candid reflection on limitations' }
      ],
      skills: ['Leadership', 'Strategic Planning', 'Presentation Skills', 'Quality Assurance'],
      starter_template: { title: 'Professional Capstone Template', description: 'Portfolio case study and presentation framework.', free_alternative: '100% free with open tools', url: 'https://careergps.local/templates' },
      reflection_prompts: [
        'What were the biggest trade-offs you navigated during this project?',
        'How does this capstone demonstrate your readiness for this role?'
      ],
      next_step: 'Capstone completed! Feature this project in your CareerGPS Portfolio.',
      origin: 'curated',
      verification_status: 'verified',
      is_suggested: true
    }
  ];
}

/**
 * Keep project checklists consistent across database, AI, and curated fallback
 * sources. Older catalogue rows store tasks as strings, while newer rows use
 * task objects; callers should not need to know which source produced them.
 */
function normalizeRecommendationTasks(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.map((task, index) => {
    if (typeof task === 'string') {
      return {
        order: index + 1,
        title: task,
        description: '',
        deliverable_hint: ''
      };
    }
    if (!task || typeof task !== 'object') {
      return {
        order: index + 1,
        title: `Task ${index + 1}`,
        description: '',
        deliverable_hint: ''
      };
    }
    return {
      ...task,
      order: task.order || index + 1,
      title: task.title || task.task_name || task.name || `Task ${index + 1}`,
      description: task.description || '',
      deliverable_hint: task.deliverable_hint || ''
    };
  });
}

/**
 * Get personalized project recommendations for a career and user.
 * Prioritizes database-backed records, enriches via AI, and provides robust fallback.
 */
export async function getProjectRecommendations(arg1 = null, arg2 = {}) {
  let userId = null;
  let options = {};
  if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1)) {
    options = arg1;
    userId = options.userId || null;
  } else {
    userId = arg1;
    options = arg2 || {};
  }
  const { careerId = null, careerTitle = null, level = null } = options;
  let career = null;

  // 1. Resolve career from careerId, careerTitle, or user profile goal
  if (careerId) {
    const res = await pool.query(
      `SELECT id, title, description, qualifications, entry_routes, responsibilities 
       FROM careers WHERE id = $1`, [careerId]
    );
    if (res.rows[0]) career = res.rows[0];
  }

  if (!career && careerTitle) {
    const res = await pool.query(
      `SELECT id, title, description, qualifications, entry_routes, responsibilities 
       FROM careers WHERE title ILIKE $1 LIMIT 1`, [careerTitle]
    );
    if (res.rows[0]) career = res.rows[0];
  }

  // 2. Fetch user context (if authenticated)
  let profile = {};
  let userSkills = [];
  let completedMilestones = [];
  let existingProjects = [];

  if (userId) {
    const profRes = await pool.query(`SELECT education, experience, career_goal FROM user_profiles WHERE user_id = $1`, [userId]);
    if (profRes.rows[0]) profile = profRes.rows[0];

    // If still no career, check user's career goal
    if (!career && profile.career_goal) {
      const res = await pool.query(
        `SELECT id, title, description, qualifications, entry_routes, responsibilities 
         FROM careers WHERE title ILIKE $1 LIMIT 1`, [profile.career_goal]
      );
      if (res.rows[0]) career = res.rows[0];
    }

    const skillsRes = await pool.query(
      `SELECT s.id, s.name, us.level, us.verified, us.evidence_type 
       FROM user_skills us JOIN skills s ON s.id = us.skill_id 
       WHERE us.user_id = $1`, [userId]
    );
    userSkills = skillsRes.rows;

    const milestonesRes = await pool.query(
      `SELECT ps.title 
       FROM user_pathway_steps ups 
       JOIN pathway_steps ps ON ps.id = ups.pathway_step_id 
       JOIN user_pathways up ON up.id = ups.user_pathway_id 
       WHERE up.user_id = $1 AND ups.status = 'completed'`, [userId]
    );
    completedMilestones = milestonesRes.rows.map(r => r.title);

    const userProjectsRes = await pool.query(
      `SELECT id, project_id, title, difficulty_level, status FROM user_projects WHERE user_id = $1`, [userId]
    );
    existingProjects = userProjectsRes.rows;
  }

  const resolvedTitle = career?.title || careerTitle || profile.career_goal || 'General Professional';
  const resolvedCareerId = career?.id || careerId || null;

  // 3. Fetch canonical skills associated with this career in PostgreSQL
  let careerSkills = [];
  if (resolvedCareerId) {
    try {
      const csRes = await pool.query(
        `SELECT s.name, cs.importance 
         FROM career_skills cs 
         JOIN skills s ON s.id = cs.skill_id 
         WHERE cs.career_id = $1`, [resolvedCareerId]
      );
      careerSkills = csRes.rows;
    } catch (e) {
      logger.warn('[ProjectStudio] Error fetching career_skills:', e.message);
    }
  }

  // 4. Universal Career-Domain Classification
  const domainProfile = classifyCareerDomain(
    resolvedTitle,
    career?.description || '',
    career?.responsibilities || [],
    careerSkills
  );

  // 5. Compute personalized tier
  const tierInfo = calculateUserExperienceTier(profile, userSkills, completedMilestones, existingProjects);
  const recommendedLevel = level ? Number(level) : tierInfo.recommendedLevel;

  // 6. Query database for curated career_projects
  let rawDbProjects = [];
  if (resolvedCareerId) {
    const dbRes = await pool.query(
      `SELECT * FROM career_projects 
       WHERE career_id = $1 
       ORDER BY difficulty_level ASC`, [resolvedCareerId]
    );
    rawDbProjects = dbRes.rows;
  }

  if (rawDbProjects.length === 0) {
    const dbRes = await pool.query(
      `SELECT * FROM career_projects 
       WHERE career_title ILIKE '%' || $1 || '%' 
       ORDER BY difficulty_level ASC`, [resolvedTitle]
    );
    rawDbProjects = dbRes.rows;
  }

  // Filter database projects against domain validation rules (preventing cross-domain tech leakages)
  const validDbProjects = rawDbProjects.filter(p => {
    const val = validateProjectCandidate(p, domainProfile);
    if (!val.valid) {
      logger.warn(`[ProjectStudio] Incompatible DB project filtered out for domain ${domainProfile.id}: ${p.title} (${val.errors.join('; ')})`);
      return false;
    }
    return true;
  });

  let finalProjects = [];
  let sourceStatus = 'database';
  let rationale = `Recommended for your ${tierInfo.tier} profile (${tierInfo.totalExpYears} yrs exp, ${userSkills.length} skills). Level ${recommendedLevel} (${tierInfo.label}) is your primary focus in ${domainProfile.label}.`;

  if (validDbProjects.length >= 3) {
    sourceStatus = 'database';
    finalProjects = validDbProjects.map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      difficulty_level: p.difficulty_level,
      difficulty_label: p.difficulty_label,
      tier: p.difficulty_level,
      project_type: p.project_type,
      estimated_effort: p.estimated_effort,
      estimated_hours: (typeof p.estimated_effort === 'string' ? p.estimated_effort.replace(/[^0-9-]/g, '') : p.estimated_effort) || '8-12',
      brief: p.brief,
      problem_statement: p.problem_statement,
      learning_objectives: p.learning_objectives,
      prerequisites: p.prerequisites,
      tasks: p.tasks,
      deliverables: p.deliverables,
      acceptance_criteria: p.acceptance_criteria,
      evaluation_rubric: p.evaluation_rubric,
      skills: p.skills,
      starter_template: p.starter_template,
      reflection_prompts: p.reflection_prompts,
      next_step: p.next_step,
      origin: p.origin || 'curated',
      provenance: 'database_catalogue',
      verification_status: p.verification_status || 'verified',
      is_suggested: true
    }));
  } else {
    // 7. If database lacks valid coverage for this domain, call AI service
    const aiPayload = {
      career_id: resolvedCareerId,
      career_title: resolvedTitle,
      career_domain: domainProfile.id,
      domain_label: domainProfile.label,
      is_technical: domainProfile.isTechnical,
      occupational_responsibilities: career?.responsibilities || [],
      career_skills: careerSkills.map(s => s.name),
      current_goal: profile.career_goal || resolvedTitle,
      profile,
      user_skills: userSkills,
      skill_gaps: [],
      completed_milestones: completedMilestones,
      existing_projects: existingProjects.map(p => p.title),
      level_preference: recommendedLevel
    };

    const aiRes = await callAi('/internal/v1/projects/recommend', aiPayload);
    if (aiRes && Array.isArray(aiRes.recommended_projects) && aiRes.recommended_projects.length > 0) {
      // Validate every candidate returned by AI against domain rules
      const validatedAi = [];
      for (const p of aiRes.recommended_projects) {
        const val = validateProjectCandidate(p, domainProfile);
        if (val.valid) {
          validatedAi.push({
            ...p,
            domain: domainProfile.id,
            origin: 'ai_generated',
            provenance: 'ai_generated',
            is_suggested: true
          });
        } else {
          logger.warn(`[ProjectStudio] AI candidate rejected for domain ${domainProfile.id}: ${p.title} (${val.errors.join('; ')})`);
        }
      }

      if (validatedAi.length >= 3) {
        finalProjects = validatedAi;
        sourceStatus = aiRes.status || 'ai_generated';
        rationale = aiRes.recommendation_rationale || rationale;
      }
    }

    if (finalProjects.length === 0 && validDbProjects.length > 0) {
      finalProjects = validDbProjects.map(p => ({
        ...p,
        domain: domainProfile.id,
        origin: p.origin || 'curated',
        provenance: 'database_catalogue',
        verification_status: p.verification_status || 'verified',
        is_suggested: true
      }));
    }
  }

  // 8. Fallback if neither database nor AI service provided valid domain projects
  if (finalProjects.length === 0) {
    logger.info(`[ProjectStudio] Generating fallback domain projects for ${resolvedTitle} (${domainProfile.id})`);
    finalProjects = generateFallbackProjects(resolvedTitle, tierInfo.tier, recommendedLevel, domainProfile).map(p => ({
      ...p,
      domain: domainProfile.id,
      origin: 'curated',
      provenance: 'domain_fallback',
      is_suggested: true
    }));
    sourceStatus = 'curated';
    rationale = `Practical ${domainProfile.label} project deliverables designed for ${resolvedTitle} (${tierInfo.label} level).`;
  }

  // 9. Deduplicate candidates by normalized title
  const seenTitles = new Set();
  const dedupedProjects = [];
  for (const p of finalProjects) {
    const normT = (p.title || '').toLowerCase().trim();
    if (!seenTitles.has(normT)) {
      seenTitles.add(normT);
      dedupedProjects.push(p);
    }
  }

  // 10. Annotate projects with user's current project status (active, completed, planned)
  const annotatedProjects = dedupedProjects.map(p => {
    const userProj = existingProjects.find(up => (p.id && up.project_id === p.id) || up.title === p.title);
    const diffLevel = Number(p.difficulty_level || p.tier) || 1;
    const diffLabel = p.difficulty_label || (diffLevel === 1 ? 'Starter' : diffLevel === 2 ? 'Practical' : 'Career-Ready');
    return {
      ...p,
      tasks: normalizeRecommendationTasks(p.tasks || p.step_by_step_tasks),
      step_by_step_tasks: normalizeRecommendationTasks(p.step_by_step_tasks || p.tasks),
      id: p.id || crypto.randomUUID(),
      difficulty_level: diffLevel,
      difficulty_label: diffLabel,
      tier: diffLevel,
      domain: domainProfile.id,
      domain_label: domainProfile.label,
      provenance: p.provenance || (sourceStatus === 'database' ? 'database_catalogue' : (sourceStatus === 'ai_generated' ? 'ai_generated' : 'domain_fallback')),
      is_started: Boolean(userProj),
      user_project_id: userProj?.id || null,
      user_project_status: userProj?.status || null
    };
  });

  const levels = {
    level_1_starter: annotatedProjects.filter(p => p.difficulty_level === 1),
    level_2_practical: annotatedProjects.filter(p => p.difficulty_level === 2),
    level_3_career_ready: annotatedProjects.filter(p => p.difficulty_level === 3)
  };

  return {
    career_id: resolvedCareerId,
    career_title: resolvedTitle,
    career_domain: domainProfile.id,
    domain_label: domainProfile.label,
    is_technical: domainProfile.isTechnical,
    user_tier: tierInfo.tier,
    recommended_level: recommendedLevel,
    recommendation_rationale: rationale,
    source_status: sourceStatus,
    project_counts: {
      starter: levels.level_1_starter.length,
      practical: levels.level_2_practical.length,
      career_ready: levels.level_3_career_ready.length,
      total: annotatedProjects.length
    },
    levels,
    projects: annotatedProjects
  };
}

/**
 * Normalizes user project database records into consistent objects
 * ensuring tasks, step_by_step_tasks, tasks_progress, deliverables, and reflection
 * are always present, parsed, and never empty.
 */
export function normalizeUserProjectRow(row) {
  if (!row) return null;
  const parseJson = (val, fallback) => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'object') return val;
    try {
      const parsed = JSON.parse(val);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  let rawTasks = parseJson(row.tasks_progress, []);
  if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
    rawTasks = parseJson(row.tasks, []);
  }
  if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
    rawTasks = parseJson(row.step_by_step_tasks, []);
  }

  // If still empty, synthesize career-aware tasks so the user never sees 0/0 tasks
  if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
    const title = row.title || 'Project';
    const norm = title.toLowerCase();
    if (norm.includes('chef') || norm.includes('menu') || norm.includes('recipe') || norm.includes('culinary')) {
      rawTasks = [
        { order: 1, title: 'Menu Concept & Dietary Objective', description: 'Define dining theme, customer profile, and nutritional balance targets.', completed: false, deliverable_hint: 'Concept brief' },
        { order: 2, title: 'Recipe Standardization Sheets', description: 'Formulate 3 standardized recipe cards specifying exact weights, temperatures, and plating steps.', completed: false, deliverable_hint: 'Standardized recipe sheets' },
        { order: 3, title: 'Food Safety, Allergen & Cost Analysis', description: 'Compile HACCP food safety checklist and calculate plate portion margins.', completed: false, deliverable_hint: 'Food safety and costing workbook' }
      ];
    } else if (norm.includes('data engineer') || norm.includes('ingestion') || norm.includes('pipeline') || norm.includes('etl') || norm.includes('lakehouse')) {
      rawTasks = [
        { order: 1, title: 'Source Data Profiling & Schema Definition', description: 'Profile source datasets, detect malformed records, and define strict schemas.', completed: false, deliverable_hint: 'Schema models' },
        { order: 2, title: 'Ingestion, Transformation & Dead-Letter Pipeline', description: 'Build pipeline script parsing records, coercing datatypes, and quarantining corrupted inputs.', completed: false, deliverable_hint: 'Ingestion script' },
        { order: 3, title: 'Database Staging & Automated Quality Audit', description: 'Load cleaned records into relational/columnar storage and verify data quality assertions.', completed: false, deliverable_hint: 'Quality audit report' }
      ];
    } else if (norm.includes('gis') || norm.includes('geo') || norm.includes('spatial') || norm.includes('map')) {
      rawTasks = [
        { order: 1, title: 'Spatial Data Acquisition & Cleaning', description: 'Acquire boundary and attribute data, clean tables, and verify coordinate reference system (CRS).', completed: false, deliverable_hint: 'Cleaned GeoPackage' },
        { order: 2, title: 'Spatial Analysis & Modeling', description: 'Execute buffer analysis, spatial joins, or raster overlay classification.', completed: false, deliverable_hint: 'Spatial project files' },
        { order: 3, title: 'Cartographic Layout & Methodology Report', description: 'Compose publication-grade map layout with standard marginalia and author report.', completed: false, deliverable_hint: 'Map PDF and report' }
      ];
    } else if (norm.includes('account') || norm.includes('reconciliation') || norm.includes('financial') || norm.includes('ledger')) {
      rawTasks = [
        { order: 1, title: 'General Journal & Chart of Accounts Setup', description: 'Establish account structure and post dual debit/credit journal entries.', completed: false, deliverable_hint: 'General ledger' },
        { order: 2, title: 'Bank Reconciliation & Adjusting Entries', description: 'Reconcile cash accounts with bank statement and document adjusting entries.', completed: false, deliverable_hint: 'Reconciliation sheet' },
        { order: 3, title: 'Financial Statements & Audit Documentation', description: 'Generate trial balance, balance sheet, and write internal controls memo.', completed: false, deliverable_hint: 'Financial statements' }
      ];
    } else if (norm.includes('teach') || norm.includes('lesson') || norm.includes('curriculum') || norm.includes('pedagogy')) {
      rawTasks = [
        { order: 1, title: 'Learning Objectives & Outcome Mapping', description: 'Formulate measurable learning outcomes aligned with Bloom’s Taxonomy.', completed: false, deliverable_hint: 'Outcome matrix' },
        { order: 2, title: 'Instructional Sequence & Teaching Materials', description: 'Draft step-by-step lecture breakdown and create sample presentation slides.', completed: false, deliverable_hint: 'Lesson plan and slide deck' },
        { order: 3, title: 'Assessment Rubric & Formative Checks', description: 'Design formative assessment questions and multi-tier evaluation rubric.', completed: false, deliverable_hint: 'Grading rubric' }
      ];
    } else if (norm.includes('nurse') || norm.includes('care plan') || norm.includes('clinical') || norm.includes('sbar')) {
      rawTasks = [
        { order: 1, title: 'Clinical Scenario & Risk Assessment', description: 'Review simulated patient handover and identify critical safety indicators.', completed: false, deliverable_hint: 'Risk audit' },
        { order: 2, title: 'Standardized Protocol & Care Planning', description: 'Draft SBAR handover protocol or evidence-based nursing care plan.', completed: false, deliverable_hint: 'Care plan / SBAR SOP' },
        { order: 3, title: 'Infection Control & Patient Safety Audit', description: 'Compile quality checklist and write quality improvement recommendations.', completed: false, deliverable_hint: 'Safety checklist' }
      ];
    } else if (norm.includes('design') || norm.includes('brand') || norm.includes('figma') || norm.includes('ui')) {
      rawTasks = [
        { order: 1, title: 'Concept Ideation & Visual Research', description: 'Analyze competitive landscapes, define visual direction, and build reference moodboard.', completed: false, deliverable_hint: 'Moodboard' },
        { order: 2, title: 'Component Drafting & Prototype Construction', description: 'Draft vector assets and interactive components in Figma with auto-layout.', completed: false, deliverable_hint: 'Figma prototype' },
        { order: 3, title: 'Accessibility Audit & Style Guide Assembly', description: 'Verify WCAG color contrast and compile design system documentation.', completed: false, deliverable_hint: 'Style guide / case study' }
      ];
    } else {
      rawTasks = [
        { order: 1, title: 'Project Scope & Requirements Specification', description: 'Define operational scenario parameters, constraints, and success criteria.', completed: false, deliverable_hint: 'Scope charter' },
        { order: 2, title: 'Core Implementation & Deliverable Production', description: 'Build and format the primary workplace artifact meeting industry standards.', completed: false, deliverable_hint: 'Core artifact' },
        { order: 3, title: 'Verification, Quality Review & Documentation', description: 'Review output against acceptance criteria and document methodology and assumptions.', completed: false, deliverable_hint: 'Audit documentation' }
      ];
    }
  }

  const normalizedTasks = rawTasks.map((t, idx) => ({
    order: Number(t.order) || idx + 1,
    title: t.title || t.task_name || t.name || `Task ${idx + 1}`,
    description: t.description || '',
    deliverable_hint: t.deliverable_hint || '',
    completed: Boolean(t.completed),
    notes: t.notes || ''
  }));

  let rawDeliverables = parseJson(row.deliverables, []);
  if (!Array.isArray(rawDeliverables)) rawDeliverables = [];
  const normalizedDeliverables = rawDeliverables.map(d => ({
    id: d.id || crypto.randomUUID(),
    title: d.title || 'Project Deliverable',
    type: d.type || d.deliverable_type || 'report_doc',
    deliverable_type: d.deliverable_type || d.type || 'report_doc',
    url: d.url || d.link_url || '',
    link_url: d.link_url || d.url || '',
    notes: d.notes || '',
    format_hint: d.format_hint || '',
    description: d.description || '',
    submitted_at: d.submitted_at || null,
    required: Boolean(d.required),
    verified: Boolean(d.verified)
  }));

  const reflection = parseJson(row.reflection, { whatLearned: '', difficulties: '', whatToImprove: '' });
  const learningObjectives = parseJson(row.learning_objectives, []);
  const prerequisites = parseJson(row.prerequisites, []);
  const acceptanceCriteria = parseJson(row.acceptance_criteria, []);
  const skills = parseJson(row.skills_exercised, []);
  const starterTemplate = parseJson(row.starter_template, {});

  const diffLevel = Number(row.difficulty_level) || 1;
  const completedTasks = normalizedTasks.filter(t => t.completed).length;
  const progressPercent = row.status === 'completed'
    ? 100
    : (normalizedTasks.length > 0 ? Math.round((completedTasks / normalizedTasks.length) * 100) : (Number(row.progress_percent) || 0));

  return {
    ...row,
    tier: diffLevel,
    difficulty_level: diffLevel,
    difficulty_label: row.difficulty_label || (diffLevel === 1 ? 'Starter' : diffLevel === 2 ? 'Practical' : 'Career-Ready'),
    progress_percent: progressPercent,
    tasks_progress: normalizedTasks,
    tasks: normalizedTasks,
    step_by_step_tasks: normalizedTasks,
    deliverables: normalizedDeliverables,
    reflection,
    learning_objectives: learningObjectives,
    prerequisites,
    acceptance_criteria: acceptanceCriteria,
    skills,
    skills_exercised: skills,
    starter_template: starterTemplate
  };
}

/**
 * List all active/archived projects for the authenticated user.
 */
export async function listUserProjects(userId, { status, careerId } = {}) {
  const params = [userId];
  let where = 'WHERE user_id = $1';

  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  } else {
    where += ` AND status != 'archived'`;
  }

  if (careerId) {
    params.push(careerId);
    where += ` AND career_id = $${params.length}`;
  }

  const res = await pool.query(
    `SELECT * FROM user_projects 
     ${where} 
     ORDER BY updated_at DESC`, params
  );
  return res.rows.map(normalizeUserProjectRow);
}

/**
 * Get single user project by ID with strict user isolation.
 */
export async function getUserProject(userId, projectId) {
  const res = await pool.query(
    `SELECT * FROM user_projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  if (!res.rows[0]) {
    const error = new Error('Project not found or unauthorized access.');
    error.statusCode = 404;
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }
  return normalizeUserProjectRow(res.rows[0]);
}

/**
 * Start or activate a project in the user's workspace.
 * Idempotent: If user already started this project_id, returns existing record without duplicating.
 */
export async function startUserProject(userId, input) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const projectId = input.projectId || input.career_project_id || null;
    const inputTitle = input.title || input.project_title || null;
    const inputCareerId = input.careerId || input.career_id || null;
    const inputCareerTitle = input.careerTitle || input.career_title || null;
    const inputPathwayId = input.pathwayId || input.pathway_id || null;
    const inputUserPathwayStepId = input.userPathwayStepId || input.user_pathway_step_id || null;
    const inputDiffLevel = input.difficultyLevel || input.tier || null;

    const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
    const queryProjectId = (projectId && isUuid(projectId)) ? projectId : null;

    // 1. Idempotency check: if project_id is provided, check if already exists for this user
    if (queryProjectId) {
      const existing = await client.query(
        `SELECT * FROM user_projects WHERE user_id = $1 AND project_id = $2`,
        [userId, queryProjectId]
      );
      if (existing.rows[0]) {
        // If archived or paused, resume it
        const current = existing.rows[0];
        if (current.status === 'archived' || current.status === 'paused') {
          const updated = await client.query(
            `UPDATE user_projects 
             SET status = 'in_progress', paused_at = NULL, updated_at = NOW() 
             WHERE id = $1 RETURNING *`, [current.id]
          );
          await client.query('COMMIT');
          return normalizeUserProjectRow(updated.rows[0]);
        }
        await client.query('COMMIT');
        return normalizeUserProjectRow(current);
      }
    }

    // Also check if user already has an active project with exact same title
    if (inputTitle) {
      const titleMatch = await client.query(
        `SELECT * FROM user_projects WHERE user_id = $1 AND title ILIKE $2 AND status != 'archived'`,
        [userId, inputTitle.trim()]
      );
      if (titleMatch.rows[0]) {
        await client.query('COMMIT');
        return normalizeUserProjectRow(titleMatch.rows[0]);
      }
    }

    // 2. Fetch template project details if starting from a catalogue project
    let template = null;
    if (queryProjectId) {
      const tRes = await client.query(`SELECT * FROM career_projects WHERE id = $1`, [queryProjectId]);
      template = tRes.rows[0] || null;
    }

    const title = inputTitle || template?.title;
    const diffLevel = inputDiffLevel || template?.difficulty_level || 1;
    const diffLabel = input.difficultyLabel || template?.difficulty_label || (diffLevel === 1 ? 'Starter' : diffLevel === 2 ? 'Practical' : 'Career-Ready');
    const projectType = input.projectType || template?.project_type || 'technical';
    const brief = input.brief || template?.brief || '';
    const problemStatement = input.problemStatement || template?.problem_statement || '';
    const learningObjectives = input.learningObjectives || template?.learning_objectives || [];
    const prerequisites = input.prerequisites || template?.prerequisites || [];
    const acceptanceCriteria = input.acceptanceCriteria || template?.acceptance_criteria || [];
    const skills = input.skills || template?.skills || [];
    const starterTemplate = input.starterTemplate || template?.starter_template || {};
    const nextStep = input.nextStep || template?.next_step || '';

    // Initialize task progress tracking with checkboxes
    const rawTasks = (Array.isArray(input.tasks) && input.tasks.length > 0)
      ? input.tasks
      : ((Array.isArray(input.step_by_step_tasks) && input.step_by_step_tasks.length > 0)
        ? input.step_by_step_tasks
        : (Array.isArray(template?.tasks) ? template.tasks : []));

    const tasksProgress = rawTasks.map((t, idx) => ({
      order: t.order || idx + 1,
      title: t.title || t.task_name || t.name || `Task ${idx + 1}`,
      description: t.description || '',
      deliverable_hint: t.deliverable_hint || '',
      completed: false,
      notes: ''
    }));

    // Initialize expected deliverables structure
    const rawDeliverables = (Array.isArray(input.deliverables) && input.deliverables.length > 0)
      ? input.deliverables
      : (Array.isArray(template?.deliverables) ? template.deliverables : []);

    const initialDeliverables = rawDeliverables.map(d => ({
      id: crypto.randomUUID(),
      type: d.type || 'report_doc',
      deliverable_type: d.type || 'report_doc',
      title: d.title || 'Project Deliverable',
      description: d.description || '',
      format_hint: d.format_hint || '',
      url: d.url || '',
      link_url: d.url || '',
      notes: d.notes || '',
      submitted_at: null,
      required: Boolean(d.required),
      verified: false
    }));

    // 3. Resolve foreign keys safely so unseeded or AI-generated projects do not trigger foreign key constraint errors
    const validProjectId = template ? template.id : null;
    let validCareerId = null;
    const cidCandidate = (inputCareerId && isUuid(inputCareerId)) ? inputCareerId : (template?.career_id && isUuid(template.career_id) ? template.career_id : null);
    if (cidCandidate) {
      const cCheck = await client.query(`SELECT id FROM careers WHERE id = $1`, [cidCandidate]);
      if (cCheck.rows[0]) validCareerId = cCheck.rows[0].id;
    }

    const insertRes = await client.query(
      `INSERT INTO user_projects (
        user_id, project_id, career_id, career_title, pathway_id, user_pathway_step_id,
        title, difficulty_level, difficulty_label, project_type, status, progress_percent,
        brief, problem_statement, learning_objectives, prerequisites, tasks_progress,
        deliverables, acceptance_criteria, skills_exercised, starter_template, next_step
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'in_progress', 0, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        userId,
        validProjectId,
        validCareerId,
        inputCareerTitle || template?.career_title || null,
        inputPathwayId,
        inputUserPathwayStepId,
        title,
        diffLevel,
        diffLabel,
        projectType,
        brief,
        problemStatement,
        JSON.stringify(learningObjectives),
        JSON.stringify(prerequisites),
        JSON.stringify(tasksProgress),
        JSON.stringify(initialDeliverables),
        JSON.stringify(acceptanceCriteria),
        JSON.stringify(skills),
        JSON.stringify(starterTemplate),
        nextStep
      ]
    );

    const row = insertRes.rows[0];

    // 4. If linked to user pathway step, update step to in_progress
    if (input.userPathwayStepId) {
      await client.query(
        `UPDATE user_pathway_steps 
         SET status = 'in_progress', started_at = COALESCE(started_at, NOW()), updated_at = NOW() 
         WHERE id = $1`, [input.userPathwayStepId]
      );
    }

    await client.query('COMMIT');
    return normalizeUserProjectRow(row);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update project attributes, task checklist progress, or pause/resume.
 */
export async function updateUserProject(userId, projectId, updates) {
  const current = await getUserProject(userId, projectId);

  let newStatus = updates.status || current.status;
  let pausedAt = current.paused_at;

  if (updates.status === 'paused') {
    pausedAt = new Date();
  } else if (updates.status === 'in_progress' && current.status === 'paused') {
    pausedAt = null;
  }

  // Calculate progress percentage if tasks were updated
  let tasksProgress = updates.tasksProgress || current.tasks_progress;
  let progressPercent = updates.progressPercent ?? current.progress_percent;

  if (Array.isArray(tasksProgress) && tasksProgress.length > 0 && updates.progressPercent === undefined) {
    const doneCount = tasksProgress.filter(t => t.completed).length;
    progressPercent = Math.round((doneCount / tasksProgress.length) * 100);
  }

  const res = await pool.query(
    `UPDATE user_projects SET
      title = COALESCE($1, title),
      status = $2,
      paused_at = $3,
      progress_percent = $4,
      tasks_progress = COALESCE($5, tasks_progress),
      brief = COALESCE($6, brief),
      problem_statement = COALESCE($7, problem_statement),
      reflection = COALESCE($8, reflection),
      is_in_portfolio = COALESCE($9, is_in_portfolio),
      portfolio_order = COALESCE($10, portfolio_order),
      portfolio_summary = COALESCE($11, portfolio_summary),
      portfolio_approach = COALESCE($12, portfolio_approach),
      portfolio_tools_used = COALESCE($13, portfolio_tools_used),
      portfolio_outcomes = COALESCE($14, portfolio_outcomes),
      portfolio_limitations = COALESCE($15, portfolio_limitations),
      portfolio_lessons = COALESCE($16, portfolio_lessons),
      custom_metadata = COALESCE($17, custom_metadata),
      updated_at = NOW()
     WHERE id = $18 AND user_id = $19
     RETURNING *`,
    [
      updates.title,
      newStatus,
      pausedAt,
      progressPercent,
      updates.tasksProgress ? JSON.stringify(updates.tasksProgress) : null,
      updates.brief,
      updates.problemStatement,
      updates.reflection ? JSON.stringify(updates.reflection) : null,
      updates.isInPortfolio,
      updates.portfolioOrder,
      updates.portfolioSummary,
      updates.portfolioApproach,
      updates.portfolioToolsUsed ? JSON.stringify(updates.portfolioToolsUsed) : null,
      updates.portfolioOutcomes,
      updates.portfolioLimitations,
      updates.portfolioLessons,
      updates.customMetadata ? JSON.stringify(updates.customMetadata) : null,
      projectId,
      userId
    ]
  );

  return normalizeUserProjectRow(res.rows[0]);
}

/**
 * Add or update a deliverable in the project.
 */
export async function addProjectDeliverable(userId, projectId, input) {
  const current = await getUserProject(userId, projectId);
  const deliverables = Array.isArray(current.deliverables) ? [...current.deliverables] : [];

  const rawType = input.type || input.deliverableType || 'report_doc';
  const type = rawType === 'github_repo' ? 'code_repo' : rawType;
  const url = input.url || input.linkUrl || '';
  const notes = input.notes || '';
  const title = input.title || 'Deliverable';

  const targetId = input.id || input.deliverableId;
  const existingIdx = targetId ? deliverables.findIndex(d => d.id === targetId) : -1;

  if (existingIdx >= 0) {
    deliverables[existingIdx] = {
      ...deliverables[existingIdx],
      title,
      type,
      deliverable_type: type,
      url,
      link_url: url,
      notes,
      updated_at: new Date().toISOString()
    };
  } else {
    const newDeliverable = {
      id: crypto.randomUUID(),
      title,
      type,
      deliverable_type: type,
      url,
      link_url: url,
      notes,
      submitted_at: new Date().toISOString(),
      required: false,
      verified: false
    };
    deliverables.push(newDeliverable);
  }

  const res = await pool.query(
    `UPDATE user_projects 
     SET deliverables = $1, updated_at = NOW() 
     WHERE id = $2 AND user_id = $3 
     RETURNING *`,
    [JSON.stringify(deliverables), projectId, userId]
  );
  return normalizeUserProjectRow(res.rows[0]);
}

/**
 * Remove a deliverable from a project by index or ID.
 */
export async function removeProjectDeliverable(userId, projectId, deliverableIndexOrId) {
  const current = await getUserProject(userId, projectId);
  let deliverables = Array.isArray(current.deliverables) ? [...current.deliverables] : [];

  if (typeof deliverableIndexOrId === 'number' || (!isNaN(Number(deliverableIndexOrId)) && String(deliverableIndexOrId).length < 8)) {
    const idx = Number(deliverableIndexOrId);
    if (idx >= 0 && idx < deliverables.length) {
      deliverables.splice(idx, 1);
    }
  } else if (typeof deliverableIndexOrId === 'string') {
    deliverables = deliverables.filter(d => d.id !== deliverableIndexOrId);
  }

  const res = await pool.query(
    `UPDATE user_projects 
     SET deliverables = $1, updated_at = NOW() 
     WHERE id = $2 AND user_id = $3 
     RETURNING *`,
    [JSON.stringify(deliverables), projectId, userId]
  );
  return normalizeUserProjectRow(res.rows[0]);
}

/**
 * Submit and complete a project workspace.
 * Connects completion to:
 * 1. user_projects status = 'completed'
 * 2. user_skills evidence = 'project_supported'
 * 3. user_pathway_steps = 'completed' (for Apply Your Skills milestone)
 */
export async function submitUserProject(userId, projectId, { deliverables, reflection, evaluationChecklist, addToPortfolio = true }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const projRes = await client.query(
      `SELECT * FROM user_projects WHERE id = $1 AND user_id = $2`, [projectId, userId]
    );
    if (!projRes.rows[0]) {
      const error = new Error('Project not found or unauthorized.');
      error.statusCode = 404; error.code = 'PROJECT_NOT_FOUND'; throw error;
    }
    const current = projRes.rows[0];

    // Idempotency: if already completed, return existing normalized without re-executing
    if (current.status === 'completed') {
      await client.query('COMMIT');
      const normalized = normalizeUserProjectRow(current);
      return { project: normalized, ...normalized };
    }

    // Combine any existing deliverables with newly submitted ones
    const currentDeliverables = Array.isArray(current.deliverables)
      ? current.deliverables
      : (typeof current.deliverables === 'string' ? JSON.parse(current.deliverables) : []);
    const combinedDeliverables = deliverables || currentDeliverables || [];
    if (combinedDeliverables.length === 0) {
      const error = new Error('At least one deliverable or link is required to complete this project.');
      error.statusCode = 400; error.code = 'VALIDATION_ERROR'; throw error;
    }

    // Mark all tasks as completed upon final project submission
    const currentTasks = Array.isArray(current.tasks_progress)
      ? current.tasks_progress
      : (typeof current.tasks_progress === 'string' ? JSON.parse(current.tasks_progress) : []);
    const completedTasks = currentTasks.map(t => ({ ...t, completed: true }));

    // 1. Mark project completed
    const updatedRes = await client.query(
      `UPDATE user_projects SET
        status = 'completed',
        progress_percent = 100,
        completed_at = NOW(),
        tasks_progress = $1,
        deliverables = $2,
        reflection = $3,
        is_in_portfolio = $4,
        updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [
        JSON.stringify(completedTasks),
        JSON.stringify(combinedDeliverables),
        JSON.stringify(reflection || {}),
        Boolean(addToPortfolio),
        projectId,
        userId
      ]
    );
    const completedProject = normalizeUserProjectRow(updatedRes.rows[0]);

    // 2. Connect project completion to skills (Requirement 9)
    const skillsExercised = Array.isArray(completedProject.skills_exercised) ? completedProject.skills_exercised : [];
    for (const skillName of skillsExercised) {
      if (!skillName || typeof skillName !== 'string') continue;
      
      // Look up skill in skills table
      const skillRes = await client.query(
        `SELECT id, name FROM skills WHERE name ILIKE $1 LIMIT 1`, [skillName.trim()]
      );

      let skillId = skillRes.rows[0]?.id;
      if (!skillId) {
        // Also check aliases table
        const aliasRes = await client.query(
          `SELECT skill_id FROM skill_aliases WHERE alias_name ILIKE $1 LIMIT 1`, [skillName.trim()]
        );
        skillId = aliasRes.rows[0]?.skill_id;
      }

      if (skillId) {
        // Upsert user_skills with project_supported evidence without downgrading verified formal skills
        const existingSkill = await client.query(
          `SELECT level, verified, evidence_type FROM user_skills WHERE user_id = $1 AND skill_id = $2`,
          [userId, skillId]
        );

        const targetLevel = completedProject.difficulty_level >= 2 ? 'intermediate' : 'beginner';

        if (existingSkill.rows[0]) {
          const curr = existingSkill.rows[0];
          // Preserve formal assessment if already verified
          const newEvidenceType = curr.verified ? 'formally_assessed' : 'project_supported';
          await client.query(
            `UPDATE user_skills SET
              evidence_type = $1,
              evidence_source_id = $2,
              evidence_notes = $3,
              updated_at = NOW()
             WHERE user_id = $4 AND skill_id = $5`,
            [
              newEvidenceType,
              projectId,
              `Evidenced by completed project: ${completedProject.title}`,
              userId,
              skillId
            ]
          );
        } else {
          await client.query(
            `INSERT INTO user_skills (user_id, skill_id, level, verified, evidence_type, evidence_source_id, evidence_notes)
             VALUES ($1, $2, $3, false, 'project_supported', $4, $5)
             ON CONFLICT (user_id, skill_id) DO UPDATE SET
               evidence_type = 'project_supported',
               evidence_source_id = EXCLUDED.evidence_source_id,
               evidence_notes = EXCLUDED.evidence_notes,
               updated_at = NOW()`,
            [
              userId,
              skillId,
              targetLevel,
              projectId,
              `Evidenced by completed project: ${completedProject.title}`
            ]
          );
        }
      }
    }

    // 3. Connect to user pathway milestone (Requirements 9 & 10)
    // Find active user pathway step to complete
    let stepToComplete = null;
    if (completedProject.user_pathway_step_id) {
      stepToComplete = completedProject.user_pathway_step_id;
    } else if (completedProject.career_id) {
      // Find user pathway for this career
      const stepMatch = await client.query(
        `SELECT ups.id, ups.user_pathway_id, ps.title 
         FROM user_pathway_steps ups
         JOIN pathway_steps ps ON ps.id = ups.pathway_step_id
         JOIN user_pathways up ON up.id = ups.user_pathway_id
         JOIN pathways p ON p.id = up.pathway_id
         WHERE up.user_id = $1 AND p.career_id = $2 AND up.status = 'active'
           AND (ps.title ILIKE '%Project%' OR ps.metadata->>'stage' ILIKE '%Apply Your Skills%')
         LIMIT 1`, [userId, completedProject.career_id]
      );
      if (stepMatch.rows[0]) {
        stepToComplete = stepMatch.rows[0].id;
      }
    }

    if (stepToComplete) {
      await client.query(
        `UPDATE user_pathway_steps 
         SET status = 'completed', completed_at = NOW(), notes = $1, updated_at = NOW()
         WHERE id = $2`,
        [`Completed via Project Studio: ${completedProject.title}`, stepToComplete]
      );
    }

    await client.query('COMMIT');
    return { project: completedProject, ...completedProject };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Undo completion of a project and restore to in_progress.
 */
export async function undoUserProjectSubmission(userId, projectId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const projRes = await client.query(
      `SELECT * FROM user_projects WHERE id = $1 AND user_id = $2`, [projectId, userId]
    );
    if (!projRes.rows[0]) {
      const error = new Error('Project not found.');
      error.statusCode = 404; throw error;
    }
    const current = projRes.rows[0];

    const updated = await client.query(
      `UPDATE user_projects SET
        status = 'in_progress',
        completed_at = NULL,
        progress_percent = 75,
        updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`, [projectId, userId]
    );

    // Rollback linked pathway step if applicable
    if (current.user_pathway_step_id) {
      await client.query(
        `UPDATE user_pathway_steps SET status = 'in_progress', completed_at = NULL, updated_at = NOW() WHERE id = $1`,
        [current.user_pathway_step_id]
      );
    }

    await client.query('COMMIT');
    return normalizeUserProjectRow(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Archive a user project.
 */
export async function archiveUserProject(userId, projectId) {
  const res = await pool.query(
    `UPDATE user_projects SET status = 'archived', updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
    [projectId, userId]
  );
  if (!res.rows[0]) {
    const error = new Error('Project not found.');
    error.statusCode = 404; throw error;
  }
  return normalizeUserProjectRow(res.rows[0]);
}

/**
 * Restore an archived project.
 */
export async function restoreUserProject(userId, projectId) {
  const res = await pool.query(
    `UPDATE user_projects SET status = 'in_progress', updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
    [projectId, userId]
  );
  if (!res.rows[0]) {
    const error = new Error('Project not found.');
    error.statusCode = 404; throw error;
  }
  return normalizeUserProjectRow(res.rows[0]);
}

// Convenient exported aliases matching routing and test conventions
export const startProject = startUserProject;
export const getUserProjects = listUserProjects;
export const getUserProjectById = getUserProject;
export const updateTaskProgress = async (userId, projectId, { taskOrder, completed, notes }) => {
  const current = await getUserProject(userId, projectId);
  const tasks = Array.isArray(current.tasks_progress) ? [...current.tasks_progress] : [];
  const idx = tasks.findIndex(t => t.order === taskOrder);
  if (idx >= 0) {
    tasks[idx].completed = Boolean(completed);
    if (notes !== undefined) tasks[idx].notes = notes;
  }
  return updateUserProject(userId, projectId, { tasksProgress: tasks });
};
export const addDeliverable = addProjectDeliverable;
export const removeDeliverable = removeProjectDeliverable;
export const submitProject = submitUserProject;
export const updateProjectStatus = (userId, projectId, status) => updateUserProject(userId, projectId, { status });

