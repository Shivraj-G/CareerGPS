const { pool } = require('./src/config/database.js');
async function run() {
  const cq = await pool.query('SELECT qualification FROM career_qualifications LIMIT 10');
  console.log('career_qualifications:', cq.rows);
  const c = await pool.query('SELECT title, qualification, course_type FROM courses LIMIT 10');
  console.log('courses:', c.rows);
  process.exit(0);
}
run();
