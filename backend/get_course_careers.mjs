import { pool } from './src/config/database.js';

async function run() {
  try {
    const res = await pool.query(`SELECT c.title as course, cr.title as career FROM course_careers cc JOIN courses c ON cc.course_id = c.id JOIN careers cr ON cc.career_id = cr.id`);
    console.log(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
