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
    await client.query('BEGIN');
    for (const file of files) {
      const sql = await fs.readFile(path.join(seedDir, file), 'utf8');
      await client.query(sql);
      console.log(`Applied seed: ${file}`);
    }
    await client.query('COMMIT');
    console.log('Seeds complete.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error.message);
  process.exit(1);
});
