import { pool } from './src/config/database.js';
pool.query("SELECT title FROM careers WHERE title ILIKE '%med%' OR title ILIKE '%physician%' OR title ILIKE '%surgeon%'").then(res => { console.log(res.rows); pool.end(); });
