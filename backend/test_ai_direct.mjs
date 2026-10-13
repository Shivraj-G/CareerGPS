import { env } from './src/config/env.js';
import { pool } from './src/config/database.js';

async function run() {
  const profile = { education: [{ level: 'Undergraduate', current_program: 'B.Sc', degree: 'B.Sc', specialization: 'Geography' }] };
  
  const knownSkillsRes = await pool.query(`SELECT name FROM skills WHERE record_status = 'published' LIMIT 500`);
  const aiRes = await fetch(`http://localhost:8001/internal/v1/skills/suggest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN
    },
    body: JSON.stringify({ 
      query: 'B.Sc Geography',
      education: 'B.Sc Geography',
      career_goal: '',
      limit: 15, 
      known_skills: knownSkillsRes.rows.map(r => r.name),
      profile: profile
    })
  });
  
  const data = await aiRes.json();
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}
run();
