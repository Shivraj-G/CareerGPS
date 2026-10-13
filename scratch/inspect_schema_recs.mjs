import { pool } from '../backend/src/config/database.js';

async function main() {
  const cols = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('careers', 'career_skills', 'skills', 'user_profiles', 'ai_career_profiles', 'pathways', 'recommendations')
    ORDER BY table_name, ordinal_position
  `);
  const map = {};
  for (const r of cols.rows) {
    map[r.table_name] = map[r.table_name] || [];
    map[r.table_name].push(`${r.column_name} (${r.data_type})`);
  }
  console.log(JSON.stringify(map, null, 2));

  // Also check sample careers
  const sampleCareers = await pool.query(`
    SELECT id, title, description, qualifications, entry_routes, record_status 
    FROM careers 
    LIMIT 5
  `);
  console.log('Sample careers:', sampleCareers.rows);

  // Check how many AI career profiles exist
  const aiProfiles = await pool.query(`
    SELECT id, title, normalized_title, status 
    FROM ai_career_profiles 
    LIMIT 10
  `);
  console.log('AI career profiles count:', aiProfiles.rows.length, aiProfiles.rows.map(r => r.title));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
