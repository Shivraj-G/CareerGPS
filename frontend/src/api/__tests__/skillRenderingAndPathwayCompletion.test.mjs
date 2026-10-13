import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../client.js';
import { formatSkillDisplayName, getSkillViewModel } from '../../utils/skillDisplay.js';

test('Skill Rendering Safety — Fix React Child Crash', async (t) => {
  await t.test('1. Normalizes exact object from console crash into safe renderable view model', () => {
    const errorObject = {
      skill_id: 'sk_ai_001',
      skill_name: 'Prompt Engineering & LLM APIs',
      category: 'AI / Machine Learning',
      self_rating: 4,
      level: 'Advanced',
      verified: true,
      evidence_type: 'project_submission',
      evidence_notes: 'Verified via LangChain & OpenAI API project',
      updated_at: '2026-10-12T14:30:00Z'
    };

    const vm = getSkillViewModel(errorObject);
    assert.equal(vm.id, 'sk_ai_001', 'Uses stable skill_id');
    assert.equal(vm.name, 'Prompt Engineering & LLM APIs');
    assert.equal(typeof vm.name, 'string');
    assert.equal(vm.verified, true);

    const displayName = formatSkillDisplayName(errorObject);
    assert.equal(displayName, 'Prompt Engineering & LLM APIs');
    assert.equal(typeof displayName, 'string');
    // Ensure it NEVER returns an object that would crash React JSX children
    assert.notEqual(typeof displayName, 'object');
  });

  await t.test('2. Handles null, undefined, empty, and partial skill objects', () => {
    // Null
    assert.equal(formatSkillDisplayName(null), 'General Competency');
    assert.equal(typeof formatSkillDisplayName(null), 'string');

    // Undefined
    assert.equal(formatSkillDisplayName(undefined), 'General Competency');

    // Object with only category
    const catOnly = { category: 'Geospatial' };
    assert.equal(formatSkillDisplayName(catOnly), 'Geospatial Skill');

    // Object with blank name
    const blankObj = { skill_name: '   ', category: '' };
    assert.equal(formatSkillDisplayName(blankObj), 'Competency');

    // Plain string
    assert.equal(formatSkillDisplayName('PostgreSQL'), 'PostgreSQL');

    // Object with legacy 'name' instead of 'skill_name'
    assert.equal(formatSkillDisplayName({ name: 'Docker' }), 'Docker');
  });

  await t.test('3. Generates unique stable keys for rendering list items', () => {
    const skills = [
      { skill_id: 's1', skill_name: 'Python' },
      { id: 's2', name: 'SQL' },
      { skill_name: 'Git' }
    ];

    const vms = skills.map((s, idx) => getSkillViewModel(s, idx));
    assert.equal(vms[0].id, 's1');
    assert.equal(vms[1].id, 's2');
    assert.equal(vms[2].id, 'skill-obj-2');
  });
});

test('Pathway Completion API Client Functions', async (t) => {
  await t.test('1. api.completePathway and api.completePathwayStep are defined', () => {
    assert.equal(typeof api.completePathway, 'function');
    assert.equal(typeof api.completePathwayStep, 'function');
  });
});

test('Project Studio Recommendations Parsing & Tier Filtering', async (t) => {
  await t.test('1. Extracts projects from backend envelope shape { data: { projects: [...] } }', () => {
    const backendRes = {
      data: {
        career_id: 'career_123',
        career_title: 'AI Engineer',
        levels: {
          level_1_starter: [],
          level_2_practical: [],
          level_3_career_ready: []
        },
        projects: [
          { id: 'p1', title: 'Starter AI', difficulty_level: 1, difficulty_label: 'Starter' },
          { id: 'p2', title: 'Practical ML', difficulty_level: 2, difficulty_label: 'Practical' },
          { id: 'p3', title: 'Career-Ready LLM', difficulty_level: 3, difficulty_label: 'Career-Ready' }
        ]
      }
    };

    // Simulate loadRecommendations parser
    const rawProjects = backendRes?.data?.projects || backendRes?.projects || (Array.isArray(backendRes?.data) ? backendRes.data : []);
    assert.equal(rawProjects.length, 3);

    const normalized = rawProjects.map(p => {
      const levelNum = Number(p.tier || p.difficulty_level) || 1;
      return {
        ...p,
        tier: levelNum,
        difficulty_level: levelNum
      };
    });

    // Test tier filtering
    const all = normalized.filter(p => true);
    assert.equal(all.length, 3);

    const starter = normalized.filter(p => p.tier === 1);
    assert.equal(starter.length, 1);
    assert.equal(starter[0].title, 'Starter AI');

    const practical = normalized.filter(p => p.tier === 2);
    assert.equal(practical.length, 1);
    assert.equal(practical[0].title, 'Practical ML');

    const capstone = normalized.filter(p => p.tier === 3);
    assert.equal(capstone.length, 1);
    assert.equal(capstone[0].title, 'Career-Ready LLM');
  });
});
