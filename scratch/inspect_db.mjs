import { pool } from '../backend/src/config/database.js';

async function main() {
  const users = await pool.query(`
    SELECT u.id, u.email, up.education, up.profile_status, up.career_goal, up.current_goal
    FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    ORDER BY u.created_at DESC
  `);
  console.log('TOTAL USERS:', users.rows.length);
  for (const u of users.rows) {
    console.log(`\nUser: ${u.email} (Status: ${u.profile_status})`);
    console.log('Education:', JSON.stringify(u.education, null, 2));
  }
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
