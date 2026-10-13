import { pool } from './src/config/database.js';
import fs from 'fs';

async function seed() {
  try {
    const sql = fs.readFileSync('seeds/005_marketing_skills.sql', 'utf-8');
    await pool.query(sql);
    console.log('Seed executed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error executing seed:', err);
    process.exit(1);
  }
}
seed();
