import { pool } from './src/config/database.js';
pool.query("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'user_pathways'::regclass").then(res => { console.log(res.rows); process.exit(0); }).catch(e => console.error(e));
