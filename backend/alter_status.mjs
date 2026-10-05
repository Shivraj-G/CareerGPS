import { pool } from './src/config/database.js';

async function run() {
  try {
    await pool.query(`ALTER TABLE user_pathways DROP CONSTRAINT user_pathways_status_check;`);
    await pool.query(`ALTER TABLE user_pathways ADD CONSTRAINT user_pathways_status_check CHECK (status IN ('active', 'completed', 'archived', 'generated'));`);
    console.log('Success');
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
