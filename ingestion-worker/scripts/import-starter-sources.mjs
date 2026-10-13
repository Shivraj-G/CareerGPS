import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const cataloguePath = path.resolve(here, '..', 'starter-private-internship-sources.json');
const backendUrl = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
const adminToken = String(process.env.ADMIN_BEARER_TOKEN || '').trim();

if (!adminToken) {
  console.error('Missing ADMIN_BEARER_TOKEN. Set it to your own short-lived CareerGPS admin JWT in the environment. Do not share or commit it.');
  process.exit(1);
}

const catalogue = JSON.parse(await readFile(cataloguePath, 'utf8'));
const sources = Array.isArray(catalogue.sources) ? catalogue.sources : [];
if (!sources.length) {
  console.error(`No starter sources found in ${cataloguePath}`);
  process.exit(1);
}

let created = 0;
let skipped = 0;
let failed = 0;

for (const entry of sources) {
  // Source records are deliberately created unapproved. An administrator must review and approve them.
  const payload = {
    name: entry.name,
    source_type: entry.source_type,
    base_url: entry.base_url,
    organization: entry.organization || null,
    is_approved: false,
    access_notes: entry.access_notes || null
  };

  try {
    const response = await fetch(`${backendUrl}/api/v1/admin/sources`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));

    if (response.ok) {
      created += 1;
      console.log(`[CREATED - NEEDS APPROVAL] ${entry.name}`);
    } else if (response.status === 409) {
      skipped += 1;
      console.log(`[ALREADY EXISTS / SKIPPED] ${entry.name}: ${body?.error?.message || body?.message || 'source conflict'}`);
    } else {
      failed += 1;
      console.error(`[FAILED ${response.status}] ${entry.name}: ${body?.error?.message || body?.message || JSON.stringify(body)}`);
    }
  } catch (error) {
    failed += 1;
    console.error(`[NETWORK ERROR] ${entry.name}: ${error.message}`);
  }
}

console.log(`\nSource import summary: created=${created}, skipped=${skipped}, failed=${failed}.`);
console.log('No source was approved automatically. Review source domains and access policies in CareerGPS Admin before approving.');
if (failed > 0) process.exitCode = 1;
