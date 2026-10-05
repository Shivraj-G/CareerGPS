const { pool } = require('./src/config/database.js');
async function run() {
  const c = await pool.query('SELECT title, subject FROM courses LIMIT 10');
  console.log(c.rows);
  process.exit(0);
}
run();
