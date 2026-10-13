const pg = require('pg');
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:mittal88@1@1@@localhost:5432/goa_career_intelligence' });
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='user_skills'").then(res => {
  console.log(res.rows);
  process.exit(0);
});
