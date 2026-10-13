import { pool } from '../backend/src/config/database.js';

async function check() {
  const res = await pool.query("SELECT id, name, category, record_status FROM skills WHERE name ILIKE '%visualis%' OR name ILIKE '%visualiz%' ORDER BY name");
  console.log(res.rows);

  // Check how many users have chosen either skill
  for (const r of res.rows) {
    const userCount = await pool.query("SELECT count(*) FROM user_skills WHERE skill_id = $1", [r.id]);
    const careerCount = await pool.query("SELECT count(*) FROM career_skills WHERE skill_id = $1", [r.id]);
    console.log(`Skill ${r.name} (${r.id}): ${userCount.rows[0].count} users, ${careerCount.rows[0].count} career_skills`);
  }

  await pool.end();
}

check().catch(console.error);
