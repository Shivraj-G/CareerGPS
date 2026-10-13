import { pool } from '../backend/src/config/database.js';

async function check() {
  const res = await pool.query("SELECT id, title FROM careers WHERE title ILIKE '%law%' OR title ILIKE '%advocate%'");
  console.log('Law careers in DB:', res.rows);
  const allRes = await pool.query("SELECT id, title FROM careers WHERE title ILIKE '%chef%' OR title ILIKE '%data%'");
  console.log('Chef & Data careers in DB:', allRes.rows);
  await pool.end();
}

check().catch(console.error);
