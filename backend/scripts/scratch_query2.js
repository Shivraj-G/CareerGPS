import { pool } from '../src/config/database.js';

async function check() {
  const reqs = await pool.query(`SELECT * FROM course_eligibility_rules LIMIT 10`);
  console.log("Course Eligibility Rules:", reqs.rows);
  
  const rules = await pool.query(`SELECT DISTINCT rule_type FROM course_eligibility_rules`);
  console.log("Distinct Rule Types (Courses):", rules.rows);
  
  const courses = await pool.query(`SELECT DISTINCT title, course_type, qualification FROM courses LIMIT 10`);
  console.log("Courses:", courses.rows);
  
  await pool.end();
}

check().catch(console.error);
