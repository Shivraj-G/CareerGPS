import { pool } from './src/config/database.js';

async function run() {
  try {
    const res = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
    console.log("TABLES:", res.rows.map(r => r.table_name));

    const careers = await pool.query("SELECT COUNT(*) FROM careers");
    console.log("Total careers:", careers.rows[0].count);

    const cc = await pool.query("SELECT COUNT(*) FROM course_careers");
    console.log("Total course_careers:", cc.rows[0].count);

    const inst = await pool.query("SELECT COUNT(*) FROM institutions");
    console.log("Total institutions:", inst.rows[0].count);
    
    const courses = await pool.query("SELECT COUNT(*) FROM courses");
    console.log("Total courses:", courses.rows[0].count);

    const qs = await pool.query("SELECT * FROM qualifications LIMIT 1").catch(e => null);
    if(qs) console.log("Has qualifications table");

  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
