import { pool } from './src/config/database.js';
pool.query("SELECT id, title, required_skills FROM ai_career_profiles LIMIT 1")
  .then(r => console.log("AI CAREERS:", JSON.stringify(r.rows, null, 2)))
  .catch(console.error)
  .finally(() => pool.end());
