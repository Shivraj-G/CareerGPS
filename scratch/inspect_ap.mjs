import { pool } from '../backend/src/config/database.js';

async function main() {
  const careers = await pool.query("SELECT id, title, description FROM careers WHERE title ILIKE '%Professor%' OR title ILIKE '%Teacher%' OR title ILIKE '%Chef%' OR title ILIKE '%Police%' OR title ILIKE '%Analyst%' ORDER BY title");
  console.log('Sample careers:', careers.rows.map(r => ({ id: r.id, title: r.title })));

  const ap = careers.rows.find(r => r.title.toLowerCase().includes('assistant professor')) || careers.rows[0];
  if (ap) {
    console.log('\n--- AP DETAILS ---', ap);
    const skills = await pool.query("SELECT s.name, cs.importance FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1", [ap.id]);
    console.log('AP Skills:', skills.rows);
  }

  // Check what skills Chef and Police Officer have
  for (const title of ['Chef', 'Police Officer', 'Business Analyst', 'Teacher']) {
    const c = careers.rows.find(r => r.title.toLowerCase() === title.toLowerCase());
    if (c) {
      const s = await pool.query("SELECT s.name FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1", [c.id]);
      console.log(`\nSkills for ${title}:`, s.rows.map(x => x.name));
    }
  }

  // Check career table schema: what columns exist in careers table?
  const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'careers'");
  console.log('\nCareers table columns:', cols.rows.map(r => r.column_name));

  await pool.end();
}

main().catch(console.error);
