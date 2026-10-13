import { describe, expect, it } from 'vitest';
import {
  calculateGoalRelevance,
  calculateSkillRelevance,
  calculateEducationRelevance,
  resolveUserGoal,
  getDatabaseRecommendations
} from '../src/modules/recommendations/recommendation.service.js';
import { pool } from '../src/config/database.js';

describe('Goal-Aware Career Recommendation Pipeline', () => {
  it('Scenario 1: Data Analyst goal matches exact catalogue record and outranks generic software engineering', async () => {
    // Exact title match
    const daRel = calculateGoalRelevance('Data Analyst', 'Data Analyst');
    expect(daRel.matchType).toBe('direct');
    expect(daRel.score).toBe(100);

    // Backend developer evaluated against Data Analyst goal
    const backendRel = calculateGoalRelevance('Backend Developer', 'Data Analyst');
    expect(backendRel.matchType).not.toBe('direct');
    expect(backendRel.score).toBeLessThan(daRel.score);

    // Business Analyst evaluated against Data Analyst
    const baRel = calculateGoalRelevance('Business Analyst', 'Data Analyst');
    expect(baRel.matchType).toBe('related');
    expect(baRel.score).toBeGreaterThan(backendRel.score);
  });

  it('Scenario 2: Data Analytics alias maps accurately to direct match', () => {
    const aliasRel = calculateGoalRelevance('Data Analyst', 'Data Analytics');
    expect(aliasRel.matchType).toBe('direct');
    expect(aliasRel.score).toBeGreaterThanOrEqual(90);

    const biRel = calculateGoalRelevance('Data Analyst', 'Business Data Analyst');
    expect(biRel.matchType).toBe('direct');
    expect(biRel.score).toBeGreaterThanOrEqual(85);
  });

  it('Scenario 3: Goal with sparse catalogue coverage (Doctor) prioritizes medical roles over software roles', () => {
    const docRel = calculateGoalRelevance('Doctor', 'Doctor');
    const surgRel = calculateGoalRelevance('Surgeon', 'Doctor');
    const devRel = calculateGoalRelevance('Full Stack Developer', 'Doctor');

    expect(docRel.matchType).toBe('direct');
    expect(surgRel.matchType).toBe('related');
    expect(devRel.matchType).toBe('unrelated');
    expect(devRel.score).toBe(0);
  });

  it('Scenario 4: Goal match dominates over generic skill overlap (Python, SQL)', () => {
    // User with Python & SQL
    const userSkills = [
      { id: '1', name: 'Python' },
      { id: '2', name: 'SQL' },
      { id: '3', name: 'Problem Solving' }
    ];

    const dataAnalystReqs = [
      { name: 'SQL', importance: 'required' },
      { name: 'Python', importance: 'required' },
      { name: 'Power BI', importance: 'required' },
      { name: 'Statistics', importance: 'required' }
    ];

    const backendReqs = [
      { name: 'Python', importance: 'required' },
      { name: 'SQL', importance: 'required' },
      { name: 'Docker', importance: 'required' },
      { name: 'PostgreSQL', importance: 'required' }
    ];

    const daSkills = calculateSkillRelevance(dataAnalystReqs, userSkills);
    const backendSkills = calculateSkillRelevance(backendReqs, userSkills);

    // Both match SQL & Python (~50% skill score)
    expect(daSkills.matchedSkills.map(s => s.name)).toContain('Python');
    expect(daSkills.matchedSkills.map(s => s.name)).toContain('SQL');

    // Goal scoring ensures Data Analyst wins for a Data Analyst goal
    const daGoal = calculateGoalRelevance('Data Analyst', 'Data Analyst');
    const backendGoal = calculateGoalRelevance('Backend Developer', 'Data Analyst');

    const daComposite = Math.round(daGoal.score * 0.55 + daSkills.skillScore * 0.35 + 70 * 0.10);
    const backendComposite = Math.round(backendGoal.score * 0.55 + backendSkills.skillScore * 0.35 + 70 * 0.10);

    expect(daComposite).toBeGreaterThan(backendComposite + 20);
  });

  it('Scenario 5: Empty skills profile handles safely with neutral baseline and goal prioritization', () => {
    const emptySkills = calculateSkillRelevance([], []);
    expect(emptySkills.skillScore).toBe(50);
    expect(emptySkills.matchedSkills).toEqual([]);
    expect(emptySkills.missingSkills).toEqual([]);

    const daRel = calculateGoalRelevance('Data Analyst', 'Data Analyst');
    expect(daRel.matchType).toBe('direct');
  });

  it('Scenario 6: Current Goal resolution extracts from object or string', () => {
    const profileWithObj = {
      current_goal: { title: 'Data Analyst', status: 'Active' },
      career_goal: 'Doctor'
    };
    expect(resolveUserGoal(profileWithObj, null)).toBe('Data Analyst');

    const profileWithString = {
      current_goal: JSON.stringify({ title: 'AI Engineer' }),
      career_goal: 'Doctor'
    };
    expect(resolveUserGoal(profileWithString, null)).toBe('AI Engineer');

    const profileWithLegacy = {
      current_goal: null,
      career_goal: 'Cybersecurity Analyst'
    };
    expect(resolveUserGoal(profileWithLegacy, null)).toBe('Cybersecurity Analyst');

    // Explicit override takes precedence
    expect(resolveUserGoal(profileWithObj, 'Civil Engineer')).toBe('Civil Engineer');
  });

  it('Scenario 7: Goal unrelated to user degree is preserved and reflects educational gap', () => {
    const userEducation = [
      { degree: 'BA English', stream: 'Arts', level: 'Undergraduate' }
    ];
    const techQualifications = ['B.E. Computer Science', 'BCA', 'MCA', 'B.Sc. IT'];

    const eduScore = calculateEducationRelevance(techQualifications, userEducation);
    expect(eduScore).toBe(65); // Lower than degree match (90), but doesn't block recommendation
  });

  it('Scenario 8: Live PostgreSQL database retrieval correctly returns Data Analyst as top direct match', async () => {
    const userRes = await pool.query(`SELECT id FROM users LIMIT 1`);
    if (!userRes.rows.length) return;
    const userId = userRes.rows[0].id;

    const result = await getDatabaseRecommendations(userId, 'Data Analyst', { limit: 10 });
    expect(result.goal).toBe('Data Analyst');
    expect(result.results.length).toBeGreaterThan(0);

    // Top result is Data Analyst
    expect(result.results[0].title).toBe('Data Analyst');
    expect(result.results[0].match_type).toBe('direct');
    expect(result.results[0].source).toBe('database');
    expect(result.results[0].verified).toBe(true);

    // Grouping
    expect(result.groups.direct_matches.some(c => c.title === 'Data Analyst')).toBe(true);
    expect(result.groups.related_careers.length).toBeGreaterThan(0);
    // Related data careers are present
    const relatedTitles = result.groups.related_careers.map(c => c.title);
    expect(relatedTitles).toContain('Business Analyst');
    expect(relatedTitles).toContain('Data Scientist');
  });

  it('Scenario 9: Current Goal changes dynamically re-center recommendations', async () => {
    const userRes = await pool.query(`SELECT id FROM users LIMIT 1`);
    if (!userRes.rows.length) return;
    const userId = userRes.rows[0].id;

    const devResult = await getDatabaseRecommendations(userId, 'Backend Developer', { limit: 5 });
    expect(devResult.results[0].title).toBe('Backend Developer');
    expect(devResult.results[0].match_type).toBe('direct');

    const docResult = await getDatabaseRecommendations(userId, 'Doctor', { limit: 5 });
    expect(docResult.results[0].title).toBe('Doctor');
    expect(docResult.results[0].match_type).toBe('direct');
  });
});
