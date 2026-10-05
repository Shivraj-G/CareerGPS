
async function main() {
  const apId = '17e40e2c-763d-496c-8fc8-c18e40bd8ab1';
  const aiId = '2a7f4d18-6335-472c-aaef-ae9547bfc1e2';

  // Make an authenticated request as a user for AI Engineer
  // Wait, GET /api/v1/careers/:id is NOT authenticated in the router!
  // Let me check `career.routes.js`
  
  const token = process.argv[2] || '';
  
  const res = await fetch(`http://localhost:5000/api/v1/careers/${apId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await res.json();
  console.log("AI Engineer enriched:", JSON.stringify(data, null, 2));
}

main();
