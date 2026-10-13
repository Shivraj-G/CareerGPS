import { pool } from '../backend/src/config/database.js';

async function check() {
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'careers'");
  console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`));
  await pool.end();
}

check().catch(console.error);
