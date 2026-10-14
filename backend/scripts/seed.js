import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.resolve(__dirname, '../seeds');

async function seed() {
  const files = (await fs.readdir(seedDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No seed SQL files found. Database schema is ready for an approved dataset.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = await fs.readFile(path.join(seedDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`Applied seed: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        error.seed = file;
        throw error;
      }
    }
    console.log('Seeds complete.');
  } catch (error) {
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(`Seed failed${error.seed ? ` in ${error.seed}` : ''}: ${error.message}`);
  if (error.code) console.error(`PostgreSQL error code: ${error.code}`);
  if (error.detail) console.error(`Detail: ${error.detail}`);
  if (error.hint) console.error(`Hint: ${error.hint}`);
  process.exit(1);
});
