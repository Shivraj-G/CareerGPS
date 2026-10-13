async function runTests() {
  const BASE_URL = 'http://localhost:5000/api/v1';

  const profiles = [
    { stream: 'Commerce without Mathematics', degree: 'Bachelor of Sports Management', spec: '' },
    { stream: 'Science - PCM', degree: 'BCA', spec: 'Computer Applications' },
    { stream: 'Science - PCB', degree: 'BSc', spec: 'Geography' },
    { stream: 'Humanities without Mathematics', degree: 'Some Random Unknown Degree Without Mappings', spec: '' },
  ];

  for (const profile of profiles) {
    const email = `test_${Date.now()}_${Math.random()}@example.com`;
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password123!', role: 'USER' })
    });
    const regData = await regRes.json();
    const token = regData.accessToken;
    
    // Step 2: Save qualification
    await fetch(`${BASE_URL}/profiles/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        education: [
          { level: 'Undergraduate', stream: profile.stream, degree: profile.degree, specialization: profile.spec, status: 'pursuing' }
        ]
      })
    });
    
    // Step 3: Fetch skills (Testing retrieval)
    const recsRes = await fetch(`${BASE_URL}/skills/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({})
    });
    
    const recsData = await recsRes.json();
    console.log(`\n=== TEST: ${profile.stream} -> ${profile.degree} ${profile.spec} ===`);
    const coreSkills = (recsData.data || []).filter(s => s.is_core);
    const otherSkills = (recsData.data || []).filter(s => !s.is_core);
    
    console.log(`Core Skills (${coreSkills.length}):`);
    coreSkills.forEach(s => console.log(`  - [${s.category}] ${s.name}`));
    console.log(`Other Skills (${otherSkills.length}):`);
    otherSkills.forEach(s => console.log(`  - [${s.category}] ${s.name}`));

    // Test Changing Degree between Step 2 and Step 3
    if (profile.degree === 'BCA') {
      console.log('\n--- Test: Changing degree to BCom Accounting ---');
      await fetch(`${BASE_URL}/profiles/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          education: [
            { level: 'Undergraduate', stream: 'Commerce with Mathematics', degree: 'BCom', specialization: 'Accounting', status: 'pursuing' }
          ]
        })
      });

      const updatedRecsRes = await fetch(`${BASE_URL}/skills/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({})
      });
      const updatedRecsData = await updatedRecsRes.json();
      console.log(`Changed Degree Returned ${updatedRecsData.data.length} skills (First 3: ${updatedRecsData.data.slice(0,3).map(s=>s.name).join(', ')})`);
    }

    // Test saving and restoring selected skills
    if (profile.degree === 'BSc') {
      console.log('\n--- Test: Saving and Restoring Selected Skills ---');
      await fetch(`${BASE_URL}/profiles/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          skills: [
            { name: 'Cartography', level: 'Intermediate', years_experience: 2 }
          ]
        })
      });

      const profileRes = await fetch(`${BASE_URL}/profiles/me`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const fetchedProfile = await profileRes.json();
      console.log(`Restored Selected Skills: ${JSON.stringify(fetchedProfile.data.skills)}`);
    }
  }
}

runTests().catch(console.error);
