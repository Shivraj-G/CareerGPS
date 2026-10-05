import pg from 'pg';
import jwt from 'jsonwebtoken';

async function run() {
  const pool = new pg.Pool({ connectionString: 'postgresql://postgres:mittal88@1@1@@localhost:5432/goa_career_intelligence' });
  const result = await pool.query('SELECT id, email, role FROM users LIMIT 1');
  if (result.rows.length === 0) { console.log('No users found'); return; }
  const user = result.rows[0];
  
  const secret = '4625ede8c282c9f0897306b4c91321e867ce8d4f5cc537b6853048ecd35cc4621e206279be73d76b2e5424722a92f12da31163cc43faf8567c98dd7acdbc4e63';
  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, secret);
  
  const res = await fetch('http://localhost:5000/api/v1/assistant/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ message: 'Does CareerGPS have courses for acting?' })
  });
  console.log(await res.text());
  pool.end();
}
run();
