import pg from 'pg';

async function run() {
  const pool = new pg.Pool({ connectionString: 'postgresql://postgres:mittal88@1@1@@localhost:5432/goa_career_intelligence' });
  const ilikeTerms = ['%career%', '%options%', '%bca%'];
  const res = await pool.query(`SELECT id, title FROM careers WHERE record_status = 'published' AND (title ILIKE ANY($1) OR COALESCE(description,'') ILIKE ANY($1)) ORDER BY title LIMIT 8`, [ilikeTerms]);
  console.log(res.rows);
  pool.end();
}
run();
