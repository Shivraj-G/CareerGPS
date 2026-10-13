import { pool } from './src/config/database.js';
import { createApp } from './src/app.js';
import { signAccessToken } from './src/modules/auth/auth.service.js';
import request from 'supertest';

const app = createApp();

async function checkShiv() {
  const userRes = await pool.query("SELECT id, email, role FROM users WHERE email = 'shiv@gmail.com'");
  const user = userRes.rows[0];
  const token = signAccessToken(user);

  const chefCareerId = 'ddbe9b4c-7b69-4696-a242-33f36b6d2261';

  // 1. Check career pathways list for Chef
  const listRes = await request(app)
    .get(`/api/v1/pathways/career/${chefCareerId}`)
    .set('Authorization', `Bearer ${token}`);
  console.log('careerPathwaysList for Chef:');
  console.log('selected:', listRes.body.data.selected ? { id: listRes.body.data.selected.id, title: listRes.body.data.selected.title } : null);
  console.log('existing count:', listRes.body.data.existing?.length);
  console.log('aiGenerated count:', listRes.body.data.aiGenerated?.length);

  // 2. Check /pathways/me
  const myRes = await request(app)
    .get('/api/v1/pathways/me')
    .set('Authorization', `Bearer ${token}`);
  console.log('/pathways/me items for Chef:', myRes.body.data.filter(p => p.career_id === chefCareerId));

  process.exit(0);
}

checkShiv().catch(err => { console.error(err); process.exit(1); });
