import { pool } from '../backend/src/config/database.js';
import { env } from '../backend/src/config/env.js';
import jwt from '../backend/node_modules/jsonwebtoken/index.js';

async function testEndpoint() {
  const userRes = await pool.query("SELECT id, email, role FROM users LIMIT 1");
  if (!userRes.rows.length) {
    console.log("No users found");
    return;
  }
  const user = userRes.rows[0];
  console.log("Testing with user:", user.email, user.id);

  const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h'
  });

  // Test 1: Data Analyst + BCA
  const resDA = await fetch('http://localhost:5000/api/v1/skills/suggest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      education: 'Bachelor of Computer Applications (BCA)',
      career_goal: 'Data Analyst'
    })
  });
  const dataDA = await resDA.json();
  console.log('\n--- DATA ANALYST TEST --- Status:', resDA.status);
  console.log('Total skills:', dataDA.data?.length);
  const coreDA = dataDA.data?.filter(s => s.is_core);
  const suppDA = dataDA.data?.filter(s => !s.is_core);
  console.log('Core count:', coreDA?.length, 'Core skills:', coreDA?.map(s => s.name));
  console.log('Unrelated tech in Core:', coreDA?.filter(s => ['Vue.js', 'Software Testing', 'CI/CD'].includes(s.name)).map(s => s.name));

  // Test 2: Chef
  const resChef = await fetch('http://localhost:5000/api/v1/skills/suggest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      education: 'Higher Secondary School',
      career_goal: 'Chef'
    })
  });
  const dataChef = await resChef.json();
  console.log('\n--- CHEF TEST --- Total skills:', dataChef.data?.length);
  const coreChef = dataChef.data?.filter(s => s.is_core);
  console.log('Chef Core count:', coreChef?.length, 'Chef Core skills:', coreChef?.map(s => s.name));

  // Test 3: Backend Developer
  const resBE = await fetch('http://localhost:5000/api/v1/skills/suggest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      education: 'Bachelor of Computer Applications (BCA)',
      career_goal: 'Backend Developer'
    })
  });
  const dataBE = await resBE.json();
  console.log('\n--- BACKEND DEVELOPER TEST --- Total skills:', dataBE.data?.length);
  const coreBE = dataBE.data?.filter(s => s.is_core);
  console.log('BE Core count:', coreBE?.length, 'BE Core skills:', coreBE?.map(s => s.name));

  // Test 4: Lawyer
  const resLawyer = await fetch('http://localhost:5000/api/v1/skills/suggest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      education: 'Bachelor of Arts (BA)',
      career_goal: 'Lawyer'
    })
  });
  const dataLawyer = await resLawyer.json();
  console.log('\n--- LAWYER TEST --- Total skills:', dataLawyer.data?.length);
  const coreLawyer = dataLawyer.data?.filter(s => s.is_core);
  console.log('Lawyer Core count:', coreLawyer?.length, 'Lawyer Core skills:', coreLawyer?.map(s => s.name));

  await pool.end();
}

testEndpoint().catch(console.error);
