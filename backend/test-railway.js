import 'dotenv/config';
import jwt from 'jsonwebtoken';
const token = jwt.sign({ id: 'c90f2390-50d4-42f0-9172-e1ab9da01633', role: 'user' }, process.env.JWT_SECRET);
async function run() {
  try {
    console.log('Sending request...');
    const res = await fetch('https://careergps-production.up.railway.app/api/v1/careers/explore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ query: 'Designer' })
    });
    console.log('STATUS:', res.status);
    const body = await res.text();
    console.log('BODY:', body);
  } catch(e) {
    console.log('ERROR:', e);
  }
}
run();
