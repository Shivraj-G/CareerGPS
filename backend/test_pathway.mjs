import { pool } from './src/config/database.js';

async function test() {
  const careers = await pool.query("SELECT id FROM careers LIMIT 1");
  const careerId = careers.rows[0]?.id;
  if (!careerId) return console.log("Career not found");
  
  const authRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@careergps.local', password: 'password' })
  });
  const { data } = await authRes.json();
  const token = data.accessToken;
  
  console.log("Generating pathways for career: " + careerId);
  const res = await fetch('http://localhost:5000/api/v1/pathways/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ career_id: careerId })
  });
  console.log(res.status, await res.json());
  
  // Also try selecting it if successful
  /*
  const d = await res.json();
  if (d.data && d.data.length > 0) {
    const selRes = await fetch(`http://localhost:5000/api/v1/pathways/generated/${d.data[0].id}/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });
    console.log("Select status", selRes.status);
  }
  */
  pool.end();
}
test();
