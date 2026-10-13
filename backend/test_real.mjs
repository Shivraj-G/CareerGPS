import pg from 'pg';
import jwt from 'jsonwebtoken';


const pool = new pg.Pool({ connectionString: 'postgresql://postgres:mittal88@1@1@@localhost:5432/goa_career_intelligence' });

async function run() {
  const res = await pool.query("SELECT id FROM users WHERE account_status = 'active' LIMIT 1");
  if (res.rows.length === 0) { console.log('No user found'); process.exit(1); }
  const userId = res.rows[0].id;
  const token = jwt.sign({ sub: userId, role: 'user' }, '4625ede8c282c9f0897306b4c91321e867ce8d4f5cc537b6853048ecd35cc4621e206279be73d76b2e5424722a92f12da31163cc43faf8567c98dd7acdbc4e63', { expiresIn: '1d' });

  async function testValidateGoal(goal, profileContext) {
    const res = await fetch('http://localhost:5000/api/v1/profiles/me/validate-goal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': "Bearer " + token
      },
      body: JSON.stringify({ goal, profileContext })
    });
    if (!res.ok) {
       console.log('HTTP ERROR', res.status);
       const txt = await res.text();
       console.log(txt);
       return;
    }
    const data = await res.json();
    console.log("\\n================================\\nGOAL: " + goal + "\\n================================");
    console.log(JSON.stringify(data, null, 2));
  }

  await testValidateGoal("Backend Developer", {
    education: [{ education_stage: "SCHOOL_12", school_12_stream: "Science (PCM)", school_12_status: "Completed" }, { current_program: "BCA", status: "Pursuing" }]
  });

  process.exit(0);
}
run();
