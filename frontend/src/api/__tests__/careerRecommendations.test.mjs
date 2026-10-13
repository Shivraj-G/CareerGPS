import test from 'node:test';
import assert from 'node:assert/strict';

function normalizeRecommendationResult(r) {
  return {
    careerId: r.career_id ?? r.careerId ?? r.id ?? null,
    aiCareerId: r.ai_career_id ?? r.aiCareerId ?? null,
    title: r.title ?? r.career_title ?? r.name ?? "Recommended career",
    reasoning: r.reasoning ?? r.explanation ?? r.why ?? "",
    matchScore: r.match_score ?? r.matchScore ?? r.score ?? null,
    missingSkills: r.missing_skills ?? r.skill_gaps ?? r.gaps ?? [],
    matchedSkills: r.matched_skills ?? r.matchedSkills ?? [],
    matchType: r.match_type ?? r.matchType ?? 'related',
    source: r.source ?? 'database',
    verified: r.verified ?? true,
  };
}

test('normalizeRecommendationResult parses standard database recommendation', () => {
  const raw = {
    career_id: 'c123',
    title: 'Data Analyst',
    reasoning: 'Direct match for your stated ambition of Data Analyst.',
    match_score: 95,
    matched_skills: ['SQL', 'Python'],
    missing_skills: ['Power BI', 'Statistics'],
    match_type: 'direct',
    source: 'database',
    verified: true
  };

  const normalized = normalizeRecommendationResult(raw);
  assert.equal(normalized.careerId, 'c123');
  assert.equal(normalized.title, 'Data Analyst');
  assert.equal(normalized.matchScore, 95);
  assert.equal(normalized.matchType, 'direct');
  assert.equal(normalized.source, 'database');
  assert.equal(normalized.verified, true);
  assert.deepEqual(normalized.matchedSkills, ['SQL', 'Python']);
  assert.deepEqual(normalized.missingSkills, ['Power BI', 'Statistics']);
});

test('normalizeRecommendationResult handles AI-suggested novel career safely', () => {
  const rawAi = {
    career_id: null,
    ai_career_id: 'ai-456',
    title: 'Health Informatics Specialist',
    reasoning: 'AI-suggested alternative pathway bridging healthcare and data tech.',
    score: 65,
    missing_skills: ['HL7', 'FHIR'],
    match_type: 'pathway',
    source: 'ai_database',
    verified: false
  };

  const normalized = normalizeRecommendationResult(rawAi);
  assert.equal(normalized.careerId, null);
  assert.equal(normalized.aiCareerId, 'ai-456');
  assert.equal(normalized.title, 'Health Informatics Specialist');
  assert.equal(normalized.matchScore, 65);
  assert.equal(normalized.matchType, 'pathway');
  assert.equal(normalized.source, 'ai_database');
  assert.equal(normalized.verified, false);
});

test('normalizeRecommendationResult handles empty/sparse object without throwing', () => {
  const sparse = {};
  const normalized = normalizeRecommendationResult(sparse);
  assert.equal(normalized.title, 'Recommended career');
  assert.equal(normalized.careerId, null);
  assert.equal(normalized.matchScore, null);
  assert.deepEqual(normalized.matchedSkills, []);
  assert.deepEqual(normalized.missingSkills, []);
});

test('groups separate direct matches from related and alternative pathways', () => {
  const results = [
    { title: 'Data Analyst', match_type: 'direct', match_score: 95 },
    { title: 'Data Scientist', match_type: 'related', match_score: 78 },
    { title: 'Business Analyst', match_type: 'related', match_score: 75 },
    { title: 'Backend Developer', match_type: 'pathway', match_score: 35 }
  ].map(normalizeRecommendationResult);

  const direct = results.filter(r => r.matchType === 'direct');
  const related = results.filter(r => r.matchType === 'related');
  const pathway = results.filter(r => r.matchType === 'pathway');

  assert.equal(direct.length, 1);
  assert.equal(direct[0].title, 'Data Analyst');
  assert.equal(related.length, 2);
  assert.equal(pathway.length, 1);
  assert.equal(pathway[0].title, 'Backend Developer');
});
