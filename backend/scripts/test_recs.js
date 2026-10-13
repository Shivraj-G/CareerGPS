const { pool } = require('../../src/config/database');
const fetch = require('node-fetch');

async function testProfiles() {
  const token = 'YOUR_TEST_TOKEN_HERE'; // Or we can test the function directly

  // wait, we can just insert a test user into the db, set their profile, then call the function logic or start the server and hit it.
  
}
testProfiles();
