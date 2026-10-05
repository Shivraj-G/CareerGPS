import { pool } from '../src/config/database.js';

async function check() {
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log("Tables:", tables.rows.map(r => r.table_name));
  
  await pool.end();
}

check().catch(console.error);
