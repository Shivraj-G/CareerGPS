const { pool } = require('./src/config/database.js');
async function run() {
  const i = await pool.query("SELECT c.title FROM courses c JOIN institutions i ON c.institution_id = i.id WHERE i.name = 'Goa College of Engineering'");
  console.log('GEC courses:', i.rows);
  process.exit(0);
}
run();
