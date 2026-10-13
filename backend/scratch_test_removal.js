import { pool } from './src/config/database.js';
import { createApp } from './src/app.js';
import request from 'supertest';

const app = createApp();

async function testRemoval() {
  // 1. Create a test user
  const email = `test_removal_${Date.now()}@example.com`;
  const password = 'Password123!';
  const regRes = await request(app).post('/api/v1/auth/register').send({ email, password, full_name: 'Test Removal User' });
  const token = regRes.body.accessToken;
  const userId = regRes.body.user.id;
  console.log('Created user:', userId);

  // 2. Assign Chef pathway
  // Find chef pathway template
  const pw = await pool.query("SELECT id FROM pathways WHERE career_id = 'ddbe9b4c-7b69-4696-a242-33f36b6d2261' AND pathway_type = 'template' LIMIT 1");
  const templateId = pw.rows[0].id;
  console.log('Template pathway ID:', templateId);

  // Select template pathway via API
  const selRes = await request(app)
    .post(`/api/v1/pathways/template/${templateId}/select`)
    .set('Authorization', `Bearer ${token}`);
  console.log('Select template status:', selRes.status);
  const selectedPathway = selRes.body.data;
  console.log('Selected pathway keys:', Object.keys(selectedPathway));
  console.log('Selected pathway id:', selectedPathway.id, 'pathway_id:', selectedPathway.pathway_id);

  // 3. User visits /pathway (no career query param)
  // Calls GET /api/v1/pathways/me
  const myPathwaysRes = await request(app)
    .get('/api/v1/pathways/me')
    .set('Authorization', `Bearer ${token}`);
  console.log('GET /pathways/me rows:', myPathwaysRes.body.data);
  const activeUserPathwayId = myPathwaysRes.body.data[0].id;

  // Calls GET /api/v1/pathways/generated/:id
  const getGenRes = await request(app)
    .get(`/api/v1/pathways/generated/${activeUserPathwayId}`)
    .set('Authorization', `Bearer ${token}`);
  console.log('GET /pathways/generated status:', getGenRes.status);
  const pathwayInState = getGenRes.body.data;
  console.log('Pathway in state id:', pathwayInState.id, 'user_pathway_id:', pathwayInState.user_pathway_id);

  // 4. Now simulate what handleRemovePathway does:
  const assignmentId = pathwayInState.user_pathway_id || pathwayInState.id;
  console.log('assignmentId being passed to DELETE:', assignmentId);

  const delRes = await request(app)
    .delete(`/api/v1/pathways/${assignmentId}`)
    .set('Authorization', `Bearer ${token}`);
  console.log('DELETE /pathways/:pathwayId status:', delRes.status);
  console.log('DELETE response body:', delRes.body);

  process.exit(0);
}

testRemoval().catch(err => {
  console.error(err);
  process.exit(1);
});
