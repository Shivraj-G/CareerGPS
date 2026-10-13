import { pool } from './src/config/database.js';
pool.query("INSERT INTO careers (title, record_status) VALUES ('Doctor', 'published'), ('Surgeon', 'published') ON CONFLICT DO NOTHING").then(() => pool.end());
