import { pool } from '../backend/src/config/database.js';

async function main() {
  const cRes = await pool.query("SELECT id FROM careers WHERE title = 'Backend Developer'");
  const careerId = cRes.rows[0].id;

  const pathways = await pool.query(
    "SELECT id, title, pathway_type, origin, record_status FROM pathways WHERE career_id = $1 ORDER BY created_at",
    [careerId]
  );

  console.log(`Found ${pathways.rows.length} pathways:`);
  for (const p of pathways.rows) {
    const steps = await pool.query("SELECT step_order, title FROM pathway_steps WHERE pathway_id = $1 ORDER BY step_order", [p.id]);
    console.log(`\n[${p.id}] ${p.title} (${p.pathway_type}/${p.origin}) - ${steps.rows.length} steps:`);
    steps.rows.forEach(s => console.log(`   ${s.step_order}. ${s.title}`));
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
