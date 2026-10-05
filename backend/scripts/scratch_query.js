import { pool } from '../src/config/database.js';

async function check() {
  const res = await pool.query(`SELECT DISTINCT qualification FROM courses WHERE qualification IS NOT NULL`);
  console.log("Qualifications in courses:", res.rows);
  
  const rules = await pool.query(`SELECT * FROM course_eligibility_rules LIMIT 5`);
  console.log("Course Eligibility Rules:", rules.rows);
  
  const reqs = await pool.query(`SELECT * FROM career_qualifications WHERE requirement_type = 'required' LIMIT 5`);
  console.log("Career Qualifications:", reqs.rows);
  
  await pool.end();
}

check().catch(console.error);
