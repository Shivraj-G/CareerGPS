import { pool } from './src/config/database.js';

const results = await Promise.all([
  pool.query("SELECT COUNT(*) as c FROM careers WHERE record_status='published'"),
  pool.query("SELECT COUNT(*) as c FROM opportunities WHERE record_status='published'"),
  pool.query("SELECT COUNT(*) as c FROM courses WHERE record_status='published'"),
  pool.query("SELECT COUNT(*) as c FROM pathways WHERE record_status='published'"),
  pool.query("SELECT title FROM careers WHERE record_status='published' LIMIT 5"),
  pool.query("SELECT title, organization, status FROM opportunities WHERE record_status='published' LIMIT 5"),
]);

console.log('Published Careers:', results[0].rows[0].c);
console.log('Published Opportunities:', results[1].rows[0].c);
console.log('Published Courses:', results[2].rows[0].c);
console.log('Published Pathways:', results[3].rows[0].c);
console.log('\nSample Careers:', results[4].rows);
console.log('\nSample Opportunities:', results[5].rows);

process.exit(0);
