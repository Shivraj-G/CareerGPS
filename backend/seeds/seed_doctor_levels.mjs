import { pool } from '../src/config/database.js';

async function seed() {
  console.log('Seeding verification_status and Doctor levels 2 & 3...');

  // 1. Add verification_status to user_projects if missing
  await pool.query(`
    ALTER TABLE user_projects 
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) NOT NULL DEFAULT 'verified';
  `);

  // 2. Insert Doctor Level 2 and Level 3 projects
  const doctorCareerId = '1fbc7614-cf1f-460b-b167-6eda303bb61e';

  await pool.query(`
    INSERT INTO career_projects (
      id, career_id, career_title, title, slug, difficulty_level, difficulty_label,
      project_type, estimated_effort, brief, problem_statement, learning_objectives,
      prerequisites, tasks, deliverables, acceptance_criteria, evaluation_rubric,
      skills, starter_template, reflection_prompts, next_step, origin, verification_status
    ) VALUES
    (
      'e1000007-0007-4000-8000-000000000002',
      $1,
      'Doctor',
      'Level 2 — Clinical Handover Audit & Structured SBAR Ward Simulation',
      'clinical-practical-handover-audit',
      2,
      'Practical',
      'clinical_case',
      '2-3 weeks (20 hours)',
      'Conduct a clinical practice quality improvement audit or structured clinical handover exercise adhering to SBAR (Situation-Background-Assessment-Recommendation) protocol in inpatient hospital settings.',
      'Miscommunication during medical shift handovers is a primary root cause of patient safety incidents, delayed emergency responses, and preventable hospital complications.',
      '["Execute structured clinical handovers using standardized SBAR communication protocol", "Audit ward medication charting or fluid balance charts against clinical hospital guidelines", "Document evidence-based recommendations for reducing handover errors"]'::jsonb,
      '["Level 1 Clinical Case History", "Hospital ward postings or simulated clinical practice training"]'::jsonb,
      '[
        {"order": 1, "title": "SBAR Handover Protocol Authoring", "description": "Formulate 3 clinical shift handover scripts for high-acuity in-patients using Situation, Background, Assessment, and Recommendation structure.", "deliverable_hint": "SBAR handover documentation"},
        {"order": 2, "title": "Clinical Charting Audit", "description": "Review de-identified patient monitoring charts for completeness and adherence to hospital protocols.", "deliverable_hint": "Audit checklist & findings"},
        {"order": 3, "title": "Clinical Quality Improvement Report", "description": "Synthesize handover and documentation findings into a structured quality improvement project (QIP) summary.", "deliverable_hint": "QIP summary document"}
      ]'::jsonb,
      '[
        {"type": "case_study", "title": "Structured SBAR Handover Portfolio", "description": "Comprehensive handover documentation for 3 simulated in-patients.", "format_hint": "PDF document or logbook entry", "required": true},
        {"type": "report_doc", "title": "Clinical Quality Improvement Audit Summary", "description": "Clinical audit report detailing methodology, protocol adherence, and safety recommendations.", "format_hint": "PDF clinical audit report", "required": true}
      ]'::jsonb,
      '[
        "Handover documentation strictly utilizes SBAR communication structure",
        "Clinical observations and vital parameters are accurately recorded without omission",
        "Recommendations are grounded in recognized clinical guidelines and hospital safety protocols",
        "Note explicitly states this exercises simulation and does not substitute for CRMI internship hours"
      ]'::jsonb,
      '[
        {"dimension": "Clinical Communication & Patient Safety", "criteria": "Concise, precise transmission of urgent patient status using validated SBAR format"},
        {"dimension": "Quality Improvement Rigor", "criteria": "Evidence-based analysis of ward procedures with actionable safety improvements"}
      ]'::jsonb,
      '["Clinical Care", "Clinical handover communication", "Clinical documentation", "Medical ethics"]'::jsonb,
      '{"title": "SBAR Hospital Handover Template", "description": "Standardized hospital clinical handover scaffold.", "free_alternative": "Free printable SBAR template", "url": "https://careergps.local/templates/sbar-handover.pdf"}'::jsonb,
      '["Which information is most critical during an emergency patient handover?", "How does standardizing documentation prevent medical errors?"]'::jsonb,
      'Advance to Level 3: Complete a comprehensive supervised clinical case review and critical appraisal.',
      'curated',
      'verified'
    ),
    (
      'e1000007-0007-4000-8000-000000000003',
      $1,
      'Doctor',
      'Level 3 — Clinical Case Portfolio & Evidence-Based Critical Appraisal',
      'clinical-career-ready-portfolio-appraisal',
      3,
      'Career-Ready',
      'clinical_case',
      '3-4 weeks (35+ hours)',
      'Assemble a comprehensive academic-clinical portfolio containing 3 de-identified patient management reviews, systematic critical appraisal of relevant randomized trials, and reflective ethical practice notes. NOTE: Under statutory National Medical Commission (NMC) regulations, this portfolio provides supplemental educational documentation and CANNOT bypass mandatory MBBS degrees, CRMI rotatory hospital internships, or State Medical Council registration.',
      'Modern evidence-based medical practice requires synthesizing clinical trial evidence (CONSORT guidelines), evaluating diagnostic odds ratios, and maintaining rigorous ethical documentation throughout patient care.',
      '["Synthesize patient management plans combining pathophysiology, clinical trials, and clinical guidelines", "Perform critical appraisal of medical literature using CASP checklist tools", "Reflect on medical ethics, informed consent dilemmas, and statutory patient confidentiality standards"]'::jsonb,
      '["Final MBBS curriculum / clinical rotations", "Biostatistics and medical literature search literacy"]'::jsonb,
      '[
        {"order": 1, "title": "Case 1: Acute Medical Admission & Management", "description": "Document complete acute medical admission (e.g. DKA or acute coronary syndrome) with evidence-based treatment rationale.", "deliverable_hint": "Detailed clinical case review"},
        {"order": 2, "title": "Case 2: Surgical / Procedural Patient Pathway", "description": "Review pre-operative assessment, consent discussion, and post-operative monitoring for a major surgical patient.", "deliverable_hint": "Surgical case pathway review"},
        {"order": 3, "title": "Critical Appraisal of Clinical Trial", "description": "Perform critical appraisal of a pivotal randomized controlled trial using CASP guidelines.", "deliverable_hint": "CASP appraisal document"},
        {"order": 4, "title": "Reflective Ethics & Statutory Licensure Statement", "description": "Author reflective statement addressing ethical dilemmas, informed consent, and statutory licensing requirements.", "deliverable_hint": "Reflective portfolio statement"}
      ]'::jsonb,
      '[
        {"type": "case_study", "title": "Multi-Case Clinical Portfolio Document", "description": "Bound or compiled PDF case portfolio detailing 2 clinical cases and treatment rationales.", "format_hint": "Comprehensive PDF clinical portfolio", "required": true},
        {"type": "report_doc", "title": "Evidence-Based Critical Appraisal (CASP)", "description": "Appraisal report evaluating medical trial validity, results, and local applicability.", "format_hint": "Critical appraisal document", "required": true},
        {"type": "report_doc", "title": "Reflective Medical Ethics & Licensure Statement", "description": "Formal reflection on clinical ethics and statutory licensure requirements.", "format_hint": "PDF reflective essay", "required": true}
      ]'::jsonb,
      '[
        "Portfolio demonstrates sound clinical reasoning grounded in peer-reviewed clinical guidelines",
        "Critical appraisal rigorously evaluates trial design, sample size, blinding, and endpoints",
        "Reflective statement explicitly confirms understanding of mandatory State Medical Council licensing",
        "All cases adhere strictly to patient confidentiality and medical ethics codes"
      ]'::jsonb,
      '[
        {"dimension": "Evidence-Based Clinical Reasoning", "criteria": "Demonstrates thorough integration of pathophysiological principles and randomized clinical trials"},
        {"dimension": "Professionalism & Statutory Compliance", "criteria": "Deep appreciation of medical ethics, patient consent, and statutory licensing frameworks"}
      ]'::jsonb,
      '["Clinical Care", "Clinical Assessment", "Medical ethics", "Clinical documentation"]'::jsonb,
      '{"title": "Clinical Case Review & Critical Appraisal Scaffold", "description": "Academic medical portfolio template for clinical students.", "free_alternative": "Free open-source CASP appraisal tool", "url": "https://casp-uk.net"}'::jsonb,
      '["How did the randomized trial evidence influence your clinical management recommendation?", "What ethical considerations arise when balancing patient autonomy and clinical advice?"]'::jsonb,
      'Portfolio completed! Integrate these case studies into your CareerGPS Clinical Dossier.',
      'curated',
      'verified'
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      brief = EXCLUDED.brief,
      difficulty_level = EXCLUDED.difficulty_level,
      difficulty_label = EXCLUDED.difficulty_label,
      project_type = EXCLUDED.project_type,
      updated_at = NOW();
  `, [doctorCareerId]);

  console.log('Seeded Doctor levels 2 & 3 successfully!');
  await pool.end();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
