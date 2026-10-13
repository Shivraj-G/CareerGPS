import { pool } from './src/config/database.js';

async function run() {
  const res = await pool.query(`SELECT count(*) FROM skills`);
  console.log('Total skills:', res.rows[0].count);
  process.exit(0);
}
run();
