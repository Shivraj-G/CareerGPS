import { pool } from './src/config/database.js';
pool.query("SELECT * FROM skill_education_mappings WHERE degree_name ILIKE '%Sports%'").then(res => {
  console.log('Sports Management mappings:', res.rows.length);
  pool.end();
});
