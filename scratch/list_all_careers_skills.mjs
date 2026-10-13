import { pool } from '../backend/src/config/database.js';

async function main() {
  const careers = await pool.query(`
    SELECT c.id, c.title,
           array_agg(s.name) as skills
    FROM careers c
    LEFT JOIN career_skills cs ON cs.career_id = c.id
    LEFT JOIN skills s ON s.id = cs.skill_id
    GROUP BY c.id, c.title
    ORDER BY c.title
  `);
  for (const c of careers.rows) {
    console.log(`${c.title} (${c.id}): ${(c.skills || []).filter(Boolean).join(', ')}`);
  }
  await pool.end();
}

main().catch(console.error);
