import { pool } from '../backend/src/config/database.js';

async function check() {
  const titles = ['Data Analyst', 'Backend Developer', 'Chef', 'Lawyer', 'Assistant Professor'];
  for (const t of titles) {
    const res = await pool.query('SELECT id, title FROM careers WHERE title ILIKE $1 LIMIT 1', [t]);
    if (res.rows.length) {
      const c = res.rows[0];
      const sk = await pool.query(
        `SELECT s.name, s.category, cs.importance 
         FROM career_skills cs 
         JOIN skills s ON cs.skill_id = s.id 
         WHERE cs.career_id = $1 
         ORDER BY cs.importance, s.name`, 
        [c.id]
      );
      console.log(`\n=== ${c.title} === (id: ${c.id})`);
      sk.rows.forEach(r => console.log(`  [${r.importance}] ${r.name} (${r.category})`));
    } else {
      console.log(`\n=== Career NOT FOUND: ${t}`);
    }
  }
  await pool.end();
}

check().catch(console.error);
