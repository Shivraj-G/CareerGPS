async function test() {
  const base = 'http://localhost:5000/api/v1';
  
  // Register
  const email = `test_${Date.now()}@test.com`;
  let res = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' })
  });
  const authData = await res.json();
  console.log('Auth:', authData);
  const token = authData.accessToken;

  // Profile
  res = await fetch(`${base}/profiles/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Profile status:', res.status);
  console.log('Profile data:', await res.json());

  // Skills
  res = await fetch(`${base}/skills`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Skills status:', res.status);

  // Custom skills
  res = await fetch(`${base}/skills/me/custom`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Custom skills status:', res.status);
}

test().catch(console.error);
