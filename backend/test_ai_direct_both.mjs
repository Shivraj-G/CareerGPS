import { env } from './src/config/env.js';
import { pool } from './src/config/database.js';

async function run() {
  const knownSkillsRes = await pool.query(`SELECT name FROM skills WHERE record_status = 'published' LIMIT 500`);
  const known_skills = knownSkillsRes.rows.map(r => r.name);
  
  const testCases = [
    { name: 'B.Sc Geography', profile: { education: [{ level: 'Undergraduate', current_program: 'B.Sc', degree: 'B.Sc', specialization: 'Geography' }] } },
    { name: 'B.Sc Biology', profile: { education: [{ level: 'Undergraduate', current_program: 'B.Sc', degree: 'B.Sc', specialization: 'Biology' }] } }
  ];

  for (const tc of testCases) {
    console.log(`\n--- Testing ${tc.name} ---`);
    const aiRes = await fetch(`http://localhost:8001/internal/v1/skills/suggest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service-token': env.INTERNAL_SERVICE_TOKEN
      },
      body: JSON.stringify({ 
        query: tc.name,
        education: tc.name,
        limit: 15, 
        known_skills: known_skills,
        profile: tc.profile
      })
    });
    const data = await aiRes.json();
    console.log(`Skills:`, data.skills?.map(s => s.name));
  }
  process.exit(0);
}
run();
