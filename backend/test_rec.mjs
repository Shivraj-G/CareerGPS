const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@careergps.local', password: 'password' })
});
const loginData = await loginRes.json();
const token = loginData.data?.accessToken || loginData.accessToken;

const recRes = await fetch('http://localhost:5000/api/v1/recommendations/careers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({})
});
const recData = await recRes.json();
console.log(JSON.stringify(recData, null, 2));
