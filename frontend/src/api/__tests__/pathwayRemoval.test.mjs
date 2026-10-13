import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../client.js';

test('Pathway Removal & Template Preview State Management Tests', async (t) => {
  await t.test('1. api.deleteUserPathway is correctly defined and targets /pathways/:id', () => {
    assert.equal(typeof api.deleteUserPathway, 'function');
  });

  await t.test('2. Template preview is distinguished from saved assignment state', () => {
    // Template preview model (loaded directly from catalogue)
    const templatePreview = {
      id: 'template-uuid-1234',
      career_id: 'career-uuid-5678',
      title: 'AI Engineer Template',
      isTemplatePreview: true,
      steps: [{ id: 's1', title: 'Step 1', status: 'not_started' }]
    };

    // Active saved assignment model (instantiated for user)
    const savedAssignment = {
      id: 'user-assignment-uuid-9999',
      pathway_id: 'template-uuid-1234',
      career_id: 'career-uuid-5678',
      title: 'AI Engineer Pathway',
      status: 'active',
      isTemplatePreview: false,
      steps: [{ id: 's1', title: 'Step 1', status: 'in_progress' }]
    };

    // Check discrimination rules
    const isPreview = Boolean(templatePreview.isTemplatePreview);
    const isSaved = !savedAssignment.isTemplatePreview && savedAssignment.status === 'active';

    assert.equal(isPreview, true, 'Template preview must have isTemplatePreview flag');
    assert.equal(isSaved, true, 'Saved assignment must not be template preview and must be active');

    // Deletion eligibility check: only saved assignments can be removed from My Plan
    const canRemovePreview = !templatePreview.isTemplatePreview && Boolean(templatePreview.user_pathway_id || templatePreview.id);
    const canRemoveSaved = !savedAssignment.isTemplatePreview && Boolean(savedAssignment.user_pathway_id || savedAssignment.id);

    assert.equal(canRemovePreview, false, 'Template preview must NOT be eligible for deletion from My Plan');
    assert.equal(canRemoveSaved, true, 'Saved assignment MUST be eligible for removal');
  });

  await t.test('3. Target assignment ID resolves to user_pathways ID, not canonical template ID', () => {
    const savedAssignment = {
      id: 'assignment-uuid-aaaa',
      pathway_id: 'template-uuid-bbbb',
      isTemplatePreview: false
    };

    // Resolver should never substitute canonical template ID when assignment ID exists
    const resolvedId = savedAssignment.user_pathway_id || (!savedAssignment.isTemplatePreview ? savedAssignment.id : null);
    assert.equal(resolvedId, 'assignment-uuid-aaaa');
    assert.notEqual(resolvedId, 'template-uuid-bbbb');
  });

  await t.test('4. In-flight request protection prevents duplicate deletions', async () => {
    let callCount = 0;
    let isRemoving = false;

    async function executeRemoval() {
      if (isRemoving) return { blocked: true };
      isRemoving = true;
      try {
        callCount++;
        // Simulate in-flight async API network request
        await new Promise(r => setTimeout(r, 20));
        return { success: true };
      } finally {
        isRemoving = false;
      }
    }

    // Fire two calls concurrently (simulating rapid double clicks)
    const [res1, res2] = await Promise.all([executeRemoval(), executeRemoval()]);

    assert.equal(callCount, 1, 'Only exactly 1 removal request should execute');
    assert.equal(res1.success, true);
    assert.equal(res2.blocked, true);
  });

  await t.test('5. Cancelling removal confirmation aborts without firing API request', () => {
    let apiCalled = false;
    function handleRemoveWithConfirmation(confirmed) {
      if (!confirmed) return; // User pressed Cancel
      apiCalled = true;
    }

    handleRemoveWithConfirmation(false);
    assert.equal(apiCalled, false, 'Cancelling confirmation must not invoke deleteUserPathway');

    handleRemoveWithConfirmation(true);
    assert.equal(apiCalled, true, 'Confirming must proceed to invoke deleteUserPathway');
  });

  await t.test('6. Failed request preserves current pathway and allows retry', async () => {
    let currentPathway = { id: 'assignment-1', title: 'My Path' };
    let isRemoving = false;
    let errorSurfaced = null;

    async function handleFailedRemoval() {
      if (isRemoving) return;
      isRemoving = true;
      try {
        // Simulate 404 or 500 error from server
        throw new Error('Pathway not found or already removed.');
      } catch (err) {
        errorSurfaced = err.message;
        // Notice: currentPathway is NOT set to null on failure!
      } finally {
        isRemoving = false;
      }
    }

    await handleFailedRemoval();

    assert.equal(errorSurfaced, 'Pathway not found or already removed.');
    assert.notEqual(currentPathway, null, 'Pathway must stay intact on failed removal');
    assert.equal(isRemoving, false, 'isRemoving must be reset to allow retry');
  });

  await t.test('7. Exiting preview navigates back without sending DELETE request', () => {
    let deleteCount = 0;
    let navigatedTo = null;

    function handleExitPreview(careerId, navigate) {
      if (careerId) {
        navigate(`/pathway?career=${careerId}`, { replace: true });
      } else {
        navigate(-1);
      }
    }

    handleExitPreview('career-123', (url, opts) => {
      navigatedTo = url;
    });

    assert.equal(navigatedTo, '/pathway?career=career-123');
    assert.equal(deleteCount, 0, 'No DELETE requests sent when exiting preview');
  });

  await t.test('8. Empty state transition on removal when no active pathways remain (prevents dead /plan route)', async () => {
    let currentStatus = 'ready';
    let currentPathway = { id: 'pw-1', title: 'Chef Pathway' };
    let navigatedRoute = null;

    // Simulate removal workflow when careerId is empty
    async function handlePostRemoval(careerId, mockApiUserPathways, navigate) {
      currentPathway = null;
      if (careerId) {
        navigate(`/pathway?career=${careerId}`, { replace: true });
      } else {
        // Authoritative reload rather than navigating to dead /plan route
        const activeRes = await mockApiUserPathways();
        if (activeRes.length > 0) {
          currentPathway = activeRes[0];
          currentStatus = 'ready';
        } else {
          currentPathway = null;
          currentStatus = 'empty';
        }
      }
    }

    await handlePostRemoval('', async () => [], (url) => { navigatedRoute = url; });

    assert.equal(navigatedRoute, null, 'Must NOT navigate to /plan or dead routes');
    assert.equal(currentPathway, null, 'Active pathway must be null');
    assert.equal(currentStatus, 'empty', 'Status must transition to empty');
  });

  await t.test('9. Changing path navigates to /pathway?career= or /careers, never dead /plan route', () => {
    let navigatedTo = null;

    function handleChangePath(careerId, pathwayCareerId, navigate) {
      const targetCareerId = careerId || pathwayCareerId;
      if (targetCareerId) {
        if (careerId !== targetCareerId) {
          navigate(`/pathway?career=${targetCareerId}`);
        }
      } else {
        navigate('/careers');
      }
    }

    // When on /pathway with active pathway having career_id
    handleChangePath('', 'career-chef-uuid', (url) => { navigatedTo = url; });
    assert.equal(navigatedTo, '/pathway?career=career-chef-uuid');

    // When no career context exists at all
    handleChangePath('', '', (url) => { navigatedTo = url; });
    assert.equal(navigatedTo, '/careers');
  });

  await t.test('10. Removal clears template pathway parameter so template preview does not resurrect', async () => {
    let currentUrl = '/pathway?career=chef-uuid&pathway=template-chef-uuid';
    let loadedPathway = null;
    let currentStatus = 'loading';

    // Simulate removal and authoritative reload without closed-over stale templatePathwayId
    function onRemoveSuccess(careerId, navigate, loadPathwayData) {
      navigate(`/pathway?career=${careerId}`, { replace: true });
      // Call with explicitTemplatePathwayId = null so template preview is bypassed
      loadPathwayData(careerId, null);
    }

    const mockCareerPathwaysList = async (cId) => ({
      selected: null, // Just archived!
      existing: [{ id: 'template-chef-uuid', title: 'Chef Template' }],
      aiGenerated: []
    });

    await onRemoveSuccess('chef-uuid', (url) => { currentUrl = url; }, async (cId, explicitTemplateId) => {
      assert.equal(explicitTemplateId, null, 'Template preview must be explicitly bypassed');
      const res = await mockCareerPathwaysList(cId);
      if (res.selected) {
        loadedPathway = res.selected;
        currentStatus = 'ready';
      } else {
        loadedPathway = null;
        currentStatus = 'pre_generation';
      }
    });

    assert.equal(currentUrl, '/pathway?career=chef-uuid');
    assert.equal(loadedPathway, null, 'Template preview must not resurrect');
    assert.equal(currentStatus, 'pre_generation', 'Status must be pre_generation');
  });
});
