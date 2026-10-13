import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import crypto from 'node:crypto';
import { pool } from '../backend/src/config/database.js';

function nodeCompute(opp) {
  const normOrg = String(opp.organization || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normTitle = String(opp.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normLoc = String(opp.location || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const adNum = String(opp.advertisement_number || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const sourceId = String(opp.source_id || '').trim().toLowerCase();

  if (adNum) {
    return 'ad:' + crypto.createHash('sha256').update(`${normOrg}::${adNum}`).digest('hex').slice(0, 32);
  }

  let cycle = '';
  if (opp.application_opening) {
    const d = new Date(opp.application_opening);
    if (!isNaN(d.getTime())) {
      cycle = `::cycle:${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
  }

  const raw = `${sourceId}::${normOrg}::${normTitle}::${normLoc}${cycle}`;
  return 'fp:' + crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

async function main() {
  const query = `
    SELECT id, title, organization, location, advertisement_number, source_id, application_opening,
      CASE
        WHEN advertisement_number IS NOT NULL AND TRIM(advertisement_number) <> '' THEN
          'ad:' || SUBSTRING(encode(sha256((LOWER(TRIM(organization)) || '::' || LOWER(TRIM(advertisement_number)))::bytea), 'hex') FROM 1 FOR 32)
        ELSE
          'fp:' || SUBSTRING(encode(sha256((
            COALESCE(source_id::text, 'no-src') || '::' ||
            LOWER(TRIM(organization)) || '::' ||
            LOWER(TRIM(title)) || '::' ||
            LOWER(TRIM(COALESCE(location, ''))) ||
            CASE
              WHEN application_opening IS NOT NULL THEN '::cycle:' || TO_CHAR(application_opening AT TIME ZONE 'UTC', 'YYYY-MM')
              ELSE ''
            END
          )::bytea), 'hex') FROM 1 FOR 32)
      END AS sql_dedup_key
    FROM opportunities
    ORDER BY created_at ASC
  `;
  const res = await pool.query(query);
  let mismatches = 0;
  for (const row of res.rows) {
    const nodeKey = nodeCompute(row);
    if (nodeKey !== row.sql_dedup_key) {
      console.log(`Mismatch on ${row.id}: node=${nodeKey}, sql=${row.sql_dedup_key}`);
      mismatches++;
    }
  }
  console.log(`Checked ${res.rows.length} rows. Mismatches: ${mismatches}`);
  await pool.end();
}

main().catch(console.error);
