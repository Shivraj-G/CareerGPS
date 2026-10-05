import { pool } from './src/config/database.js';
pool.query("SELECT * FROM information_schema.key_column_usage WHERE table_name = 'user_skills';").then(res => { console.log(res.rows); process.exit(0); });
