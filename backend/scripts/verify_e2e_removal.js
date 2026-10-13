import { pool } from '../src/config/database.js';

async function main() {
  console.log('--- Starting Complete Pathway Removal E2E Verification ---');

  // 1. Authenticate with test user
  const email = `e2e_verify_${Date.now()}@example.com`;
  const regRes = await fetch('http://127.0.0.1:5000/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!', full_name: 'Chef Tester' })
  });
  const regData = await regRes.json();
  const token = regData.accessToken;
  const userId = regData.user.id;
  console.log('✓ Registered test user:', email);

  // 2. Select Chef template pathway
  const chefTplRes = await pool.query(
    `SELECT p.id, p.career_id, p.title 
     FROM pathways p 
     JOIN careers c ON c.id = p.career_id 
     WHERE LOWER(c.title) LIKE '%chef%' AND p.pathway_type = 'template' LIMIT 1`
  );
  const chefTpl = chefTplRes.rows[0];

  const selRes = await fetch(`http://127.0.0.1:5000/api/v1/pathways/template/${chefTpl.id}/select`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const selData = await selRes.json();
  const assignmentId = selData.data.id;
  console.log('✓ Assigned Chef pathway:', selData.data.title, 'Assignment ID:', assignmentId);

  // 3. Complete a milestone step
  const stepId = selData.data.steps[0].pathway_step_id;
  const stepRes = await fetch(`http://127.0.0.1:5000/api/v1/pathways/${assignmentId}/steps/${stepId}/complete`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: 'Verified knife handling basics' })
  });
  const stepData = await stepRes.json();
  console.log('✓ Completed step milestone. Status:', stepData.data.steps[0].status);

  // 4. Verify active in My Plan
  const meRes = await fetch('http://127.0.0.1:5000/api/v1/pathways/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const meData = await meRes.json();
  console.log('✓ Verified active in My Plan. Count:', meData.data.length);

  // 5. Test unauthenticated removal rejection (Scenario 6)
  const unauthRes = await fetch(`http://127.0.0.1:5000/api/v1/pathways/${assignmentId}`, {
    method: 'DELETE'
  });
  console.log('✓ Unauthenticated removal rejected with status:', unauthRes.status);
  if (unauthRes.status !== 401) throw new Error('Expected 401 for unauthenticated');

  // 6. Test invalid ID rejection (Scenario 5)
  const invalidRes = await fetch(`http://127.0.0.1:5000/api/v1/pathways/not-a-uuid`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('✓ Invalid ID removal rejected with status:', invalidRes.status);
  if (invalidRes.status !== 400) throw new Error('Expected 400 for invalid ID');

  // 7. Test removing another user\'s assignment rejection (Scenario 7)
  const otherUserReg = await fetch('http://127.0.0.1:5000/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `other_${Date.now()}@example.com`, password: 'Password123!' })
  });
  const otherToken = (await otherUserReg.json()).accessToken;
  const otherRemoveRes = await fetch(`http://127.0.0.1:5000/api/v1/pathways/${assignmentId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${otherToken}` }
  });
  console.log('✓ Removing another user assignment rejected with status:', otherRemoveRes.status);
  if (otherRemoveRes.status !== 403) throw new Error('Expected 403 for unauthorized user');

  // 8. Execute actual removal (Scenario 1 & 4)
  const removeRes = await fetch(`http://127.0.0.1:5000/api/v1/pathways/${assignmentId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('✓ Removal request HTTP status:', removeRes.status);
  const removeData = await removeRes.json();
  console.log('✓ Removal response payload:', removeData);
  if (removeRes.status !== 200 || !removeData.data.removed) throw new Error('Removal failed');

  // 9. Verify exclusion from active My Plan (Scenario 1 & 9)
  const meAfterRes = await fetch('http://127.0.0.1:5000/api/v1/pathways/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const meAfterData = await meAfterRes.json();
  console.log('✓ Active pathways in My Plan after removal:', meAfterData.data.length);
  if (meAfterData.data.length !== 0) throw new Error('Expected 0 active pathways');

  // 10. Verify career pathways list has selected=null
  const careerPwRes = await fetch(`http://127.0.0.1:5000/api/v1/pathways/career/${chefTpl.career_id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const careerPwData = await careerPwRes.json();
  console.log('✓ Career pathway selected state after archival:', careerPwData.data.selected);
  if (careerPwData.data.selected !== null) throw new Error('Expected selected to be null');

  // 11. Verify historical progress is preserved in DB (Scenario 3 & 4)
  const dbUp = await pool.query('SELECT status FROM user_pathways WHERE id = $1', [assignmentId]);
  console.log('✓ DB user_pathways status:', dbUp.rows[0].status);
  if (dbUp.rows[0].status !== 'archived') throw new Error('Expected archived status in DB');

  const dbSteps = await pool.query('SELECT status, notes, completed_at FROM user_pathway_steps WHERE user_pathway_id = $1 AND pathway_step_id = $2', [assignmentId, stepId]);
  console.log('✓ DB user_pathway_steps preserved milestone:', dbSteps.rows[0]);
  if (dbSteps.rows[0].status !== 'completed' || !dbSteps.rows[0].completed_at) throw new Error('Milestone not preserved');

  // 12. Repeated removal returns 404 cleanly
  const repeatRemoveRes = await fetch(`http://127.0.0.1:5000/api/v1/pathways/${assignmentId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('✓ Repeated removal rejected cleanly with status:', repeatRemoveRes.status);
  if (repeatRemoveRes.status !== 404) throw new Error('Expected 404 for repeated removal');

  // 13. Re-selecting or selecting another pathway works (Scenario 10)
  const reSelectRes = await fetch(`http://127.0.0.1:5000/api/v1/pathways/template/${chefTpl.id}/select`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const reSelectData = await reSelectRes.json();
  console.log('✓ Re-selected pathway status:', reSelectData.data.status, 'ID:', reSelectData.data.id);
  const reStep = reSelectData.data.steps.find(s => s.pathway_step_id === stepId);
  console.log('✓ Restored milestone status:', reStep.status, 'Notes:', reStep.notes);
  if (reStep.status !== 'completed') throw new Error('Restored milestone not preserved');

  console.log('--- ALL SCENARIOS VERIFIED SUCCESSFULLY ---');
  await pool.end();
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
