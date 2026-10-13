import { pool } from './src/config/database.js';

async function run() {
  const res = await pool.query(`SELECT name, category FROM skills WHERE name ILIKE '%geo%' OR name ILIKE '%gis%' OR name ILIKE '%biolog%' OR name ILIKE '%account%'`);
  console.log('Matches:', res.rows);
  process.exit(0);
}
run();
