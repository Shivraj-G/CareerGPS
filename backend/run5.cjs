const { pool } = require('./src/config/database.js');
async function run() {
  const cq = await pool.query('SELECT cq.qualification as cq_qual, c.title as career_title FROM career_qualifications cq JOIN careers c ON cq.career_id = c.id LIMIT 20');
  console.log(JSON.stringify(cq.rows, null, 2));
  process.exit(0);
}
run();
