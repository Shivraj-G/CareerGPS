import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
const { pool } = await import('../backend/src/config/database.js');

async function main() {
  const opps = await pool.query(`
    SELECT id, title, LENGTH(title) as title_len, LENGTH(description) as desc_len, organization, opportunity_type, SUBSTRING(description, 1, 150) as desc_snip
    FROM opportunities
    WHERE record_status = 'published'
    ORDER BY desc_len DESC NULLS LAST
    LIMIT 10
  `);
  console.log('Top opportunities by description length:');
  opps.rows.forEach(r => console.log(`- [${r.id}] len=${r.desc_len} title="${r.title.slice(0, 50)}" org="${r.organization}"`));

  const reqs = await pool.query(`
    SELECT r.id, r.opportunity_id, LENGTH(r.requirement_text) as req_len, r.requirement_type, r.verification_status,
           SUBSTRING(r.requirement_text, 1, 120) as snippet, o.title as opp_title
    FROM opportunity_requirements r
    JOIN opportunities o ON o.id = r.opportunity_id
    ORDER BY req_len DESC
    LIMIT 10
  `);
  console.log('\nTop requirements by length:');
  reqs.rows.forEach(r => console.log(`- opp="${r.opp_title.slice(0, 40)}" type=${r.requirement_type} len=${r.req_len} status=${r.verification_status}\n  "${r.snippet}..."`));

  await pool.end();
}

main().catch(console.error);
