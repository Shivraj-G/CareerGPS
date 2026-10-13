import { pool } from './src/config/database.js';
import { env } from './src/config/env.js';
import jwt from 'jsonwebtoken';

async function testValidateGoal() {
  const userRes = await pool.query("SELECT id FROM users LIMIT 1");
  const userId = userRes.rows[0].id;

  const token = jwt.sign({ sub: userId, role: 'user' }, env.JWT_SECRET, { expiresIn: '1h' });

  // Test Lawyer with BCA profile
  const profileContext = {
    education: [{
      level: 'Undergraduate',
      degree: 'BCA',
      current_program: 'BCA',
      school_12_stream: 'Commerce',
      status: 'pursuing'
    }],
    experience: [],
    skills: []
  };

  const res = await fetch('http://localhost:5000/api/v1/profiles/me/validate-goal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      goal: 'Lawyer',
      profileContext
    })
  });

  const data = await res.json();
  console.log('Status code:', res.status);
  console.log('Response data:', JSON.stringify(data, null, 2));
  await pool.end();
}

testValidateGoal().catch(console.error);
