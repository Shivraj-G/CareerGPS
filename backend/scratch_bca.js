import { pool } from './src/config/database.js';
async function testBca() {
  const mappedCategories = [];
  const degreeStr = 'bca';
  const specStr = 'computer applications';
  const primaryKeywords = 'computer applications';
  
  const query = `
          SELECT DISTINCT s.id, s.name, s.category, s.origin, s.verification_status, s.description,
                 COALESCE(m.is_core, false) as is_core, m.degree_name
          FROM skills s
          LEFT JOIN skill_education_mappings m 
                 ON s.id = m.skill_id 
                AND (m.degree_name ILIKE $2 OR m.degree_name ILIKE $4)
                AND (m.specialization ILIKE $3 OR m.specialization = '' OR $3 = '%%')
          WHERE s.record_status = 'published' 
            AND (s.category = ANY($1) OR m.id IS NOT NULL)
          ORDER BY is_core DESC, s.name ASC
          LIMIT 25
  `;
  const res = await pool.query(query, [mappedCategories, `%${degreeStr}%`, `%${specStr}%`, `%${primaryKeywords}%`]);
  console.log('Query returned skills:', res.rows.length);
  res.rows.forEach(r => console.log(r.name, r.degree_name));
  pool.end();
}
testBca();
