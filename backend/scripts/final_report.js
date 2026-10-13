import { pool } from '../src/config/database.js';

async function generateFinalReport() {
  try {
    const skillsCount = await pool.query('SELECT count(*) FROM skills');
    const mappingsCount = await pool.query('SELECT count(*) FROM skill_education_mappings');
    const aliasesCount = await pool.query('SELECT count(*) FROM skill_aliases');
    
    console.log('--- FINAL DATABASE STATE ---');
    console.log(`Verified Canonical Skills: ${skillsCount.rows[0].count}`);
    console.log(`Skill-Education Relationships: ${mappingsCount.rows[0].count}`);
    console.log(`Skill Aliases/Synonyms: ${aliasesCount.rows[0].count}`);
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
generateFinalReport();
