import { pool } from '../backend/src/config/database.js';

async function main() {
  const careers = await pool.query(`
    SELECT c.id, c.title, c.record_status,
           COUNT(cs.skill_id) as skill_count
    FROM careers c
    LEFT JOIN career_skills cs ON cs.career_id = c.id
    GROUP BY c.id, c.title, c.record_status
    ORDER BY c.title
  `);
  console.log('All careers and skill counts:');
  for (const c of careers.rows) {
    console.log(`- ${c.title} (status: ${c.record_status}, skills: ${c.skill_count})`);
  }

  // Check Data Analyst career details
  const da = await pool.query(`
    SELECT c.*, json_agg(s.name) as skills
    FROM careers c
    LEFT JOIN career_skills cs ON cs.career_id = c.id
    LEFT JOIN skills s ON s.id = cs.skill_id
    WHERE c.title ILIKE '%analyst%' OR c.title ILIKE '%data%'
    GROUP BY c.id
  `);
  console.log('\nData/Analyst Careers:');
  for (const row of da.rows) {
    console.log(`Title: ${row.title} (id: ${row.id}, status: ${row.record_status})`);
    console.log(`  Skills: ${JSON.stringify(row.skills)}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
