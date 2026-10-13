import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:mittal88@1@1@@localhost:5432/goa_career_intelligence'
});

async function main() {
  await pool.query(`
    INSERT INTO career_projects (
      career_id, career_title, title, slug, difficulty_level, difficulty_label,
      project_type, estimated_effort, brief, problem_statement, learning_objectives,
      prerequisites, tasks, deliverables, acceptance_criteria, evaluation_rubric,
      skills, starter_template, reflection_prompts, next_step, origin, verification_status
    ) VALUES
    (
      'c54a6937-3967-4457-8037-08e46eb17616',
      'Business Analyst',
      'Level 1 — Business Scenario Analysis and Executive Memo',
      'ba-starter-scenario-analysis',
      1,
      'Starter',
      'business_finance',
      '1 week (8-10 hours)',
      'Analyse a small business operational scenario, evaluate workflow bottlenecks, and prepare a concise executive recommendation memo with documented assumptions.',
      'Small enterprises leak revenue through disorganized workflow handoffs and unclear departmental metrics.',
      '["Map existing business processes using workflow diagrams", "Identify operational friction points and cost leakages", "Author a concise executive memo with prioritized recommendations"]'::jsonb,
      '["Basic business understanding and spreadsheet literacy"]'::jsonb,
      '[
        {"order": 1, "title": "Process Workflow Mapping", "description": "Map the current-state workflow from customer request to fulfillment.", "deliverable_hint": "Process flow diagram"},
        {"order": 2, "title": "Bottleneck Identification and Impact Calculation", "description": "Calculate hours lost and financial cost of delays.", "deliverable_hint": "Quantified impact spreadsheet"},
        {"order": 3, "title": "Executive Recommendation Memo", "description": "Formulate 3 actionable steps with expected savings.", "deliverable_hint": "2-page memo document"}
      ]'::jsonb,
      '[
        {"type": "report_doc", "title": "Executive Recommendation Memo", "description": "Concise memo outlining process findings and financial impact.", "format_hint": "PDF memo document", "required": true},
        {"type": "architecture", "title": "Current vs Future Process Flow Diagram", "description": "Visual workflow map comparing current state to proposed state.", "format_hint": "PDF or image diagram", "required": true}
      ]'::jsonb,
      '[
        "Process flow diagram clearly distinguishes roles and sequential handoffs",
        "Recommendations include quantified financial or operational impact estimates",
        "Documented assumptions are clearly stated without hiding uncertainty"
      ]'::jsonb,
      '[
        {"dimension": "Business Insight", "criteria": "Root-cause analysis rather than superficial observation"},
        {"dimension": "Executive Clarity", "criteria": "Concise, professional presentation suitable for leadership"}
      ]'::jsonb,
      '["Business Analysis", "Reporting", "Problem Solving"]'::jsonb,
      '{"title": "Business Analysis Memo Template", "description": "Standard management consulting memo format.", "free_alternative": "Google Docs template", "url": "https://careergps.local/templates/ba-memo.docx"}'::jsonb,
      '["What unexpected bottleneck emerged when mapping the workflow?", "How did you validate your financial assumptions?"]'::jsonb,
      'Advance to Level 2: Build a financial or operational analysis with documented assumptions.',
      'curated',
      'verified'
    ),
    (
      'c54a6937-3967-4457-8037-08e46eb17616',
      'Business Analyst',
      'Level 2 — Operational and Financial Model with Documented Assumptions',
      'ba-practical-financial-model',
      2,
      'Practical',
      'business_finance',
      '2-3 weeks (20 hours)',
      'Produce a dynamic operational and financial model evaluating business expansion or automation investment with sensitivity scenarios (Best, Base, Worst).',
      'Capital investments fail when models lack dynamic sensitivity testing and rely on single-point optimistic assumptions.',
      '["Build dynamic 3-statement financial or operational models in Excel", "Perform sensitivity analysis across pricing, cost, and volume variables", "Document all underlying assumptions, sources, and limitation boundaries"]'::jsonb,
      '["Level 1 Business Memo or intermediate spreadsheet modeling"]'::jsonb,
      '[
        {"order": 1, "title": "Model Architecture and Assumption Sheet", "description": "Establish dynamic input drivers separated from calculated outputs.", "deliverable_hint": "Input assumption tab"},
        {"order": 2, "title": "Build 3-Year Projection Schedule", "description": "Model monthly revenues, variable costs, and fixed overhead.", "deliverable_hint": "Financial projection model"},
        {"order": 3, "title": "Sensitivity Matrix and Scenario Analysis", "description": "Build sensitivity tables testing profitability under demand fluctuations.", "deliverable_hint": "Sensitivity analysis table"},
        {"order": 4, "title": "Executive Decision Brief", "description": "Synthesize findings into an investment committee brief.", "deliverable_hint": "Decision brief PDF"}
      ]'::jsonb,
      '[
        {"type": "dataset", "title": "Dynamic Financial / Operational Model (.xlsx)", "description": "Spreadsheet with active formulas, input drivers, and sensitivity tables.", "format_hint": "Excel or Google Sheets link", "required": true},
        {"type": "report_doc", "title": "Investment Committee Decision Brief", "description": "Document summarizing investment thesis, risks, and ROI timeline.", "format_hint": "PDF brief", "required": true}
      ]'::jsonb,
      '[
        "All formulas are dynamic and link directly to the assumption driver sheet",
        "Model incorporates Best, Base, and Worst case scenario toggles",
        "Breakeven point and net margin curves are documented and visually graphed"
      ]'::jsonb,
      '[
        {"dimension": "Financial Modeling Rigor", "criteria": "Clean formula structure without hardcoded numbers in calculation cells"},
        {"dimension": "Risk & Sensitivity Analysis", "criteria": "Realistic scenario stress-testing and thorough risk assessment"}
      ]'::jsonb,
      '["Business Analysis", "Excel", "Data Handling", "Accounting"]'::jsonb,
      '{"title": "Financial Modeling Starter Workbook", "description": "Excel template with dynamic sensitivity table layout.", "free_alternative": "Google Sheets financial model", "url": "https://careergps.local/templates/fin-model.xlsx"}'::jsonb,
      '["Which variable was your model most sensitive to?", "How would unexpected inflation alter the breakeven timeline?"]'::jsonb,
      'Advance to Level 3: Deliver a complete business feasibility or M&A capstone case study.',
      'curated',
      'verified'
    ),
    (
      'c54a6937-3967-4457-8037-08e46eb17616',
      'Business Analyst',
      'Level 3 — Business Feasibility and Strategic Valuation Capstone',
      'ba-career-ready-feasibility-capstone',
      3,
      'Career-Ready',
      'business_finance',
      '3-4 weeks (35+ hours)',
      'Conduct a full commercial feasibility study for a new market entry or acquisition, including market sizing, competitor benchmarking, financial valuation, and risk governance.',
      'Strategic decisions risk multimillion-dollar write-downs when organizations expand without rigorous commercial due diligence and governance.',
      '["Perform top-down and bottom-up Total Addressable Market (TAM) sizing", "Conduct DCF or multiple-based valuation with risk-adjusted hurdle rates", "Present strategic recommendations to a simulated board with visual dashboards and governance limits"]'::jsonb,
      '["Level 2 Financial Model", "Corporate finance and strategy fundamentals"]'::jsonb,
      '[
        {"order": 1, "title": "Market Sizing and Competitive Landscape", "description": "Size addressable market (TAM, SAM, SOM) and benchmark 4 market competitors.", "deliverable_hint": "Market sizing analysis"},
        {"order": 2, "title": "Valuation and Return on Investment Schedule", "description": "Construct discounted cash flow (DCF) or payback model with hurdle rates.", "deliverable_hint": "Valuation model"},
        {"order": 3, "title": "Risk Matrix and Governance Framework", "description": "Identify strategic, regulatory, and operational risks with mitigation protocols.", "deliverable_hint": "Risk matrix"},
        {"order": 4, "title": "Board Presentation Deck and Full Case Study", "description": "Synthesize comprehensive case study and 12-slide board recommendation deck.", "deliverable_hint": "Slide deck and case study report"}
      ]'::jsonb,
      '[
        {"type": "presentation", "title": "Board of Directors Presentation Deck", "description": "Executive slide deck presenting strategic case, financials, and risk mitigation.", "format_hint": "Slide deck PDF", "required": true},
        {"type": "report_doc", "title": "Comprehensive Feasibility Study Report", "description": "Full consulting-style report with detailed methodology, assumptions, and limitations.", "format_hint": "PDF document or report link", "required": true}
      ]'::jsonb,
      '[
        "Market sizing combines credible bottom-up and top-down calculation methodologies",
        "Valuation model includes clear cost of capital and discount rate justification",
        "Strategic recommendations provide actionable phase-gate milestones and explicit exit criteria",
        "Limitations section transparently addresses data gaps and macroeconomic sensitivities"
      ]'::jsonb,
      '[
        {"dimension": "Strategic & Commercial Depth", "criteria": "Rigorous market sizing, competitive positioning, and financial valuation"},
        {"dimension": "Executive Decision-Making", "criteria": "Compelling board deck that balances growth ambition with prudent risk management"}
      ]'::jsonb,
      '["Business Analysis", "Accounting", "Data Visualisation", "Reporting", "Critical Thinking"]'::jsonb,
      '{"title": "Strategic Feasibility Study Template", "description": "Management consulting case study and slide deck framework.", "free_alternative": "Free Google Slides and Docs templates", "url": "https://careergps.local/templates/feasibility-study.pptx"}'::jsonb,
      '["What regulatory or competitive hurdle posed the biggest threat to profitability?", "How did you determine the appropriate discount rate?"]'::jsonb,
      'Capstone completed! Feature this project prominently in your CareerGPS Portfolio.',
      'curated',
      'verified'
    )
    ON CONFLICT DO NOTHING;
  `);
  console.log('Successfully seeded Business Analyst projects.');
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
