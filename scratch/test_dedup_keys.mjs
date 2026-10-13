import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import crypto from 'node:crypto';
import { pool } from '../backend/src/config/database.js';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function canonicalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.hash = '';
    const trackingParams = /^(utm_|ref$|source$|tracking|fbclid|gclid|timestamp$|cache_bust$|_t$|t$)/i;
    for (const key of [...parsed.searchParams.keys()]) {
      if (trackingParams.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    let pathname = parsed.pathname.replace(/\/+$/, '');
    if (!pathname) pathname = '/';
    parsed.pathname = pathname;
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
}

function computeDedupKey(opp) {
  const normOrg = String(opp.organization || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normTitle = String(opp.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normLoc = String(opp.location || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const adNum = String(opp.advertisement_number || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const sourceId = String(opp.source_id || '').trim().toLowerCase();

  // If advertisement number or external ID is present
  if (adNum) {
    return 'ad:' + sha256(`${normOrg}::${adNum}`).slice(0, 32);
  }

  // If opening cycle date exists (e.g., YYYY-MM)
  let cycle = '';
  if (opp.application_opening) {
    const d = new Date(opp.application_opening);
    if (!isNaN(d.getTime())) {
      cycle = `::cycle:${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
  }

  // Fallback fingerprint by source + organization + title + location + optional cycle
  const raw = `${sourceId}::${normOrg}::${normTitle}::${normLoc}${cycle}`;
  return 'fp:' + sha256(raw).slice(0, 32);
}

async function testDedup() {
  const res = await pool.query(`SELECT * FROM opportunities ORDER BY created_at ASC`);
  const map = new Map();
  for (const row of res.rows) {
    const key = computeDedupKey(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }

  console.log(`Total opportunities: ${res.rows.length}`);
  console.log(`Total distinct dedup keys: ${map.size}`);

  for (const [key, rows] of map.entries()) {
    if (rows.length > 1) {
      console.log(`\nDuplicate group (key: ${key}, count: ${rows.length}):`);
      console.log(`  Title: ${rows[0].title}`);
      console.log(`  Org: ${rows[0].organization}`);
      console.log(`  Loc: ${rows[0].location}`);
      console.log(`  Ad: ${rows[0].advertisement_number}`);
      console.log(`  Opening: ${rows[0].application_opening}`);
      console.log(`  IDs (${rows.length}): ${rows.map(r => r.id).join(', ')}`);
    }
  }

  await pool.end();
}

testDedup().catch(console.error);
