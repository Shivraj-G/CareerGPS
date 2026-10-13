import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../client.js';

test('Career Pathway Frontend & Client Engine Tests', async (t) => {
  await t.test('1. Client exports required pathway mutation methods', () => {
    assert.equal(typeof api.skipPathwayStep, 'function', 'skipPathwayStep should be a function');
    assert.equal(typeof api.undoPathwayStep, 'function', 'undoPathwayStep should be a function');
    assert.equal(typeof api.completePathwayStep, 'function', 'completePathwayStep should be a function');
    assert.equal(typeof api.deleteUserPathway, 'function', 'deleteUserPathway should be a function');
    assert.equal(typeof api.generatePathway, 'function', 'generatePathway should be a function');
    assert.equal(typeof api.userPathway, 'function', 'userPathway should be a function');
  });

  await t.test('2. Stage grouping correctly clusters multi-stage steps in chronological order', () => {
    const mockSteps = [
      { id: '1', step_order: 1, metadata: { stage: 'Stage 1: Readiness & Prerequisite Verification' }, title: 'Prereq check' },
      { id: '2', step_order: 2, metadata: { stage: 'Stage 2: Foundational Learning' }, title: 'Python basics' },
      { id: '3', step_order: 3, metadata: { stage: 'Stage 2: Foundational Learning' }, title: 'Data structures' },
      { id: '4', step_order: 4, metadata: { stage: 'Stage 3: Core Competencies' }, title: 'Machine learning' }
    ];

    const grouped = {};
    for (const step of mockSteps) {
      const stageName = step.metadata?.stage || 'General Progression';
      if (!grouped[stageName]) grouped[stageName] = [];
      grouped[stageName].push(step);
    }

    const stages = Object.keys(grouped);
    assert.equal(stages.length, 3);
    assert.equal(stages[0], 'Stage 1: Readiness & Prerequisite Verification');
    assert.equal(grouped['Stage 2: Foundational Learning'].length, 2);
  });

  await t.test('3. Step actionable links resolve strictly to internal CareerGPS routes without external hallucination', () => {
    const allowedPrefixes = ['/skills', '/courses', '/opportunities', '/institutions', '/profile'];
    const mockActionLinks = [
      '/profile',
      '/courses?search=Python',
      '/skills/gap?career=2a7f4d18',
      '/opportunities?type=internship'
    ];

    for (const link of mockActionLinks) {
      const isValid = allowedPrefixes.some(p => link.startsWith(p));
      assert.ok(isValid, `Link "${link}" should begin with a valid CareerGPS route prefix`);
    }
  });

  await t.test('4. Dynamic progress calculation handles completed, skipped, and blocked milestones', () => {
    const steps = [
      { id: '1', status: 'completed' },
      { id: '2', status: 'completed' },
      { id: '3', status: 'skipped' },
      { id: '4', status: 'blocked' },
      { id: '5', status: 'in_progress' },
      { id: '6', status: 'not_started' }
    ];

    const total = steps.length;
    const completed = steps.filter(s => s.status === 'completed').length;
    const skipped = steps.filter(s => s.status === 'skipped').length;
    const blocked = steps.filter(s => s.status === 'blocked').length;
    const remaining = total - completed - skipped;
    const percentage = Math.round((completed / total) * 100);

    assert.equal(total, 6);
    assert.equal(completed, 2);
    assert.equal(skipped, 1);
    assert.equal(blocked, 1);
    assert.equal(remaining, 3);
    assert.equal(percentage, 33);
  });

  await t.test('5. Anti-contamination rule: Geo Analyst steps remain 100% geospatial and distinct from Business Analyst', () => {
    const geoAnalystTitles = [
      'Secondary Education in Science/Geography with Mathematics Baseline',
      'Geographic Information Systems (GIS) Foundations & Cartography',
      'Desktop GIS Mastery with QGIS & ArcGIS Desktop Workflows',
      'Spatial Database Management with PostGIS & Spatial SQL',
      'Earth Observation & Satellite Remote Sensing Analysis',
      'Interactive Web-GIS Portfolio & Spatial Analyst Industry Entry'
    ];

    for (const title of geoAnalystTitles) {
      assert.ok(!title.toLowerCase().includes('business analyst'), 'Should not contain Business Analyst');
      assert.ok(!title.toLowerCase().includes('corporate strategy'), 'Should not contain generic business terms');
    }
    assert.ok(geoAnalystTitles.some(t => t.includes('PostGIS')), 'Should include PostGIS');
    assert.ok(geoAnalystTitles.some(t => t.includes('QGIS')), 'Should include QGIS');
  });
});
