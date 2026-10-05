const { pool } = require('./src/config/database.js');
async function run() {
  const c = await pool.query('SELECT COUNT(*) FROM course_careers');
  console.log('course_careers count:', c.rows[0].count);
  const cq = await pool.query('SELECT COUNT(*) FROM career_qualifications');
  console.log('career_qualifications count:', cq.rows[0].count);
  
  const sample = await pool.query('SELECT * FROM course_careers LIMIT 2');
  console.log('sample:', sample.rows);
  
  process.exit(0);
}
run();
