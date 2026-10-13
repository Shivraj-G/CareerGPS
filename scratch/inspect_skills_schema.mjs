import { pool } from '../backend/src/config/database.js';

async function main() {
  const skCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'skills' ORDER BY ordinal_position");
  console.log('skills columns:', skCols.rows);

  const csCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'career_skills' ORDER BY ordinal_position");
  console.log('career_skills columns:', csCols.rows);

  const sample = await pool.query("SELECT * FROM skills LIMIT 5");
  console.log('sample skills:', sample.rows);

  // Check what skills exist for AI Engineer
  const aiEng = await pool.query("SELECT id, title FROM careers WHERE title ILIKE '%AI Engineer%'");
  console.log('AI Engineer career:', aiEng.rows);
  if (aiEng.rows[0]) {
    const aiSkills = await pool.query(`
      SELECT s.id, s.name, s.description, cs.importance, cs.verification_status
      FROM career_skills cs
      JOIN skills s ON s.id = cs.skill_id
      WHERE cs.career_id = $1
    `, [aiEng.rows[0].id]);
    console.log('AI Engineer skills:', aiSkills.rows);
  }

  // Check existing migrations list
  const migs = await pool.query("SELECT name FROM schema_migrations ORDER BY name");
  console.log('Migrations:', migs.rows.map(r => r.name));

  await pool.end();
}

main().catch(console.error);
