import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:mittal88@1@1@@localhost:5432/goa_career_intelligence'
});

async function main() {
  const ap = await pool.query("SELECT id, title, description, qualifications, responsibilities, entry_routes FROM careers WHERE title = 'Assistant Professor'");
  console.log("Assistant Professor:", JSON.stringify(ap.rows[0], null, 2));

  const ai = await pool.query("SELECT id, title, description, qualifications, responsibilities, entry_routes FROM careers WHERE title = 'AI Engineer'");
  console.log("AI Engineer:", JSON.stringify(ai.rows[0], null, 2));

  pool.end();
}
main();
