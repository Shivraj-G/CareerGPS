import { pool } from '../backend/src/config/database.js';

async function main() {
  const careers = await pool.query(
    "SELECT id, title FROM careers WHERE title ILIKE '%backend%' OR title ILIKE '%software%'"
  );
  console.log('Matching Careers:', careers.rows);

  for (const c of careers.rows) {
    const pathways = await pool.query(
      "SELECT id, title, description, pathway_type, record_status, origin FROM pathways WHERE career_id = $1",
      [c.id]
    );
    console.log(`\nPathways for [${c.title}] (${c.id}): count=${pathways.rows.length}`);
    for (const p of pathways.rows) {
      console.log(` - ID: ${p.id} | type: ${p.pathway_type} | origin: ${p.origin} | status: ${p.record_status} | title: "${p.title}"`);
    }
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
