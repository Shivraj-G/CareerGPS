import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../backend/src/config/database.js';

async function main() {
  const duplicateGroupQuery = `
    SELECT id, title, organization, location, advertisement_number, source_id, source_url,
           source_document_url, application_opening, application_deadline, vacancies_total,
           description, status, record_status, verification_status, created_at, updated_at
    FROM opportunities
    WHERE title = 'Software Test Engineer' AND organization = 'Sprinto' AND location = 'Bengaluru'
    ORDER BY created_at ASC
  `;
  const result = await pool.query(duplicateGroupQuery);
  const rows = result.rows;

  console.log(`Found ${rows.length} duplicate records for Software Test Engineer at Sprinto (Bengaluru).`);

  const canonical = rows[0]; // Earliest created
  const duplicates = rows.slice(1);

  console.log('\n--- CANONICAL RECORD ---');
  console.log(`ID: ${canonical.id}`);
  console.log(`Created: ${canonical.created_at}`);
  console.log(`Source URL: ${canonical.source_url}`);
  console.log(`Deadline: ${canonical.application_deadline}`);
  console.log(`Vacancies: ${canonical.vacancies_total}`);
  console.log(`Description: ${canonical.description.slice(0, 60)}...`);

  // Foreign keys checking for canonical and duplicates
  const allIds = rows.map(r => r.id);
  const dupIds = duplicates.map(r => r.id);

  const reqs = await pool.query(`SELECT * FROM opportunity_requirements WHERE opportunity_id = ANY($1)`, [allIds]);
  const careers = await pool.query(`SELECT * FROM career_opportunities WHERE opportunity_id = ANY($1)`, [allIds]);
  const elig = await pool.query(`SELECT * FROM eligibility_checks WHERE opportunity_id = ANY($1)`, [allIds]);

  console.log('\n--- FOREIGN KEY RELATIONSHIPS ---');
  console.log(`opportunity_requirements: total ${reqs.rows.length} rows (${reqs.rows.filter(r => r.opportunity_id === canonical.id).length} on canonical, ${reqs.rows.filter(r => r.opportunity_id !== canonical.id).length} on duplicates)`);
  console.log(`career_opportunities: total ${careers.rows.length} rows`);
  console.log(`eligibility_checks: total ${elig.rows.length} rows (${elig.rows.filter(r => r.opportunity_id === canonical.id).length} on canonical, ${elig.rows.filter(r => r.opportunity_id !== canonical.id).length} on duplicates)`);

  const backupData = {
    exportedAt: new Date().toISOString(),
    duplicateGroup: 'Sprinto - Software Test Engineer (Bengaluru)',
    canonicalRecord: canonical,
    duplicatesToRemove: duplicates,
    relatedRequirements: reqs.rows,
    relatedCareerOpportunities: careers.rows,
    relatedEligibilityChecks: elig.rows
  };

  const backupPath = path.resolve('scratch/duplicate_opportunities_backup.json');
  await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`\nSuccessfully exported full backup to: ${backupPath}`);

  await pool.end();
}

main().catch(console.error);
