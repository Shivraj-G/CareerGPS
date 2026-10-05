const { pool } = require('./src/config/database.js');
async function run() {
  const c = await pool.query('SELECT title, qualifications, entry_routes FROM careers LIMIT 3');
  console.log(JSON.stringify(c.rows, null, 2));
  process.exit(0);
}
run();
