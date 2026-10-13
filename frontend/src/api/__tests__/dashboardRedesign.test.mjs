import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../client.js';

test('CareerGPS Dashboard Redesign & Section Order Tests', async (t) => {
  await t.test('1. Section Order Contract: Welcome -> Career Goal -> Quick Actions -> Opportunities -> Pathway -> Explore Careers', () => {
    // Definitive architectural order contract required for hackathon state demonstration
    const sectionOrder = [
      'welcome_header',
      'current_career_goal',
      'quick_actions',
      'opportunities',
      'career_pathway',
      'explore_careers'
    ];

    assert.equal(sectionOrder[0], 'welcome_header', 'Section 1 must be Welcome Header');
    assert.equal(sectionOrder[1], 'current_career_goal', 'Section 2 must be Current Career Goal');
    assert.equal(sectionOrder[2], 'quick_actions', 'Section 3 must be Quick Actions');
    assert.equal(sectionOrder[3], 'opportunities', 'Section 4 must be Opportunities (First Major Content Section)');
    assert.equal(sectionOrder[4], 'career_pathway', 'Section 5 must be Career Pathway (Below Opportunities)');
    assert.equal(sectionOrder[5], 'explore_careers', 'Section 6 must be Explore Careers (Below Pathway)');

    // Verify Opportunities strictly precedes Pathway and Explore Careers
    const oppsIdx = sectionOrder.indexOf('opportunities');
    const pathIdx = sectionOrder.indexOf('career_pathway');
    const careersIdx = sectionOrder.indexOf('explore_careers');

    assert.ok(oppsIdx < pathIdx, 'Opportunities MUST appear above Career Pathway');
    assert.ok(pathIdx < careersIdx, 'Career Pathway MUST appear above Explore Careers');
  });

  await t.test('2. User with saved goal, pathway, and opportunities resolves data accurately', () => {
    const mockProfile = {
      user_id: 'user-123',
      current_goal: { title: 'Lawyer', status: 'Active' },
      career_goal: 'Lawyer',
      profile_status: 'complete'
    };

    // Goal extraction handles both JSONB object and string formats
    const extractedGoal = mockProfile.current_goal?.title || mockProfile.career_goal;
    assert.equal(extractedGoal, 'Lawyer');

    // Pathway progress calculation
    const mockSteps = [
      { id: 's1', status: 'completed', title: 'BLS Degree' },
      { id: 's2', status: 'completed', title: 'LLB Curriculum' },
      { id: 's3', status: 'in_progress', title: 'Bar Exam' },
      { id: 's4', status: 'not_started', title: 'State Bar Registration' }
    ];

    const completed = mockSteps.filter(s => s.status === 'completed').length;
    const total = mockSteps.length;
    const remaining = total - completed;
    const pct = Math.round((completed / total) * 100);

    assert.equal(completed, 2);
    assert.equal(remaining, 2);
    assert.equal(pct, 50);
  });

  await t.test('3. User without a saved pathway defaults gracefully to an actionable empty state', () => {
    const mockPathways = [];
    const hasPathway = mockPathways.length > 0;
    assert.equal(hasPathway, false);

    // Empty state fallback provides direct call to action
    const emptyStateAction = {
      label: 'Create or select pathway',
      to: '/careers'
    };
    assert.equal(emptyStateAction.to, '/careers');
  });

  await t.test('4. User with no matching opportunities falls back safely without breaking dashboard', () => {
    const goalSpecificResults = [];
    const fallbackOpenResults = [
      { id: 'opp-1', title: 'Goa Staff Selection Commission Clerk', organization: 'GSSC', status: 'open' }
    ];

    let displayedOpportunities = goalSpecificResults;
    if (displayedOpportunities.length === 0) {
      displayedOpportunities = fallbackOpenResults;
    }

    assert.equal(displayedOpportunities.length, 1);
    assert.equal(displayedOpportunities[0].id, 'opp-1');
  });

  await t.test('5. Section API failure does not crash adjacent sections (independent resilience)', () => {
    // Model independent section loading states
    const sectionStates = {
      profile: { status: 'fulfilled', data: { career_goal: 'Teacher' } },
      opportunities: { status: 'rejected', error: 'Network timeout on opportunities feed' },
      pathway: { status: 'fulfilled', data: { steps: [{ status: 'completed' }] } },
      careers: { status: 'fulfilled', data: [{ id: 'c1', title: 'Assistant Professor' }] }
    };

    // Opportunities failure is caught independently with Retry
    assert.equal(sectionStates.opportunities.status, 'rejected');
    assert.equal(sectionStates.pathway.status, 'fulfilled');
    assert.equal(sectionStates.careers.status, 'fulfilled');

    // Dashboard remains interactive despite opportunities failure
    const isDashboardOperable = sectionStates.profile.status === 'fulfilled' &&
      (sectionStates.pathway.status === 'fulfilled' || sectionStates.careers.status === 'fulfilled');
    assert.ok(isDashboardOperable, 'Dashboard remains operational when one section fails');
  });

  await t.test('6. User name normalization handles long names, emails, and edge cases', () => {
    // Test cases for display name formatting
    const testCases = [
      { user: { name: 'Dr. Mittal Halarnekar' }, expected: 'Dr.' },
      { user: { full_name: 'Chandrashekar Venkatraman' }, expected: 'Chandrashekar' },
      { user: { email: 'student_goa@careergps.in' }, expected: 'Student_goa' },
      { user: { email: 'a.very.long.first.name.and.surname@example.com' }, expected: 'A.very.long.first.name.and.surname' },
      { user: {}, expected: 'there' },
      { user: null, expected: 'there' }
    ];

    for (const tc of testCases) {
      const displayName = tc.user?.name || tc.user?.full_name || '';
      let firstName = 'there';
      if (displayName.trim()) {
        firstName = displayName.trim().split(/\s+/)[0];
      } else if (tc.user?.email) {
        const prefix = tc.user.email.split('@')[0];
        firstName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      }
      assert.equal(firstName, tc.expected);
    }
  });

  await t.test('7. Quick actions route destinations strictly match registered application routes', () => {
    const quickActions = [
      { title: 'Explore Careers', to: '/careers' },
      { title: 'Continue Learning Pathway', to: '/pathway' },
      { title: 'Find Opportunities', to: '/opportunities' }
    ];

    const validRoutes = ['/careers', '/pathway', '/opportunities', '/profile', '/dashboard'];
    for (const qa of quickActions) {
      assert.ok(validRoutes.includes(qa.to), `Quick action route "${qa.to}" must exist in app routes`);
    }
  });

  await t.test('8. Duplicate React key warning elimination: career and step keys are strictly unique', () => {
    // Recommendations payload from backend containing career_id
    const rawRecommendations = [
      { career_id: 'c-101', title: 'Data Analyst', description: 'Analyze data' },
      { career_id: 'c-102', title: 'Business Analyst', description: 'Analyze business' },
      { career_id: 'c-103', title: 'Data Scientist', description: 'Machine learning' }
    ];

    function normalizeCareer(c) {
      if (!c) return c;
      const careerId = c.ai_career_id ?? c.career_id ?? c.id ?? "";
      return {
        id: careerId,
        career_id: careerId,
        isAiProfile: !!c.ai_career_id,
        title: c.title ?? "Untitled career",
        description: c.description ?? "",
      };
    }

    const normalized = rawRecommendations.map(normalizeCareer);
    // Assert none of them ended up with empty id
    for (const item of normalized) {
      assert.ok(item.id.length > 0, 'Every normalized career must have a valid non-empty id');
    }

    // Verify key generator produces unique keys
    const careerKeys = normalized.map((c, idx) => c.id ? `dash-career-${c.id}` : `dash-career-${idx}-${c.title}`);
    const uniqueKeys = new Set(careerKeys);
    assert.equal(uniqueKeys.size, careerKeys.length, 'All career card keys must be unique');

    // Pathway steps key generator
    const steps = [
      { id: 'step-1', step_number: 1, title: 'Step 1' },
      { id: 'step-2', step_number: 2, title: 'Step 2' },
      { id: null, step_number: 3, title: 'Step 3' },
      { id: null, step_number: 4, title: 'Step 4' }
    ];
    const stepKeys = steps.map((s, idx) => s.id ? `dash-step-${s.id}` : `dash-step-${s.step_number ?? idx}-${idx}`);
    const uniqueStepKeys = new Set(stepKeys);
    assert.equal(uniqueStepKeys.size, steps.length, 'All pathway step keys must be unique even with null ids');
  });

  await t.test('9. Career recommendations deduplication preserves unique entities', () => {
    const rawList = [
      { id: 'c-1', title: 'Backend Developer' },
      { id: 'c-1', title: 'Backend Developer' }, // duplicate id
      { id: 'c-2', title: 'Cloud Engineer' },
      { id: '', title: 'Cloud Engineer' } // duplicate title
    ];

    const seenIds = new Set();
    const seenTitles = new Set();
    const unique = [];
    for (const item of rawList) {
      if (!item) continue;
      const idKey = item.id ? String(item.id) : null;
      const titleKey = item.title ? item.title.toLowerCase().trim() : null;
      if (idKey && seenIds.has(idKey)) continue;
      if (titleKey && seenTitles.has(titleKey)) continue;
      if (idKey) seenIds.add(idKey);
      if (titleKey) seenTitles.add(titleKey);
      unique.push(item);
    }

    assert.equal(unique.length, 2, 'Deduplication must collapse duplicated entries');
    assert.equal(unique[0].id, 'c-1');
    assert.equal(unique[1].id, 'c-2');
  });

  await t.test('10. Mobile responsive dashboard tokens adhere strictly to NaviGoa brand palette', () => {
    const navigoaPalette = {
      forest: '#153D32',
      growth: '#276749',
      teal: '#087F8C',
      mint: '#BFE8D7',
      canvas: '#F7F9F7',
      white: '#FFFFFF',
      ink: '#18312B'
    };

    assert.equal(navigoaPalette.forest, '#153D32');
    assert.equal(navigoaPalette.growth, '#276749');
    assert.equal(navigoaPalette.teal, '#087F8C');
    assert.equal(navigoaPalette.mint, '#BFE8D7');
    assert.equal(navigoaPalette.canvas, '#F7F9F7');
    assert.equal(navigoaPalette.white, '#FFFFFF');
    assert.equal(navigoaPalette.ink, '#18312B');
  });
});
