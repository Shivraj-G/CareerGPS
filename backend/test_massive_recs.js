async function testMassiveRecs() {
  const BASE_URL = 'http://localhost:5000/api/v1';
  
  const testProfiles = [
    { degree: 'BBA', spec: 'Digital Marketing' },
    { degree: 'BCA', spec: 'Computer Applications' },
    { degree: 'BA', spec: 'Geography' },
    { degree: 'BCom', spec: 'Accounting' },
    { degree: 'BSc', spec: 'Nursing' },
    { degree: 'LLB', spec: 'Law' },
    { degree: 'BA', spec: 'Psychology' },
    { degree: 'BTech', spec: 'Mechanical Engineering' },
    { degree: 'MBA', spec: 'Finance' }
  ];

  for (const profile of testProfiles) {
    const email = `test_${Date.now()}_${Math.random()}@example.com`;
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password123!', role: 'USER' })
    });
    const regData = await regRes.json();
    const token = regData.accessToken;
    
    await fetch(`${BASE_URL}/profiles/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        education: [
          { level: 'Undergraduate', degree: profile.degree, specialization: profile.spec, status: 'pursuing' }
        ]
      })
    });
    
    const recsRes = await fetch(`${BASE_URL}/skills/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({})
    });
    
    const recsData = await recsRes.json();
    console.log(`\n=== TEST: ${profile.degree} ${profile.spec} ===`);
    const coreSkills = (recsData.data || []).filter(s => s.is_core);
    const otherSkills = (recsData.data || []).filter(s => !s.is_core);
    
    console.log(`Core Skills (${coreSkills.length}):`);
    coreSkills.forEach(s => console.log(`  - [${s.category}] ${s.name}`));
    console.log(`Other Skills (${otherSkills.length}):`);
    otherSkills.forEach(s => console.log(`  - [${s.category}] ${s.name}`));
  }
}

testMassiveRecs().catch(console.error);
