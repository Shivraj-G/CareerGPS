import { pool } from '../backend/src/config/database.js';

async function main() {
  // All tables in public schema
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log('All tables:', tables.rows.map(r => r.table_name));

  // Count careers and list titles
  const allCareers = await pool.query("SELECT id, title, record_status, verification_status FROM careers ORDER BY title");
  console.log(`Total careers in DB: ${allCareers.rows.length}`);
  console.log('Careers list:', allCareers.rows.map(r => r.title));

  // Check if any career_family, category, or classification exists anywhere
  for (const t of ['careers', 'career_skills', 'career_enrichments', 'ai_career_profiles', 'career_paths', 'career_progressions']) {
    if (tables.rows.some(r => r.table_name === t)) {
      const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [t]);
      console.log(`\nColumns in ${t}:`, cols.rows.map(r => `${r.column_name} (${r.data_type})`));
    }
  }

  // Check career_enrichments content for Assistant Professor
  const apEnrich = await pool.query("SELECT * FROM career_enrichments WHERE career_id = '17e40e2c-763d-496c-8fc8-c18e40bd8ab1'");
  console.log('\nAP enrichments in DB:', apEnrich.rows);

  await pool.end();
}

main().catch(console.error);
