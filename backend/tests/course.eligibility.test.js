import { describe, it, expect } from 'vitest';
import { evaluateCourseEligibility } from '../src/modules/courses/course.eligibility.js';

describe('Course Eligibility Engine', () => {
  it('should evaluate B.Com -> M.Com as Eligible', () => {
    const course = { title: 'M.Com', qualification: 'PG' };
    const profile = { education: [{ level: 'Undergraduate', degree: 'B.Com' }] };
    const result = evaluateCourseEligibility(course, profile);
    expect(result.outcome).to.equal('Eligible');
    expect(result.matched_requirements.length).to.be.greaterThan(0);
    expect(result.rule_source).to.equal('UNIVERSITY_GRANTS_COMMISSION_MCOM');
  });

  it('should evaluate B.Com -> M.Tech as Not Eligible under verified rules', () => {
    const course = { title: 'M.Tech', qualification: 'PG' };
    const profile = { education: [{ level: 'Undergraduate', degree: 'B.Com' }] };
    const result = evaluateCourseEligibility(course, profile);
    expect(result.outcome).to.equal('Not Eligible under verified rules');
  });

  it('should evaluate BCA -> MCA as Conditionally Eligible', () => {
    const course = { title: 'MCA', qualification: 'PG' };
    const profile = { education: [{ level: 'Undergraduate', degree: 'BCA' }] };
    const result = evaluateCourseEligibility(course, profile);
    expect(result.outcome).to.equal('Conditionally Eligible');
    expect(result.entrance_exam).to.include('NIMCET');
  });

  it('should evaluate B.Tech -> M.Tech as Conditionally Eligible', () => {
    const course = { title: 'M.Tech', qualification: 'PG' };
    const profile = { education: [{ level: 'Undergraduate', degree: 'B.Tech in CS' }] };
    const result = evaluateCourseEligibility(course, profile);
    expect(result.outcome).to.equal('Conditionally Eligible');
    expect(result.entrance_exam).to.include('GATE');
  });

  it('should evaluate 12th Science PCM -> B.Tech as Conditionally Eligible', () => {
    const course = { title: 'B.Tech in CS', qualification: 'UG' };
    const profile = { education: [{ education_stage: 'SCHOOL_12', school_12_stream: 'Science — PCM' }] };
    const result = evaluateCourseEligibility(course, profile);
    expect(result.outcome).to.equal('Conditionally Eligible');
    expect(result.missing_information).to.include('Entrance exam score (JEE/CET)');
  });

  it('should evaluate 12th Arts -> B.Tech as Not Eligible under verified rules', () => {
    const course = { title: 'B.Tech in CS', qualification: 'UG' };
    const profile = { education: [{ education_stage: 'SCHOOL_12', school_12_stream: 'Arts / Humanities' }] };
    const result = evaluateCourseEligibility(course, profile);
    expect(result.outcome).to.equal('Not Eligible under verified rules');
  });

  it('should evaluate missing 12th data for B.Tech as Unable to Determine', () => {
    const course = { title: 'B.Tech in CS', qualification: 'UG' };
    const profile = { education: [] };
    const result = evaluateCourseEligibility(course, profile);
    expect(result.outcome).to.equal('Unable to Determine');
  });

  it('should evaluate BCA -> M.Tech as Potentially Eligible / Verify', () => {
    const course = { title: 'M.Tech', qualification: 'PG' };
    const profile = { education: [{ level: 'Undergraduate', degree: 'BCA' }] };
    const result = evaluateCourseEligibility(course, profile);
    expect(result.outcome).to.equal('Potentially Eligible / Verify');
  });

  it('should evaluate B.Sc Mathematics -> M.Sc Mathematics as Eligible if marks >= 50', () => {
    const course = { title: 'M.Sc Mathematics', qualification: 'PG' };
    const profile = { education: [{ level: 'Undergraduate', degree: 'B.Sc Mathematics', marks: 55 }] };
    const result = evaluateCourseEligibility(course, profile);
    expect(result.outcome).to.equal('Eligible');
    expect(result.matched_requirements).to.include('Minimum 50% aggregate marks');
  });

  it('should evaluate B.Sc Mathematics -> M.Sc Mathematics as Not Eligible under verified rules if marks < 50', () => {
    const course = { title: 'M.Sc Mathematics', qualification: 'PG' };
    const profile = { education: [{ level: 'Undergraduate', degree: 'B.Sc Mathematics', marks: 45 }] };
    const result = evaluateCourseEligibility(course, profile);
    expect(result.outcome).to.equal('Not Eligible under verified rules');
    expect(result.unmet_requirements.length).to.be.greaterThan(0);
  });

  it('should evaluate B.Com -> MBA as Conditionally Eligible if marks >= 50', () => {
    const course = { title: 'MBA', qualification: 'PG' };
    const profile = { education: [{ level: 'Undergraduate', degree: 'B.Com', marks: 60 }] };
    const result = evaluateCourseEligibility(course, profile);
    expect(result.outcome).to.equal('Conditionally Eligible');
    expect(result.entrance_exam).to.include('CAT');
  });
});
