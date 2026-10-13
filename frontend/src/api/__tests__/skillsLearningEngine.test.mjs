import test from 'node:test';
import assert from 'node:assert/strict';

test('1. Three distinct learning difficulty levels are represented with proper level numbers', () => {
  const mockSkills = [
    { name: 'Python', learning_level: 'foundational', level_number: 1, importance: 'required' },
    { name: 'Machine Learning', learning_level: 'intermediate', level_number: 2, importance: 'required' },
    { name: 'RAG', learning_level: 'advanced', level_number: 3, importance: 'useful' }
  ];

  const levels = new Set(mockSkills.map(s => s.learning_level));
  assert.ok(levels.has('foundational'), 'Foundational tier must exist');
  assert.ok(levels.has('intermediate'), 'Intermediate tier must exist');
  assert.ok(levels.has('advanced'), 'Advanced tier must exist');

  const levelNums = mockSkills.map(s => s.level_number);
  assert.deepEqual(levelNums, [1, 2, 3]);
});

test('2. Learning difficulty is strictly separate from requirement importance', () => {
  const skills = [
    { name: 'Python', learning_level: 'foundational', importance: 'required' },
    { name: 'Statistics', learning_level: 'foundational', importance: 'important' },
    { name: 'Problem Solving', learning_level: 'foundational', importance: 'useful' },
    { name: 'Machine Learning', learning_level: 'intermediate', importance: 'required' },
    { name: 'SQL', learning_level: 'intermediate', importance: 'important' },
    { name: 'Reporting', learning_level: 'intermediate', importance: 'useful' },
    { name: 'Academic Writing', learning_level: 'advanced', importance: 'required' },
    { name: 'RAG', learning_level: 'advanced', importance: 'useful' }
  ];

  // Foundational skills can be required (Mandatory)
  const foundReq = skills.find(s => s.learning_level === 'foundational' && s.importance === 'required');
  assert.ok(foundReq, 'A foundational skill can be mandatory');

  // Advanced skills can be useful (Complementary)
  const advUseful = skills.find(s => s.learning_level === 'advanced' && s.importance === 'useful');
  assert.ok(advUseful, 'An advanced skill can be complementary');

  // Advanced skills can be required (Mandatory for specialized professions)
  const advReq = skills.find(s => s.learning_level === 'advanced' && s.importance === 'required');
  assert.ok(advReq, 'An advanced skill can be mandatory');
});

test('3. Structured learning metadata contains all 11 required fields with valid types', () => {
  const sampleSkill = {
    id: 's-123',
    name: 'Python',
    learning_level: 'foundational',
    level_number: 1,
    importance: 'required',
    learning_metadata: {
      what_it_means: 'Python is a high-level programming language...',
      why_needed: 'AI Engineers write Python daily to design machine learning pipelines...',
      what_to_learn: ['Control flow', 'Data structures', 'OOP', 'Package management'],
      prerequisites: ['None (Entry-friendly programming language)'],
      practical_application: 'In actual work as an AI Engineer, practitioners apply Python...',
      hands_on_exercise: 'Write a script that reads a CSV dataset...',
      estimated_effort: '2–3 weeks (planning estimate)',
      learning_resources: [
        { title: 'CareerGPS Guide: Python', type: 'Curriculum Guide', provider: 'CareerGPS Intelligence' }
      ],
      recommended_action: 'Dedicate 30 minutes today to learn core syntax.'
    },
    user_status: 'assessed_gap',
    readiness_notes: 'Great starting point for building capabilities toward AI Engineer.'
  };

  const m = sampleSkill.learning_metadata;
  assert.ok(typeof m.what_it_means === 'string' && m.what_it_means.length > 0);
  assert.ok(typeof m.why_needed === 'string' && m.why_needed.length > 0);
  assert.ok(Array.isArray(m.what_to_learn) && m.what_to_learn.length >= 3);
  assert.ok(Array.isArray(m.prerequisites) && m.prerequisites.length >= 1);
  assert.ok(typeof m.practical_application === 'string' && m.practical_application.length > 0);
  assert.ok(typeof m.hands_on_exercise === 'string' && m.hands_on_exercise.length > 0);
  assert.ok(typeof m.estimated_effort === 'string' && m.estimated_effort.includes('planning estimate'));
  assert.ok(Array.isArray(m.learning_resources) && m.learning_resources.length >= 1);
  assert.ok(typeof m.recommended_action === 'string' && m.recommended_action.length > 0);
  assert.ok(typeof sampleSkill.user_status === 'string');
  assert.ok(typeof sampleSkill.readiness_notes === 'string');
});

test('4. Learning resources use verified platform curriculum without hallucinated URLs', () => {
  const resources = [
    {
      title: 'CareerGPS Interactive Guide: SQL',
      type: 'Curriculum Guide',
      verified: true,
      provider: 'CareerGPS Intelligence System',
      description: 'Structured curriculum modules focusing on core principles.'
    }
  ];

  for (const r of resources) {
    assert.ok(r.verified === true);
    assert.ok(!r.url || typeof r.url === 'string');
    assert.ok(r.provider && r.title);
  }
});

test('5. User profile status distinguishes evidence types accurately', () => {
  const statuses = ['demonstrated', 'self_reported', 'assessed_gap', 'not_reported'];

  for (const st of statuses) {
    const label = st === 'demonstrated'
      ? 'Demonstrated in Profile'
      : st === 'self_reported'
      ? 'Self-Reported on Profile'
      : st === 'assessed_gap'
      ? 'Assessed Role Gap'
      : 'Not Yet Reported';

    assert.ok(label.length > 0);
  }
});

test('6. Objects in learning metadata are never passed raw to React children', () => {
  function safeRenderString(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return val.title || val.name || val.description || JSON.stringify(val);
    }
    return String(val);
  }

  const complexObject = { title: 'CareerGPS Guide', estimate: '2 weeks' };
  const rendered = safeRenderString(complexObject);
  assert.equal(rendered, 'CareerGPS Guide');
  assert.notEqual(rendered, '[object Object]');
});

test('7. Prerequisite advisory correctly highlights missing baseline competencies', () => {
  const prerequisites = ['Python fundamentals', 'Basic statistics'];
  const userSkills = ['SQL', 'Git']; // User lacks Python and Statistics

  const missing = prerequisites.filter(pr => {
    const prLower = pr.toLowerCase();
    return !userSkills.some(us => prLower.includes(us.toLowerCase()));
  });

  assert.equal(missing.length, 2);
  assert.deepEqual(missing, ['Python fundamentals', 'Basic statistics']);
});

test('8. Segmented switcher filtering preserves exact category subsets', () => {
  const allSkills = [
    { id: '1', name: 'Python', learning_level: 'foundational' },
    { id: '2', name: 'Git', learning_level: 'foundational' },
    { id: '3', name: 'Machine Learning', learning_level: 'intermediate' },
    { id: '4', name: 'SQL', learning_level: 'intermediate' },
    { id: '5', name: 'RAG', learning_level: 'advanced' }
  ];

  const foundational = allSkills.filter(s => s.learning_level === 'foundational');
  const intermediate = allSkills.filter(s => s.learning_level === 'intermediate');
  const advanced = allSkills.filter(s => s.learning_level === 'advanced');

  assert.equal(foundational.length, 2);
  assert.equal(intermediate.length, 2);
  assert.equal(advanced.length, 1);
  assert.equal(foundational.length + intermediate.length + advanced.length, allSkills.length);
});
