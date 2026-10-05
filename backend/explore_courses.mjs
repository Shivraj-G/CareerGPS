import { pool } from './src/config/database.js';

async function run() {
  try {
    const res = await pool.query(`SELECT DISTINCT title, qualification, course_type FROM courses ORDER BY title LIMIT 50`);
    console.log(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
