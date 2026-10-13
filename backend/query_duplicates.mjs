import { pool } from './src/config/database.js';

async function run() {
  const res = await pool.query(`
    SELECT DISTINCT s.name 
    FROM courses c
    JOIN course_careers cc ON c.id = cc.course_id
    JOIN career_skills cs ON cs.career_id = cc.career_id
    JOIN skills s ON s.id = cs.skill_id
    WHERE c.title ILIKE '%BCA%'
  `);
  console.log(res.rows);
  pool.end();
}
run();
