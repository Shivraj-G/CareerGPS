import { pool } from './src/config/database.js';
import { getCareerPathways, generatePathway } from './src/modules/pathways/pathway.service.js';

async function run() {
  const user = await pool.query("SELECT id FROM users LIMIT 1");
  const userId = user.rows[0].id;

  const career = await pool.query("SELECT id FROM careers WHERE title = 'Backend Developer' LIMIT 1");
  const careerId = career.rows[0].id;
  
  console.log("Testing getCareerPathways for Backend Developer");
  const result = await getCareerPathways(userId, careerId);
  console.log("Existing pathways:", result.existing.length);
  console.log("AI generated:", result.aiGenerated.length);
  console.log("Selected:", result.selected?.title);

  pool.end();
}
run();
