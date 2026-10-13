import jwt from 'jsonwebtoken';
import { env } from './src/config/env.js';

const token = jwt.sign({ sub: '45834293-42ce-48a3-b078-f769c02a6963', role: 'user' }, env.JWT_SECRET, { expiresIn: '1h' });

async function run() {
  const res = await fetch('http://localhost:5000/api/v1/skills/suggest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query: 'BCA', education: 'BCA' })
  });
  const text = await res.text();
  console.log("RESPONSE HTTP", res.status);
  console.log("RESPONSE TEXT", text);
}
run();
