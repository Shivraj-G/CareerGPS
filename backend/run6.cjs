const { pool } = require('./src/config/database.js');
async function run() {
  const p = await pool.query('SELECT * FROM pathway_steps LIMIT 5');
  console.log('pathway_steps:', p.rows);
  const pw = await pool.query('SELECT * FROM pathways LIMIT 5');
  console.log('pathways:', pw.rows);
  process.exit(0);
}
run();
