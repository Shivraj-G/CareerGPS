import { pool } from './src/config/database.js';

async function check() {
  console.log("---- PATHWAYS ----");
  const p = await pool.query("SELECT id, title, career_id, pathway_type, record_status FROM pathways LIMIT 10");
  console.log(p.rows);
  
  console.log("\n---- USER_PATHWAYS ----");
  const up = await pool.query("SELECT id, title, user_id, pathway_id, status FROM user_pathways LIMIT 5");
  console.log(up.rows);
  
  pool.end();
}
check();
