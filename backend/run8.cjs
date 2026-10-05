const { pool } = require('./src/config/database.js');
async function run() {
  const c = await pool.query("SELECT id FROM careers WHERE title = 'AI Engineer'");
  const careerId = c.rows[0].id;
  const q = await pool.query(`
    SELECT DISTINCT c2.title, i.name as institution_name 
    FROM course_careers cc 
    JOIN courses c1 ON cc.course_id = c1.id 
    JOIN courses c2 ON c1.title = c2.title
    JOIN institutions i ON c2.institution_id = i.id
    WHERE cc.career_id = $1
  `, [careerId]);
  console.log('Matches:', q.rows);
  process.exit(0);
}
run();
