import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { pool } from '../backend/src/config/database.js';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sql = `
      DO $$
      DECLARE
        grp RECORD;
        canonical_id UUID;
        dup_ids UUID[];
      BEGIN
        FOR grp IN (
          SELECT 'test'::text AS k, ARRAY['c3167a2a-7b42-48ee-bd66-014f184f43cf'::uuid, '654a64d6-4f93-46d8-9d81-db37c04434f9'::uuid] AS ids
        ) LOOP
          canonical_id := grp.ids[1];
          dup_ids := grp.ids[2:ARRAY_LENGTH(grp.ids, 1)];
          RAISE NOTICE 'canonical: %, dups: %', canonical_id, dup_ids;
        END LOOP;
      END $$;
    `;
    await client.query(sql);
    console.log('DO block executed successfully in pg client!');
    await client.query('ROLLBACK');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('DO block failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
