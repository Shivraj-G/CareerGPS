import { pool } from './src/config/database.js';

async function run() {
  try {
    const careers = await pool.query('SELECT * FROM careers LIMIT 1');
    console.log("careers columns:", Object.keys(careers.rows[0] || {}));
    
    const aiCareers = await pool.query('SELECT * FROM ai_career_profiles LIMIT 1');
    console.log("ai_careers columns:", Object.keys(aiCareers.rows[0] || {}));
    
    const courses = await pool.query('SELECT * FROM courses LIMIT 1');
    console.log("courses columns:", Object.keys(courses.rows[0] || {}));
    
    const courseCareers = await pool.query('SELECT * FROM course_careers LIMIT 1');
    console.log("course_careers columns:", Object.keys(courseCareers.rows[0] || {}));
    
    const fks = await pool.query(`SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'course_careers'`);
    console.log("course_careers FKs:", fks.rows);

  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
