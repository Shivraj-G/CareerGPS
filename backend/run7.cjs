const { pool } = require('./src/config/database.js');
async function run() {
  const p = await pool.query('SELECT * FROM course_eligibility_rules LIMIT 5');
  console.log('course_eligibility_rules:', p.rows);
  process.exit(0);
}
run();
