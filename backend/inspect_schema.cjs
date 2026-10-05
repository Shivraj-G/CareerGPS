const { pool } = require('./src/config/database.js');
async function run() {
  for (const table of ['careers', 'career_qualifications', 'courses', 'course_careers', 'ai_career_profiles']) {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [table]);
    console.log('--- ' + table + ' ---');
    console.log(res.rows);
  }
  process.exit(0);
}
run();
