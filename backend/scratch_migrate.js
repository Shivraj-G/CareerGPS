import { pool } from './src/config/database.js';
async function run() {
  try {
    await pool.query("ALTER TABLE user_profiles ADD COLUMN current_goal JSONB");
    console.log("Added current_goal column");
  } catch (e) {
    if (e.code === '42701') console.log("Column already exists");
    else console.error(e);
  }
  pool.end();
}
run();
