import { describe, it, expect } from 'vitest';
import { getEligibleMasterPrograms } from '../src/modules/education/education.service.js';

describe('Education Service - Master Programs Mapping', () => {
  it('should map BCA to Computing and Business Analytics', () => {
    const programs = getEligibleMasterPrograms('BCA');
    const disciplines = new Set(programs.map(p => p.discipline));
    
    expect(disciplines.has('Computing & Emerging Tech')).toBe(true);
    expect(disciplines.has('Business & Management')).toBe(true);
    
    const programNames = programs.map(p => p.program);
    expect(programNames).toContain('MCA');
    expect(programNames).toContain('M.Sc Computer Science');
    expect(programNames).toContain('MBA Business Analytics');
  });

  it('should map B.Com to Commerce and Finance', () => {
    const programs = getEligibleMasterPrograms('B.Com');
    const programNames = programs.map(p => p.program);
    
    expect(programNames).toContain('M.Com');
    expect(programNames).toContain('M.Com Finance');
    expect(programNames).toContain('MA Economics');
    expect(programNames).toContain('Master of Financial Management');
  });

  it('should map B.Tech CSE to Engineering and Computing', () => {
    const programs = getEligibleMasterPrograms('B.Tech CSE');
    const disciplines = new Set(programs.map(p => p.discipline));
    
    expect(disciplines.has('Engineering & Technology')).toBe(true);
    expect(disciplines.has('Computing & Emerging Tech')).toBe(true);
  });

  it('should map B.Sc Mathematics to Math, Stats, Data Science, and MCA', () => {
    const programs = getEligibleMasterPrograms('B.Sc Mathematics');
    const programNames = programs.map(p => p.program);
    
    expect(programNames).toContain('M.Sc Mathematics');
    expect(programNames).toContain('M.Sc Statistics');
    expect(programNames).toContain('M.Sc Data Science');
    expect(programNames).toContain('MCA');
    expect(programNames).toContain('M.Sc Economics');
  });

  it('should fallback to basic Humanities/Management for unknown degrees', () => {
    const programs = getEligibleMasterPrograms('B.Unknown');
    const disciplines = new Set(programs.map(p => p.discipline));
    
    expect(disciplines.has('Arts & Humanities')).toBe(true);
    expect(disciplines.has('Business & Management')).toBe(true);
  });

  it('should return empty array for empty input', () => {
    expect(getEligibleMasterPrograms('')).toEqual([]);
    expect(getEligibleMasterPrograms(null)).toEqual([]);
  });
});
