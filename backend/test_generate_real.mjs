import { pool } from './src/config/database.js';

async function test() {
  const careers = await pool.query("SELECT id FROM careers LIMIT 1");
  const careerId = careers.rows[0]?.id;
  if (!careerId) return console.log("Career not found in db");
  
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDMiLCJyb2xlIjoiVVNFUiIsImlhdCI6MTc5MDcwNDYzNiwiZXhwIjoxNzkwNzI2MjM2fQ.qoBJX_52-jFGDnoWarI9xWybP5qlzhJ15k-4Pt8zsFA'; 
  console.log("Testing with career:", careerId);
  const res = await fetch('http://localhost:5000/api/v1/pathways/generate', { 
    method: 'POST', 
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': 'Bearer ' + token 
    }, 
    body: JSON.stringify({ career_id: careerId }) 
  });
  
  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Response length:", data.data ? data.data.length : data);
  if (data.data && data.data.length > 0) {
     console.log("Selecting path:", data.data[0].id);
     const selRes = await fetch(`http://localhost:5000/api/v1/pathways/generated/${data.data[0].id}/select`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
     });
     const selData = await selRes.json();
     console.log("Select status:", selRes.status);
     console.log("Selected pathway status:", selData.data?.status);
  }
  pool.end();
}
test();
