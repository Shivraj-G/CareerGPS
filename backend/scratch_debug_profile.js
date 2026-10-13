
async function debugProfile() {
  const BASE_URL = 'http://localhost:5000/api/v1';
  const email = `test_${Date.now()}@example.com`;
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!', role: 'USER' })
  });
  const regData = await regRes.json();
  const token = regData.accessToken;
  
  const res = await fetch(`${BASE_URL}/profiles/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      education: [
        { level: 'Undergraduate', stream: 'Commerce without Mathematics', degree: 'Bachelor of Sports Management', specialization: '', status: 'pursuing', education_stage: 'HIGHER_EDUCATION', school_12_stream: 'Commerce without Mathematics', current_program: 'Bachelor of Sports Management' }
      ]
    })
  });
  console.log("PUT Response:", await res.text());
}
debugProfile();
