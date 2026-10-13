import { pool } from './src/config/database.js';
async function run() {
  let res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'careers'");
  console.log('careers:', res.rows.map(r => r.column_name).join(', '));
  res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'career_qualifications'");
  console.log('career_qualifications:', res.rows.map(r => r.column_name).join(', '));
  res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'courses'");
  console.log('courses:', res.rows.map(r => r.column_name).join(', '));
  res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'course_eligibility_rules'");
  console.log('course_eligibility_rules:', res.rows.map(r => r.column_name).join(', '));
  pool.end();
}
run();
