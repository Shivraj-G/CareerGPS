import jwt from 'jsonwebtoken';
import { env } from './src/config/env.js';
import { pool } from './src/config/database.js';

const userId = '45834293-42ce-48a3-b078-f769c02a6963';
const token = jwt.sign({ sub: userId, role: 'user', id: userId }, env.JWT_SECRET, { expiresIn: '1h' });

const profiles = [
  { name: 'BCA', education: [{ level: 'Undergraduate', current_program: 'BCA', degree: 'BCA' }] },
  { name: 'B.Com', education: [{ level: 'Undergraduate', current_program: 'B.Com', degree: 'B.Com' }] },
  { name: 'B.Sc Geography', education: [{ level: 'Undergraduate', current_program: 'B.Sc', degree: 'B.Sc', specialization: 'Geography' }] },
  { name: 'B.Sc Biology', education: [{ level: 'Undergraduate', current_program: 'B.Sc', degree: 'B.Sc', specialization: 'Biology' }] },
  { name: 'PCM', education: [{ level: '12th', school_12_stream: 'Science PCM' }] },
  { name: 'PCB', education: [{ level: '12th', school_12_stream: 'Science PCB' }] },
  { name: 'MBA', education: [{ level: 'Postgraduate', current_program: 'MBA', degree: 'MBA', specialization: 'Finance' }, { level: 'Undergraduate', degree: 'B.Com' }] },
  { name: 'Professional', education: [], experience: [{ industry: 'IT', role: 'Software Engineer', duration: '3 years' }] }
];

async function run() {
  // Ensure user exists
  await pool.query(`INSERT INTO users (id, email, password_hash) VALUES ($1, 'test@test.com', 'hash') ON CONFLICT DO NOTHING`, [userId]);
  await pool.query(`INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);

  for (const prof of profiles) {
    console.log(`\n--- Testing ${prof.name} ---`);
    await pool.query(`UPDATE user_profiles SET education = $1, experience = $2 WHERE user_id = $3`, [JSON.stringify(prof.education), JSON.stringify(prof.experience || []), userId]);
    
    const res = await fetch('http://localhost:5000/api/v1/skills/suggest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ query: prof.name, education: prof.name })
    });
    const data = await res.json();
    console.log(`Status: ${data.status}`);
    if (data.data) {
        console.log(`Skills:`, data.data.map(s => s.name).slice(0, 10));
    } else {
        console.log(`Response:`, data);
    }
  }
  process.exit(0);
}
run();
