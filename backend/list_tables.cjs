const pg = require('pg');
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:mittal88@1@1@@localhost:5432/goa_career_intelligence' });
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'").then(res => {
  console.log(res.rows);
  process.exit(0);
});
