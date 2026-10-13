import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { pool } from '../backend/src/config/database.js';

async function main() {
  const fks = await pool.query(`
    SELECT
      tc.table_schema,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'opportunities'
  `);
  console.log('Foreign keys referencing opportunities:');
  console.log(JSON.stringify(fks.rows, null, 2));

  // Also check if any tables have opportunity_id without an explicit FK
  const cols = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE column_name = 'opportunity_id'
  `);
  console.log('Tables with opportunity_id column:');
  console.log(JSON.stringify(cols.rows, null, 2));

  await pool.end();
}

main().catch(console.error);
