async function testRecs() {
  const BASE_URL = 'http://localhost:5000/api/v1';
  const email = `test_${Date.now()}@example.com`;
  
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!', role: 'USER' })
  });
  const regData = await regRes.json();
  const token = regData.accessToken;
  
  await fetch(`${BASE_URL}/profiles/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      education: [
        { level: 'Class 12', school_12_stream: 'Commerce without Mathematics', status: 'completed' },
        { level: 'Undergraduate', degree: 'BCom', specialization: 'Accounting', status: 'pursuing' }
      ]
    })
  });
  
  const recsRes = await fetch(`${BASE_URL}/skills/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({})
  });
  
  const recsData = await recsRes.json();
  console.log('BBA Digital Marketing Recommended Skills:');
  for (const sk of (recsData.data || [])) {
    console.log(`- [${sk.category}] ${sk.name}`);
  }
}

testRecs().catch(console.error);
