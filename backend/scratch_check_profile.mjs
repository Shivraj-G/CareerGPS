import { pool } from './src/config/database.js';
import { getProfile } from './src/modules/profiles/profile.service.js';

async function main() {
  try {
    const cols = await pool.query(
      `SELECT table_name, column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name IN ('user_profiles', 'user_skills', 'users') 
       ORDER BY table_name, ordinal_position`
    );
    console.log("COLUMNS:");
    for (const r of cols.rows) {
      console.log(`  ${r.table_name}.${r.column_name} (${r.data_type})`);
    }

    const testUser = await pool.query(`SELECT id, email FROM users LIMIT 1`);
    console.log("TEST USER:", testUser.rows[0]);
    if (testUser.rows[0]) {
      try {
        const prof = await getProfile(testUser.rows[0].id);
        console.log("getProfile result:", prof ? "Found profile with keys: " + Object.keys(prof).join(", ") : "null");
      } catch (err) {
        console.error("getProfile ERROR:", err);
      }
    }
  } catch (err) {
    console.error("Query error:", err);
  } finally {
    await pool.end();
  }
}

main();
