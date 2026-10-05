import { pool } from './src/config/database.js';

async function run() {
  try {
    const res = await pool.query(`
      SELECT 'career' as type, id, title, qualifications 
      FROM careers 
      WHERE title ILIKE '%Backend%' OR title ILIKE '%AI Engineer%'
      UNION ALL 
      SELECT 'ai_career' as type, id, title, qualifications 
      FROM ai_career_profiles 
      WHERE title ILIKE '%Clerk%'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
