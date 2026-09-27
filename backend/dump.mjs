import { pool } from './src/config/database.js';
pool.query('SELECT * FROM users').then(res => {
  console.log("USERS: ", res.rows);
  return pool.query('SELECT * FROM user_profiles');
}).then(res => {
  console.log("PROFILES: ", res.rows);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
