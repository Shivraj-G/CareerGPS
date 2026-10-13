import { describe, expect, it } from 'vitest';
import { evaluateGoalFeasibility } from '../src/modules/goals/feasibility.engine.js';

describe('Current Goal Feasibility Engine (v2.0)', () => {
  it('preserves user ambition for Doctor while detecting formal prerequisite and delivery mode barriers', () => {
    const profile = {
      education: [{
        education_stage: 'HIGHER_EDUCATION',
        level: 'Undergraduate',
        school_12_stream: 'Commerce without Mathematics',
        current_program: 'BCA',
        degree: 'BCA',
        status: 'pursuing'
      }],
      preferred_locations: ['Goa', 'Remote'],
      constraints: {
        study_preference: 'Online / Part-time',
        weekly_hours: 10,
        budget: 'moderate'
      },
      skills: ['HTML', 'CSS', 'JavaScript']
    };

    const result = evaluateGoalFeasibility(profile, { title: 'Doctor' });

    // Dimension A: Ambition
    expect(result.four_dimensions.ambition.selected_goal.toLowerCase()).toContain('doctor');
    expect(result.four_dimensions.ambition.owner).toBe('user');
    expect(result.four_dimensions.ambition.preserved).toBe(true);

    // Dimension B: Formal Eligibility
    expect(result.four_dimensions.formal_eligibility.status).toBe('D');
    expect(result.four_dimensions.formal_eligibility.decision).toContain('Subject Prerequisite Restricted');
    expect(result.four_dimensions.formal_eligibility.cited_authorities).toContain('National Medical Commission (NMC)');

    // Dimension D: Practical Feasibility
    expect(result.four_dimensions.practical_feasibility.delivery_mode_conflict).toBe(true);
    expect(result.four_dimensions.practical_feasibility.obstacles.length).toBeGreaterThan(0);
    expect(result.four_dimensions.practical_feasibility.obstacles[0]).toMatch(/NMC/i);

    // Routes: Candidate comparison
    expect(result.routes.length).toBeGreaterThan(1);
    const niosRoute = result.routes.find(r => r.id.includes('nios'));
    expect(niosRoute).toBeDefined();
    expect(niosRoute.route_type).toBe('academic_bridge');
    expect(niosRoute.flexibility).toBeDefined();
    expect(niosRoute.cost).toBeDefined();

    // Next action
    expect(result.next_action.title).toMatch(/NMC/i);
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it('correctly assesses Software Developer for BCA profile with high practical feasibility', () => {
    const profile = {
      education: [{
        education_stage: 'HIGHER_EDUCATION',
        level: 'Undergraduate',
        school_12_stream: 'Science PCM',
        degree: 'BCA',
        status: 'pursuing'
      }],
      preferred_locations: ['Goa', 'Remote'],
      constraints: {
        study_preference: 'Online / Part-time',
        weekly_hours: 20
      },
      skills: ['JavaScript', 'React', 'Node.js']
    };

    const result = evaluateGoalFeasibility(profile, { title: 'Software Developer' });

    expect(result.four_dimensions.formal_eligibility.status).toBe('A');
    expect(result.four_dimensions.practical_feasibility.delivery_mode_conflict).toBe(false);
    expect(result.overall_feasibility.status).toBe('HIGH_FEASIBILITY');
    expect(result.routes.length).toBeGreaterThan(0);
    expect(result.next_action.title).toMatch(/API/i);
  });

  it('correctly evaluates Lawyer for BCA pursuing + Commerce background (Regression Scenario 1 & 6)', () => {
    const profile = {
      education: [{
        education_stage: 'HIGHER_EDUCATION',
        level: 'Undergraduate',
        school_12_stream: 'Commerce with Mathematics',
        current_program: 'BCA',
        degree: 'BCA',
        status: 'pursuing'
      }],
      preferred_locations: ['Goa', 'Remote'],
      constraints: {
        study_preference: 'Online / Part-time'
      }
    };

    const result = evaluateGoalFeasibility(profile, { title: 'Lawyer' });

    // Ambition preserved
    expect(result.four_dimensions.ambition.selected_goal.toLowerCase()).toContain('lawyer');
    expect(result.four_dimensions.ambition.preserved).toBe(true);

    // Dimension B: Formal Eligibility - State B (Degree Completion Milestone pending)
    expect(result.four_dimensions.formal_eligibility.status).toBe('B');
    expect(result.four_dimensions.formal_eligibility.decision).toContain('Degree Completion Milestone');
    expect(result.four_dimensions.formal_eligibility.cited_authorities).toContain('Bar Council of India (BCI)');

    // Dimension D: Practical Feasibility - Delivery Mode Conflict (BCI requires physical campus)
    expect(result.four_dimensions.practical_feasibility.delivery_mode_conflict).toBe(true);
    expect(result.four_dimensions.practical_feasibility.obstacles.some(o => /Bar Council|BCI|distance/i.test(o))).toBe(true);

    // Candidate routes: 3-Year LL.B. Graduate Route + 5-Year Integrated CLAT Route + Cyber Law
    expect(result.routes.length).toBeGreaterThanOrEqual(2);
    const threeYearRoute = result.routes.find(r => r.id.includes('3year_llb'));
    expect(threeYearRoute).toBeDefined();

    // Next action
    expect(result.next_action).toBeDefined();
    expect(result.next_action.title).toMatch(/LL\.B\.|Law|CUET-PG/i);
    expect(result.next_action.rationale).toMatch(/bachelor|graduation|Bar Council/i);
    expect(result.sources.some(s => s.authority.includes('Bar Council'))).toBe(true);
  });

  it('correctly evaluates Lawyer for 12th completed student as State A Direct 5-Year Integrated route', () => {
    const profile = {
      education: [{
        education_stage: 'SCHOOL_12',
        level: '12th / Higher Secondary',
        school_12_stream: 'Commerce',
        status: 'completed'
      }]
    };

    const result = evaluateGoalFeasibility(profile, { title: 'Corporate Lawyer' });
    expect(result.four_dimensions.formal_eligibility.status).toBe('A');
    expect(result.four_dimensions.formal_eligibility.decision).toContain('5-Year Integrated Law Route');
    expect(result.four_dimensions.formal_eligibility.cited_authorities).toContain('Bar Council of India (BCI)');
  });

  it('correctly evaluates Lawyer for LL.B. graduate as State A Direct Bar Enrolment', () => {
    const profile = {
      education: [{
        education_stage: 'HIGHER_EDUCATION',
        level: 'Undergraduate',
        degree: 'LL.B.',
        status: 'completed'
      }]
    };

    const result = evaluateGoalFeasibility(profile, { title: 'Lawyer' });
    expect(result.four_dimensions.formal_eligibility.status).toBe('A');
    expect(result.four_dimensions.formal_eligibility.decision).toContain('Direct Bar Council Enrolment');
    expect(result.next_action.title).toMatch(/AIBE|State Bar/i);
  });

  it('correctly evaluates Data Analyst for BCA student as State A Direct Quantitative/Tech Route (Regression Scenario 2)', () => {
    const profile = {
      education: [{
        education_stage: 'HIGHER_EDUCATION',
        level: 'Undergraduate',
        degree: 'BCA',
        status: 'pursuing'
      }],
      skills: ['SQL', 'Excel']
    };

    const result = evaluateGoalFeasibility(profile, { title: 'Data Analyst' });
    expect(result.four_dimensions.formal_eligibility.status).toBe('A');
    expect(result.four_dimensions.formal_eligibility.decision).toContain('Direct Quant/Tech Route');
    expect(result.plain_summary).toMatch(/Data Analyst|SQL|profile/i);
    expect(result.routes.length).toBeGreaterThan(0);
    expect(result.next_action.title).toMatch(/Portfolio|Dashboard|SQL/i);
  });

  it('correctly evaluates Backend Developer for BCA/computing background (Regression Scenario 3)', () => {
    const profile = {
      education: [{
        education_stage: 'HIGHER_EDUCATION',
        level: 'Undergraduate',
        degree: 'BCA',
        status: 'pursuing'
      }],
      skills: ['JavaScript', 'Node.js']
    };

    const result = evaluateGoalFeasibility(profile, { title: 'Backend Developer' });
    expect(result.four_dimensions.formal_eligibility.status).toBe('A');
    expect(result.overall_feasibility.status).toBe('HIGH_FEASIBILITY');
  });

  it('correctly evaluates Chef as recognized career with complete verified data (Regression Scenario 5)', () => {
    const profile = {
      education: [{
        education_stage: 'HIGHER_EDUCATION',
        level: 'Undergraduate',
        degree: 'B.Sc. Hospitality & Hotel Administration',
        status: 'completed'
      }]
    };

    const result = evaluateGoalFeasibility(profile, { title: 'Chef' });
    expect(result.four_dimensions.formal_eligibility.status).toBe('A');
    expect(result.four_dimensions.formal_eligibility.decision).toContain('Direct Culinary');
    expect(result.four_dimensions.formal_eligibility.cited_authorities.some(a => a.includes('NCHMCT'))).toBe(true);
    expect(result.sources.some(s => s.authority.includes('NCHMCT'))).toBe(true);
  });

  it('handles unknown or ambiguous career title without crashing or fabricating rules (Regression Scenario 7)', () => {
    const profile = {
      education: [{ degree: 'BCA' }]
    };

    const result = evaluateGoalFeasibility(profile, { title: 'Quantum Hologram Weaver' });
    expect(result.four_dimensions.formal_eligibility.status).toBe('E');
    expect(result.four_dimensions.formal_eligibility.decision).toBe('Verification Pending');
    expect(result.four_dimensions.ambition.selected_goal).toBe('Quantum Hologram Weaver');
    expect(result.routes.length).toBeGreaterThan(0);
  });

  it('handles discovery mode gracefully when no goal is selected', () => {
    const profile = {
      education: [{ degree: 'BCA' }]
    };

    const result = evaluateGoalFeasibility(profile, '');
    expect(result.overall_feasibility.status).toBe('DISCOVERY_MODE');
    expect(result.evaluation.direct_route_status).toBe('E');
    expect(result.goal_changed_by_engine).toBe(false);
  });
});
