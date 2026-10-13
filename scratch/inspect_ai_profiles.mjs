import { pool } from '../backend/src/config/database.js';

async function main() {
  const aiProfiles = await pool.query("SELECT id, title, normalized_title, status, promoted_career_id FROM ai_career_profiles");
  console.log('AI Career Profiles count:', aiProfiles.rows.length);
  console.log(aiProfiles.rows);

  const cCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'courses'");
  console.log('Courses cols:', cCols.rows.map(r => r.column_name));

  const oCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'opportunities'");
  console.log('Opps cols:', oCols.rows.map(r => r.column_name));

  await pool.end();
}

main().catch(console.error);
