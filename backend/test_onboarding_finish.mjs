import { env } from './src/config/env.js';

async function run() {
  const email = `test_${Date.now()}@test.com`;
  const registerRes = await fetch('http://localhost:5000/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', name: 'Test User' })
  });
  const auth = await registerRes.json();
  const token = auth.accessToken;

  console.log('Registered user.');

  const validateRes = await fetch('http://localhost:5000/api/v1/profiles/me/validate-goal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ goal: 'Backend Developer' })
  });
  const validateData = await validateRes.json();
  console.log('Validate goal status:', validateRes.status, validateData);

  const profileRes = await fetch('http://localhost:5000/api/v1/profiles/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      education: [{ level: 'Undergraduate', degree: 'BCA', status: 'pursuing', year: 3 }],
      experience: [],
      interests: [],
      preferred_locations: ['Goa'],
      career_goal: 'Backend Developer',
      constraints: { study_mode: ['online', 'part-time'] }
    })
  });
  const profileData = await profileRes.json();
  console.log('Update profile status:', profileRes.status, profileData);

  const skillsRes = await fetch('http://localhost:5000/api/v1/skills/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      skills: []
    })
  });
  console.log('Update skills status:', skillsRes.status, await skillsRes.json());
}
run().catch(console.error);
