const { pool } = require('./src/config/database.js');
async function run() {
  const c = await pool.query(`
    SELECT c.title as career_title, co.title as course_title, i.name as institution_name
    FROM course_careers cc
    JOIN careers c ON cc.career_id = c.id
    JOIN courses co ON cc.course_id = co.id
    JOIN institutions i ON co.institution_id = i.id
    LIMIT 20
  `);
  console.log(JSON.stringify(c.rows, null, 2));
  process.exit(0);
}
run();
