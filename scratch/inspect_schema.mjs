import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
const { pool } = await import('../backend/src/config/database.js');

async function main() {
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'opportunities'
    ORDER BY ordinal_position
  `);
  console.table(cols.rows);

  const sources = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'sources'
    ORDER BY ordinal_position
  `);
  console.log('sources columns:');
  console.table(sources.rows);

  const candidates = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'ingestion_candidates'
    ORDER BY ordinal_position
  `);
  console.log('ingestion_candidates columns:');
  console.table(candidates.rows);

  await pool.end();
}

main().catch(console.error);
