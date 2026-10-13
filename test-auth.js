import fs from 'fs';

async function testAuth() {
  const email = `testuser_${Date.now()}@example.com`;
  const password = "password123";
  let cookie = "";

  console.log("1. Registering user...");
  const regRes = await fetch('http://localhost:3000/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const regData = await regRes.json();
  const setCookie = regRes.headers.get('set-cookie');
  if (setCookie) {
    cookie = setCookie.split(';')[0];
  }
  console.log(`Register status: ${regRes.status}, AccessToken: ${!!regData.accessToken}, Cookie: ${!!cookie}`);

  console.log("2. Attempting refresh with cookie...");
  const refRes = await fetch('http://localhost:3000/api/v1/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    }
  });
  const refData = await refRes.json();
  console.log(`Refresh status: ${refRes.status}, New AccessToken: ${!!refData.accessToken}`);

  console.log("3. Logging in...");
  const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const loginData = await loginRes.json();
  const loginCookie = loginRes.headers.get('set-cookie');
  console.log(`Login status: ${loginRes.status}, AccessToken: ${!!loginData.accessToken}, New Cookie: ${!!loginCookie}`);

  console.log("4. Attempting duplicate registration...");
  const dupRes = await fetch('http://localhost:3000/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const dupData = await dupRes.json();
  console.log(`Duplicate register status: ${dupRes.status}, Error Code: ${dupData.error?.code}`);
}

testAuth().catch(console.error);
